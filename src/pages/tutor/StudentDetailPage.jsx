// 튜터 - 학생 상세 페이지 (Tailwind CSS)

import { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import TutorLayout from '../../components/common/TutorLayout';
import FeedbackNotification from '../../components/tutor/FeedbackNotification';
import useFeedbackSender from '../../hooks/useFeedbackSender';
import { getFeedbackHistory } from '../../api/tutorFeedback';
import WeeklySummary from '../../components/student/stats/WeeklySummary';
import LearningTrendChart from '../../components/student/stats/LearningTrendChart';
import useTutorStudents from '../../hooks/tutor/useTutorStudents';
import { getWeeklyStats } from '../../api/stats';
import { setStudentWeeklyStats } from '../../store/slices/tutorStatsSlice';

// 퀵 피드백 템플릿
const QUICK_FEEDBACKS = [
  '잘하고 있어요!',
  '조금만 더 연습해요',
  '발음이 좋아요',
  '천천히 말해보세요',
];

export default function StudentDetailPage() {
  const { email } = useParams();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const tutorEmail = useSelector(state => state.auth.user?.email);

  const { students, loadingStudents } = useTutorStudents();
  const student = useMemo(
    () => students.find((s) => s.email === email),
    [students, email]
  );

  const studentName = student?.name || '이름 없음';
  const studentStatus = student?.status || 'inactive';

  const activityBadge = useMemo(() => {
    // 4종 규칙(확정)
    if (student?.activity === 'conversation') {
      return {
        label: 'AI 대화',
        icon: 'forum',
        className: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
      };
    }
    if (student?.activity === 'sentence') {
      return {
        label: '문장 연습',
        icon: 'format_quote',
        className: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
      };
    }
    if (studentStatus !== 'inactive') {
      return {
        label: '접속 중',
        icon: 'wifi',
        className: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
      };
    }
    return {
      label: '오프라인',
      icon: 'cloud_off',
      className: 'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-300',
    };
  }, [student?.activity, studentStatus]);

  // 튜터용 학생별 주간 통계 캐시
  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);
  const weeklyCacheEntry = useSelector((state) => (email ? state.tutorStats?.studentsWeeklyStats?.[email] : null));
  const weeklyStats = weeklyCacheEntry?.data || null;
  const shouldFetchWeekly = Boolean(email) && (!weeklyStats || weeklyCacheEntry?.fetchedDate !== todayStr);

  const [weeklyLoading, setWeeklyLoading] = useState(false);
  const [weeklyError, setWeeklyError] = useState(null);

  useEffect(() => {
    const fetchWeekly = async () => {
      if (!email || !shouldFetchWeekly) return;
      try {
        setWeeklyLoading(true);
        setWeeklyError(null);
        const weeklyRes = await getWeeklyStats(email);
        const weeklyData =
          weeklyRes?.data && typeof weeklyRes.data === 'object' ? weeklyRes.data : weeklyRes;
        dispatch(setStudentWeeklyStats({ email, data: weeklyData }));
      } catch (e) {
        console.error('[StudentDetailPage] Failed to fetch weekly stats:', e);
        setWeeklyError(e?.message || '주간 통계를 불러오지 못했습니다.');
      } finally {
        setWeeklyLoading(false);
      }
    };

    fetchWeekly();
  }, [email, shouldFetchWeekly, dispatch]);

  const weeklySummary = useMemo(() => {
    const summary = weeklyStats?.summary;
    if (!summary) return null;

    return {
      totalRecordingTime: summary.total_recording_time || 0,
      totalSpeakingTime: summary.total_speaking_time || 0,
      practiceCount: summary.total_practice_count || 0,
      chatTurnsCount: summary.total_chat_turns || 0,
      speakingRatio: Math.round(summary.avg_net_speaking_density || 0),
      avgQuality: (summary.avg_response_quality || 0).toFixed(1),
      paceRatio: (summary.avg_pace_ratio || 0).toFixed(2),
    };
  }, [weeklyStats]);

  const weeklyTrendData = useMemo(() => {
    const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
    const today = new Date();

    const toLocalDateStr = (date) => {
      const y = date.getFullYear();
      const m = String(date.getMonth() + 1).padStart(2, '0');
      const d = String(date.getDate()).padStart(2, '0');
      return `${y}-${m}-${d}`;
    };

    const last7Days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(today);
      d.setDate(d.getDate() - (6 - i));
      return toLocalDateStr(d);
    });

    const dataByDate = {};
    (weeklyStats?.daily || []).forEach((d) => {
      if (d?.date) dataByDate[d.date] = d;
    });

    return last7Days.map((dateStr, idx) => {
      const d = dataByDate[dateStr];
      const dateObj = new Date(today);
      dateObj.setDate(dateObj.getDate() - (6 - idx));
      const dayIndex = dateObj.getDay();

      return {
        name: dayNames[dayIndex],
        speakingSec: Math.max(0, Math.round((d?.total_speaking_time || 0) / 1000)),
        listening: 0,
        practice: d?.practice_count || 0,
        chatTurns: d?.chat_turns_count || 0,
      };
    });
  }, [weeklyStats]);

  const [feedbackHistory, setFeedbackHistory] = useState([]);
  const [feedbackLoading, setFeedbackLoading] = useState(true);
  const [feedbackText, setFeedbackText] = useState('');
  const [notification, setNotification] = useState(null);

  // 피드백 히스토리 불러오기
  useEffect(() => {
    const loadFeedbackHistory = async () => {
      try {
        setFeedbackLoading(true);
        const result = await getFeedbackHistory(email);
        
        // 백엔드에서 파싱된 응답 처리
        const messages = result.messages || [];
        const parsed = messages.map((msg, idx) => ({
          id: msg.feedback_id || msg.composite_key || idx,
          message: msg.message_type === 'tts' 
            ? `🔊 ${msg.message || ''}` 
            : (msg.message || ''),
          time: msg.timestamp 
            ? new Date(msg.timestamp).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
            : '',
          messageType: msg.message_type || 'text',
        })).reverse(); // 최신이 맨 뒤로 오도록 역순 정렬
        
        setFeedbackHistory(parsed);
        console.log('✅ 피드백 히스토리 로드 완료:', parsed.length, '개');
      } catch (error) {
        console.error('❌ 피드백 히스토리 로드 실패:', error);
        setFeedbackHistory([]);
      } finally {
        setFeedbackLoading(false);
      }
    };

    if (email) {
      loadFeedbackHistory();
    }
  }, [email]);

  // useFeedbackSender 훅 사용
  const { send: sendFeedbackMessage, sending } = useFeedbackSender({
    tutorEmail,
    studentEmail: email,
    onSuccess: (message, feedbackData) => {
      const newFeedback = {
        id: Date.now(),
        message: feedbackData.type === 'tts' ? `🔊 ${feedbackData.message}` : feedbackData.message,
        time: feedbackData.time,
      };
      setFeedbackHistory(prev => [...prev, newFeedback]);
      setFeedbackText('');
      setNotification({ message, severity: 'success' });
    },
    onError: (message) => {
      setNotification({ message, severity: 'error' });
    },
  });

  // 텍스트 피드백 전송
  const handleSendFeedback = async () => {
    if (!feedbackText.trim() || sending) return;
    await sendFeedbackMessage(feedbackText, { withTTS: false });
  };

  // 퀵 피드백 전송
  const handleQuickFeedback = (text) => {
    setFeedbackText(text);
  };

  // TTS 피드백 전송 (audio_url 자동 생성)
  const handleTTSFeedback = async () => {
    if (!feedbackText.trim() || sending) return;
    await sendFeedbackMessage(feedbackText, { withTTS: true });
  };

  // Enter 키로 전송
  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendFeedback();
    }
  };

  return (
    <TutorLayout
      title="Student Profile Details"
      subtitle="SpeakTracker Tutor Portal"
      studentCount={students.length}
    >
      {/* 메인 레이아웃: 좌측 콘텐츠 + 우측 피드백 패널 */}
      <div className="flex gap-6 items-start">
        {/* 왼쪽: 메인 콘텐츠 */}
        <div className="flex-1 space-y-6 min-w-0">
          {/* 프로필 헤더 섹션 */}
          <section className="bg-white dark:bg-slate-900 p-8 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
            <div className="flex items-center gap-8">
              {/* 프로필 이미지 */}
              <div className="relative">
                <div className="size-24 rounded-full bg-[#137fec] flex items-center justify-center text-white text-3xl font-bold border-4 border-white dark:border-slate-800 shadow-xl">
                  {(studentName?.charAt(0) || '?')}
                </div>
                <div className={`absolute bottom-1 right-1 size-5 rounded-full border-3 border-white dark:border-slate-800 ${
                  studentStatus !== 'inactive' ? 'bg-green-500 animate-pulse' : 'bg-gray-400'
                }`}></div>
              </div>
              
              {/* 학생 정보 */}
              <div className="space-y-2 flex-1">
                <div className="flex items-center gap-3">
                  <h2 className="text-2xl font-bold">{studentName}</h2>
                  <span className={`px-2.5 py-0.5 text-xs font-bold rounded-full uppercase tracking-wider ${activityBadge.className}`}>
                    {activityBadge.label}
                  </span>
                </div>
                <p className="text-slate-500 dark:text-slate-400">{email}</p>
                <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300 font-semibold text-sm">
                  <span className="material-symbols-outlined text-lg">{activityBadge.icon}</span>
                  <span>
                    {student?.activity === 'conversation'
                      ? 'AI 대화 진행 중'
                      : student?.activity === 'sentence'
                        ? '문장 연습 진행 중'
                        : studentStatus !== 'inactive'
                          ? '접속 중'
                          : '오프라인'}
                  </span>
                </div>
                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => navigate(-1)}
                    className="px-3 py-1.5 text-[#137fec] text-sm font-bold border border-[#137fec]/20 hover:bg-[#137fec]/5 rounded-lg transition-colors"
                  >
                    뒤로 가기
                  </button>
                  {loadingStudents && !student ? (
                    <span className="text-xs text-slate-400">학생 정보 불러오는 중...</span>
                  ) : null}
                </div>
              </div>
            </div>
          </section>

          {weeklyError ? (
            <div className="rounded-xl border border-red-200 bg-red-50 text-red-800 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200 px-4 py-3">
              <p className="text-sm font-bold">주간 통계 로딩 실패</p>
              <p className="text-sm mt-1">{weeklyError}</p>
            </div>
          ) : null}

          {weeklyLoading ? (
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 py-3">
              <div className="flex items-center gap-2">
                <span className="inline-block size-4 animate-spin rounded-full border-2 border-[#137fec]/30 border-t-[#137fec]" />
                <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">주간 통계 불러오는 중...</p>
              </div>
            </div>
          ) : null}

          {weeklySummary ? (
            <WeeklySummary weeklySummary={weeklySummary} />
          ) : (
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 py-3">
              <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">
                이번 주 요약 데이터가 없습니다.
              </p>
            </div>
          )}

          <LearningTrendChart weeklyData={weeklyTrendData} />
        </div>

        {/* 오른쪽: 피드백 채팅 패널 (고정) */}
        <aside className="w-96 shrink-0 sticky top-6">
          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-lg border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col h-[calc(100vh-180px)]">
            {/* 헤더 */}
            <div className="bg-[#137fec] p-4 flex items-center justify-between text-white shrink-0">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <div className="size-10 rounded-full bg-white/20 flex items-center justify-center text-lg font-bold">
                    {(studentName?.charAt(0) || '?')}
                  </div>
                  <span className={`absolute bottom-0 right-0 size-3 border-2 border-[#137fec] rounded-full ${
                    studentStatus !== 'inactive' ? 'bg-green-400' : 'bg-gray-400'
                  }`}></span>
                </div>
                <div>
                  <h4 className="font-semibold text-sm leading-tight">피드백 보내기</h4>
                  <p className="text-[10px] text-white/80 uppercase tracking-wider font-bold">
                    {studentName} • {studentStatus !== 'inactive' ? '온라인' : '오프라인'}
                  </p>
                </div>
              </div>
            </div>

            {/* 메시지 영역 */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50 dark:bg-slate-950/50">
              {/* 날짜 구분선 */}
              <div className="text-center">
                <span className="text-[10px] text-slate-400 uppercase font-bold tracking-widest bg-white dark:bg-slate-900 px-3 py-1 rounded-full border border-slate-100 dark:border-slate-800">
                  오늘
                </span>
              </div>

              {feedbackLoading ? (
                <div className="flex items-center justify-center py-8">
                  <span className="material-symbols-outlined text-2xl text-slate-400 animate-spin">progress_activity</span>
                </div>
              ) : feedbackHistory.length === 0 ? (
                <div className="text-center py-8">
                  <span className="material-symbols-outlined text-4xl text-slate-300 mb-2">chat_bubble_outline</span>
                  <p className="text-sm text-slate-400">아직 피드백이 없습니다</p>
                </div>
              ) : (
                feedbackHistory.map((feedback) => (
                  <div key={feedback.id} className="flex items-start gap-3">
                    <div className="size-8 rounded-full bg-[#137fec] flex items-center justify-center text-white text-xs font-bold shrink-0">
                      T
                    </div>
                    <div className="flex-1">
                      <div className="bg-white dark:bg-slate-800 p-3 rounded-xl rounded-tl-none border border-slate-200 dark:border-slate-700 shadow-sm">
                        <p className="text-sm text-slate-800 dark:text-slate-200">{feedback.message}</p>
                      </div>
                      <span className="text-[10px] text-slate-400 mt-1 ml-1 block">{feedback.time}</span>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* 입력 영역 */}
            <div className="p-4 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 shrink-0 space-y-3">
              {/* 퀵 피드백 버튼 */}
              <div className="flex flex-wrap gap-2">
                {QUICK_FEEDBACKS.map((text) => (
                  <button
                    key={text}
                    onClick={() => handleQuickFeedback(text)}
                    className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 text-[11px] font-bold rounded-lg hover:bg-[#137fec] hover:text-white transition-all"
                  >
                    {text}
                  </button>
                ))}
              </div>

              {/* 입력창 */}
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={feedbackText}
                  onChange={(e) => setFeedbackText(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="피드백을 입력하세요..."
                  disabled={sending}
                  className="flex-1 px-4 py-3 bg-slate-100 dark:bg-slate-800 border-none rounded-xl text-sm focus:ring-2 focus:ring-[#137fec] focus:bg-white dark:focus:bg-slate-800 transition-all placeholder:text-slate-400"
                />
                <button
                  onClick={handleTTSFeedback}
                  disabled={!feedbackText.trim() || sending}
                  className="h-10 px-4 bg-orange-500 text-white rounded-xl flex items-center justify-center gap-1.5 hover:bg-orange-600 shadow-lg shadow-orange-500/30 transition-all disabled:opacity-50 disabled:shadow-none shrink-0 font-bold text-sm"
                  title="TTS로 전송 (음성)"
                >
                  <span className="material-symbols-outlined text-lg">
                    {sending ? 'hourglass_empty' : 'volume_up'}
                  </span>
                  {!sending && 'TTS'}
                </button>
                <button
                  onClick={handleSendFeedback}
                  disabled={!feedbackText.trim() || sending}
                  className="size-10 bg-[#137fec] text-white rounded-xl flex items-center justify-center hover:bg-[#137fec]/90 shadow-lg shadow-[#137fec]/30 transition-all disabled:opacity-50 disabled:shadow-none shrink-0"
                  title="텍스트로 전송"
                >
                  <span className="material-symbols-outlined text-lg">
                    {sending ? 'hourglass_empty' : 'send'}
                  </span>
                </button>
              </div>
            </div>
          </div>
        </aside>
      </div>

      {/* 알림 */}
      <FeedbackNotification
        notification={notification}
        onClose={() => setNotification(null)}
      />
    </TutorLayout>
  );
}
