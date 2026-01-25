import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import {
  Snackbar,
  Alert,
} from '@mui/material';
import StudentLayout from '../../components/common/StudentLayout';
import TutorSearchDialog from '../../components/student/TutorSearchDialog';
import { scenarios } from '../../data/conversation/scenarios';
import useWebSocket from "../../hooks/webSocket/useWebSocket.js";
import { selectWhisperPreloadStatus } from '../../store/slices/whisperPreloadSlice';
import {useStudentStatus} from "../../api/useStudentStatus.js";
import { getNotifications } from '../../api/notifications';

export default function HomePage() {
  const user = useSelector(state => state.auth.user);
  const navigate = useNavigate();
  const whisperStatus = useSelector(selectWhisperPreloadStatus);
  const [practiceDifficulty, setPracticeDifficulty] = useState('중');
  const [practiceTopicId, setPracticeTopicId] = useState('small_talk');
  const [chatDifficulty, setChatDifficulty] = useState('중');
  const [chatScenario, setChatScenario] = useState('small_talk');

  const persistPracticeConfig = useCallback((difficulty, topicId) => {
    try {
      localStorage.setItem('student.practiceConfig', JSON.stringify({ difficulty, topicId }));
    } catch (_) {}
  }, []);

  const persistChatConfig = useCallback((difficulty, scenario) => {
    try {
      localStorage.setItem('student.chatConfig', JSON.stringify({ difficulty, scenario }));
    } catch (_) {}
  }, []);

  // useStudentStatus(user, location);
  const [tutorSearchOpen, setTutorSearchOpen] = useState(false);
  
  // 알림 관련 state
  const [unreadCount, setUnreadCount] = useState(0);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'info' });

  const studentEmail = user?.email;
  const dailyRecordingMs = useSelector((state) => state.speakingStats?.dailyStats?.totalRecordingTime || 0);
  const sessionRecordingMs = useSelector((state) => state.speakingStats?.currentSession?.totalRecordingTime || 0);
  const dailySpeakingMs = useSelector((state) => state.speakingStats?.dailyStats?.totalSpeakingTime || 0);
  const sessionSpeakingMs = useSelector((state) => state.speakingStats?.currentSession?.userSpeakingTime || 0);
  const avgNetSpeakingDensity = useSelector((state) => state.speakingStats?.dailyStats?.avgNetSpeakingDensity || 0);

  const todayTimeSec = Math.floor((dailyRecordingMs + sessionRecordingMs) / 1000);
  const speakingTimeSec = Math.floor((dailySpeakingMs + sessionSpeakingMs) / 1000);
  const speakingRatio = todayTimeSec > 0 ? Math.round((speakingTimeSec / todayTimeSec) * 100) : 0;

  // 알림 개수 조회
  const loadUnreadCount = async () => {
    if (!studentEmail) return;
    try {
      const response = await getNotifications(false);
      // API 응답 구조: { success: true, data: { notifications: [...], unreadCount: n } }
      // 또는: { notifications: [...], unreadCount: n }
      const unread = response.data?.unreadCount || response.unreadCount || 0;
      setUnreadCount(unread);
    } catch (err) {
      console.error('알림 개수 조회 실패:', err);
    }
  };

  // 페이지 로드 시 알림 개수 조회
  useEffect(() => {
    if (studentEmail) {
      loadUnreadCount();
    }
  }, [studentEmail]);

  // 메시지 핸들러 함수 (WebSocket 메시지 수신 시 호출)
  const handleWebSocketMessage = useCallback((data) => {
    // 승인 알림
    if (data.type === 'TUTOR_REQUEST_APPROVED') {
      setUnreadCount(prev => prev + 1);  // 즉시 카운트 증가
      setSnackbar({
        open: true,
        message: `${data.data.tutor_name} 튜터님이 요청을 승인했습니다! 🎉`,
        severity: 'success'
      });
    }
    
    // 거부 알림
    if (data.type === 'TUTOR_REQUEST_REJECTED') {
      setUnreadCount(prev => prev + 1);  // 즉시 카운트 증가
      const reason = data.data.rejection_reason || '사유 없음';
      setSnackbar({
        open: true,
        message: `${data.data.tutor_name} 튜터님이 요청을 거부했습니다: ${reason}`,
        severity: 'error'
      });
    }
  }, []);


  // 웹소켓 연결만 수행 (데이터 전송 없음)
  const getData = useCallback(() => {
    if(!user?.email) {
      return null;
    }
    return {
      action: "status",
      data: {
        tutorEmail: user.tutorEmail,
        studentEmail: user.email,
        status: "active",
        room: "no room",  // 홈은 "no room"
        assignedAt: new Date().toISOString().split("T")[0],
      }
    };
  },[user?.email]);

  const socket = useWebSocket(getData, {
    sendImmediately: true,
    enableInterval: true,
    interval: 5000,
    onMessage: handleWebSocketMessage  // 메시지 핸들러 추가
  });

  const formatTimeSec = (sec) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    if (m <= 0) return `${s}초`;
    return `${m}분 ${s}초`;
  };

  const goalMinutes = 20;
  const todayMinutes = Math.round(todayTimeSec / 60);
  // 초 단위로 정확한 퍼센테이지 계산 (분 단위 변환 후 계산하면 오차 발생)
  const goalSeconds = goalMinutes * 60;
  const goalPercent = Math.min(100, Math.round((todayTimeSec / goalSeconds) * 100));

  const circle = useMemo(() => {
    const r = 110;
    const c = 2 * Math.PI * r;
    const offset = c * (1 - goalPercent / 100);
    return { r, c, offset };
  }, [goalPercent]);

  return (
    <>
      <StudentLayout 
        todayTime={todayMinutes}
        onTutorSearchClick={() => setTutorSearchOpen(true)}
        unreadNotificationCount={unreadCount}
      >
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left */}
          <div className="lg:col-span-2 flex flex-col gap-6">
            <div className="bg-white dark:bg-background-dark rounded-xl shadow-[0_4px_20px_rgba(0,0,0,0.03)] overflow-hidden border border-[#e5e7eb] dark:border-[#2d3748] p-6">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div>
                  <h2 className="text-[#111418] dark:text-white text-[22px] font-bold tracking-tight">
                    오늘의 학습 현황
                  </h2>
                  <p className="text-[#617589] dark:text-[#a0aec0] text-sm">
                    학습 시간을 쌓아서 목표를 달성해보세요.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-2 rounded-lg h-10 px-4 bg-background-light dark:bg-[#0d141c] border border-[#e5e7eb] dark:border-[#2d3748] text-sm font-bold">
                    <span className="material-symbols-outlined text-[18px] text-primary">timer</span>
                    {formatTimeSec(todayTimeSec)}
                  </div>
                  <div className="flex items-center gap-2 rounded-lg h-10 px-4 bg-background-light dark:bg-[#0d141c] border border-[#e5e7eb] dark:border-[#2d3748] text-sm font-bold">
                    <span className="material-symbols-outlined text-[18px] text-primary">graphic_eq</span>
                    발화 {speakingRatio}%
                  </div>
                </div>
              </div>

              <div className="mt-5">
                <div className="flex justify-between items-center mb-2">
                  <p className="text-[#111418] dark:text-white text-sm font-semibold">오늘의 발화 밀도</p>
                  <p className="text-[#617589] dark:text-[#a0aec0] text-xs">
                    {avgNetSpeakingDensity ? `${avgNetSpeakingDensity.toFixed(0)}%` : '-'}
                  </p>
                </div>
                <div className="w-full bg-[#dbe0e6] dark:bg-[#2d3748] h-2 rounded-full overflow-hidden">
                  <div className="bg-primary h-full transition-all" style={{ width: `${Math.min(100, Math.max(0, speakingRatio))}%` }} />
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between mt-1 px-1">
              <h2 className="text-[#111418] dark:text-white text-[22px] font-bold tracking-tight">
                AI Training Modes
              </h2>
              <button type="button" className="text-primary text-sm font-semibold hover:underline" onClick={() => alert('준비중입니다.')}>
                View All
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="group bg-white dark:bg-background-dark p-6 rounded-xl border border-[#e5e7eb] dark:border-[#2d3748] hover:border-primary transition-all hover:shadow-lg">
                <div className="w-12 h-12 rounded-lg bg-blue-50 dark:bg-primary/20 flex items-center justify-center text-primary mb-4 group-hover:scale-110 transition-transform">
                  <span className="material-symbols-outlined text-[28px]">format_quote</span>
                </div>
                <h4 className="text-[#111418] dark:text-white text-lg font-bold mb-1">Sentence Practice</h4>
                <p className="text-[#617589] dark:text-[#a0aec0] text-sm leading-relaxed mb-4">
                  문장을 따라 읽고, STT로 발화 데이터를 기록합니다.
                </p>

                <div className="grid grid-cols-3 gap-2 mb-3">
                  {['하', '중', '상'].map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setPracticeDifficulty(d)}
                      className={`h-10 rounded-full text-sm font-bold border transition ${
                        practiceDifficulty === d
                          ? 'bg-primary text-white border-primary'
                          : 'bg-white dark:bg-transparent text-[#111418] dark:text-white border-[#dbe0e6] dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-white/5'
                      }`}
                    >
                      {d}
                    </button>
                  ))}
                </div>

                <select
                  className="form-select w-full rounded-full text-[#111418] dark:text-white border border-[#dbe0e6] dark:border-gray-700 bg-white dark:bg-background-dark/50 focus:border-primary focus:ring-4 focus:ring-primary/10 h-11 px-5 text-sm font-semibold transition-all"
                  value={practiceTopicId}
                  onChange={(e) => setPracticeTopicId(e.target.value)}
                >
                  {scenarios.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.title}
                    </option>
                  ))}
                </select>

                <div className="mt-4 flex items-center justify-between">
                  <div className="flex items-center text-primary text-xs font-bold uppercase tracking-widest">
                    Start Training <span className="material-symbols-outlined ml-1 text-[16px]">arrow_forward</span>
                  </div>
                  <button
                    type="button"
                    disabled={whisperStatus !== 'ready'}
                    onClick={() => {
                      persistPracticeConfig(practiceDifficulty, practiceTopicId);
                      navigate('/practice', {
                        state: { difficulty: practiceDifficulty, topicId: practiceTopicId, startNonce: Date.now() },
                      });
                    }}
                    className="bg-primary hover:bg-primary/90 text-white font-bold py-2 px-5 rounded-lg text-sm transition-all shadow-lg shadow-primary/20 disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {whisperStatus === 'loading' ? 'STT 로딩 중...' : '시작'}
                  </button>
                </div>
              </div>

              <div className="group bg-white dark:bg-background-dark p-6 rounded-xl border border-[#e5e7eb] dark:border-[#2d3748] hover:border-primary transition-all hover:shadow-lg">
                <div className="w-12 h-12 rounded-lg bg-purple-50 dark:bg-purple-900/20 flex items-center justify-center text-purple-600 dark:text-purple-400 mb-4 group-hover:scale-110 transition-transform">
                  <span className="material-symbols-outlined text-[28px]">forum</span>
                </div>
                <h4 className="text-[#111418] dark:text-white text-lg font-bold mb-1">AI Conversation</h4>
                <p className="text-[#617589] dark:text-[#a0aec0] text-sm leading-relaxed mb-4">
                  AI와 대화하며 자연스러운 표현을 연습합니다.
                </p>

                <div className="grid grid-cols-3 gap-2 mb-3">
                  {['하', '중', '상'].map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setChatDifficulty(d)}
                      className={`h-10 rounded-full text-sm font-bold border transition ${
                        chatDifficulty === d
                          ? 'bg-primary text-white border-primary'
                          : 'bg-white dark:bg-transparent text-[#111418] dark:text-white border-[#dbe0e6] dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-white/5'
                      }`}
                    >
                      {d}
                    </button>
                  ))}
                </div>

                <select
                  className="form-select w-full rounded-full text-[#111418] dark:text-white border border-[#dbe0e6] dark:border-gray-700 bg-white dark:bg-background-dark/50 focus:border-primary focus:ring-4 focus:ring-primary/10 h-11 px-5 text-sm font-semibold transition-all"
                  value={chatScenario}
                  onChange={(e) => setChatScenario(e.target.value)}
                >
                  {scenarios.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.title}
                    </option>
                  ))}
                </select>

                <div className="mt-4 flex items-center justify-between">
                  <div className="flex items-center text-purple-600 dark:text-purple-400 text-xs font-bold uppercase tracking-widest">
                    Enter Session <span className="material-symbols-outlined ml-1 text-[16px]">arrow_forward</span>
                  </div>
                  <button
                    type="button"
                    disabled={whisperStatus !== 'ready'}
                    onClick={() => {
                      persistChatConfig(chatDifficulty, chatScenario);
                      navigate('/chat', { state: { difficulty: chatDifficulty, scenario: chatScenario } });
                    }}
                    className="bg-primary hover:bg-primary/90 text-white font-bold py-2 px-5 rounded-lg text-sm transition-all shadow-lg shadow-primary/20 disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {whisperStatus === 'loading' ? 'STT 로딩 중...' : '입장'}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Right */}
          <div className="flex flex-col gap-6">
            <div className="bg-white dark:bg-background-dark p-6 rounded-xl shadow-[0_4px_20px_rgba(0,0,0,0.03)] border border-[#e5e7eb] dark:border-[#2d3748]">
              <h3 className="text-[#111418] dark:text-white text-lg font-bold mb-6">Daily Goal</h3>
              <div className="flex flex-col items-center justify-center py-2 relative">
                <div className="relative w-64 h-64 flex items-center justify-center">
                  <svg className="w-full h-full transform -rotate-90">
                    <circle className="text-[#dbe0e6] dark:text-[#2d3748]" cx="128" cy="128" fill="transparent" r={circle.r} stroke="currentColor" strokeWidth="12" />
                    <circle className="text-primary" cx="128" cy="128" fill="transparent" r={circle.r} stroke="currentColor" strokeDasharray={circle.c} strokeDashoffset={circle.offset} strokeLinecap="round" strokeWidth="12" />
                  </svg>
                  <div className="absolute flex flex-col items-center">
                    <span className="text-4xl font-black text-[#111418] dark:text-white">{todayMinutes}</span>
                    <span className="text-xs text-[#617589] dark:text-[#a0aec0] font-medium uppercase tracking-tighter">Minutes</span>
                  </div>
                </div>
              </div>
              <div className="mt-6 space-y-3">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-[#617589] dark:text-[#a0aec0]">Today's Target</span>
                  <span className="font-bold text-[#111418] dark:text-white">{goalMinutes} mins</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-[#617589] dark:text-[#a0aec0]">Progress</span>
                  <span className="font-bold text-[#111418] dark:text-white">{goalPercent}%</span>
                </div>
              </div>
            </div>

            <div className="bg-primary/5 dark:bg-primary/10 p-5 rounded-xl border border-primary/20">
              <div className="flex gap-3">
                <span className="material-symbols-outlined text-primary">lightbulb</span>
                <div className="flex flex-col gap-1">
                  <p className="text-sm font-bold text-[#111418] dark:text-white leading-tight">AI Recommendation</p>
                  <p className="text-xs text-[#617589] dark:text-[#a0aec0] leading-normal">
                    오늘은 5분만이라도 AI Conversation에 들어가서 “자기소개”로 워밍업을 해보세요.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
    </StudentLayout>

    {/* 튜터 검색 다이얼로그 (알림 표시 포함) */}
    <TutorSearchDialog
      open={tutorSearchOpen}
      onClose={() => setTutorSearchOpen(false)}
      onUpdate={loadUnreadCount}
    />
    
    {/* 실시간 알림 Snackbar */}
    <Snackbar
      open={snackbar.open}
      autoHideDuration={6000}
      onClose={() => setSnackbar({ ...snackbar, open: false })}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
    >
      <Alert
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        severity={snackbar.severity}
      >
        {snackbar.message}
      </Alert>
    </Snackbar>
    </>
  );
}
