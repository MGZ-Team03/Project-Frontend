// 튜터 - 학생 상세 페이지 (Tailwind CSS)

import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import TutorLayout from '../../components/common/TutorLayout';
import FeedbackNotification from '../../components/tutor/FeedbackNotification';
import useFeedbackSender from '../../hooks/useFeedbackSender';
import { getFeedbackHistory } from '../../api/tutorFeedback';

// 목업 학생 상세 데이터
const MOCK_STUDENT = {
  email: 'hwplus@gmail.com',
  name: '홍길동',
  activity: 'sentence',
  status: 'speaking',
  speakingRatio: 75,
  todayDuration: 45,
  totalDuration: 2550, // 분 단위 (42.5시간)
  completedLessons: 18,
  currentSentence: 'Hello, how are you today?',
  level: 'B2 Upper Intermediate',
  joinedDate: '2024년 1월',
};

// 목업 7일 학습 이력
const MOCK_WEEKLY_DATA = [
  { day: 'Mon', duration: 45, percent: 80 },
  { day: 'Tue', duration: 32, percent: 60 },
  { day: 'Wed', duration: 58, percent: 95 },
  { day: 'Thu', duration: 20, percent: 40 },
  { day: 'Fri', duration: 0, percent: 0 },
  { day: 'Sat', duration: 25, percent: 50 },
  { day: 'Sun', duration: 50, percent: 85 },
];

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
  const tutorEmail = useSelector(state => state.auth.user?.email);
  
  const [feedbackHistory, setFeedbackHistory] = useState([]);
  const [feedbackLoading, setFeedbackLoading] = useState(true);
  const [feedbackText, setFeedbackText] = useState('');
  const [notification, setNotification] = useState(null);

  const student = MOCK_STUDENT; // 실제로는 email로 조회

  // 피드백 히스토리 불러오기
  useEffect(() => {
    const loadFeedbackHistory = async () => {
      try {
        setFeedbackLoading(true);
        const result = await getFeedbackHistory(student.email);
        
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

    if (student.email) {
      loadFeedbackHistory();
    }
  }, [student.email]);

  // useFeedbackSender 훅 사용
  const { send: sendFeedbackMessage, sending } = useFeedbackSender({
    tutorEmail,
    studentEmail: student.email,
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

  // 총 학습 시간 포맷
  const totalHours = (student.totalDuration / 60).toFixed(1);
  
  // 이번 주 총 학습 시간
  const weeklyTotal = MOCK_WEEKLY_DATA.reduce((sum, d) => sum + d.duration, 0);
  const weeklyTotalHours = (weeklyTotal / 60).toFixed(1);

  // 오늘 요일 인덱스 (일요일=0)
  const todayIndex = new Date().getDay();
  const dayMap = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const todayDay = dayMap[todayIndex];

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
      studentCount={8}
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
                  {student.name.charAt(0)}
                </div>
                <div className={`absolute bottom-1 right-1 size-5 rounded-full border-3 border-white dark:border-slate-800 ${
                  student.status === 'speaking' ? 'bg-green-500 animate-pulse' : 
                  student.status === 'listening' ? 'bg-yellow-500' : 'bg-gray-400'
                }`}></div>
              </div>
              
              {/* 학생 정보 */}
              <div className="space-y-2 flex-1">
                <div className="flex items-center gap-3">
                  <h2 className="text-2xl font-bold">{student.name}</h2>
                  <span className={`px-2.5 py-0.5 text-xs font-bold rounded-full uppercase tracking-wider ${
                    student.status === 'speaking' 
                      ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                      : student.status === 'listening'
                      ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                      : 'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400'
                  }`}>
                    {student.status === 'speaking' ? '학습 중' : student.status === 'listening' ? '듣기만' : '오프라인'}
                  </span>
                </div>
                <p className="text-slate-500 dark:text-slate-400">{student.email}</p>
                <div className="flex items-center gap-2 text-[#137fec] font-semibold text-sm">
                  <span className="material-symbols-outlined text-lg">
                    {student.activity === 'sentence' ? 'format_quote' : 'forum'}
                  </span>
                  {student.activity === 'sentence' 
                    ? `문장 연습 중: "${student.currentSentence}"`
                    : 'AI 대화 진행 중'
                  }
                </div>
              </div>
            </div>
          </section>

          {/* 통계 카드 3개 */}
          <section className="grid grid-cols-3 gap-4">
            {/* 총 학습 시간 */}
            <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col gap-1">
              <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 mb-1">
                <span className="material-symbols-outlined text-xl text-[#137fec]">schedule</span>
                <p className="text-xs font-bold uppercase tracking-wider">총 학습 시간</p>
              </div>
              <p className="text-3xl font-black">{totalHours}h</p>
              <span className="text-green-500 text-xs font-bold flex items-center gap-1">
                <span className="material-symbols-outlined text-xs">trending_up</span> +{weeklyTotalHours}h 이번 주
              </span>
            </div>

            {/* 완료한 레슨 */}
            <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col gap-1">
              <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 mb-1">
                <span className="material-symbols-outlined text-xl text-[#137fec]">menu_book</span>
                <p className="text-xs font-bold uppercase tracking-wider">완료한 레슨</p>
              </div>
              <p className="text-3xl font-black">{student.completedLessons}</p>
              <span className="text-slate-400 text-xs font-medium">다음 목표: Unit 5 완료</span>
            </div>

            {/* 발음 성과 */}
            <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col gap-1">
              <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 mb-1">
                <span className="material-symbols-outlined text-xl text-[#137fec]">analytics</span>
                <p className="text-xs font-bold uppercase tracking-wider">발음 비율</p>
              </div>
              <div className="flex items-baseline gap-2">
                <p className="text-3xl font-black text-[#137fec]">{student.speakingRatio}%</p>
              </div>
              <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full mt-1">
                <div 
                  className="bg-[#137fec] h-full rounded-full shadow-[0_0_8px_rgba(19,127,236,0.3)] transition-all duration-500"
                  style={{ width: `${student.speakingRatio}%` }}
                ></div>
              </div>
            </div>
          </section>

          {/* 7일 학습 히스토리 */}
          <section className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl font-bold">7일 학습 히스토리</h2>
                <p className="text-slate-500 text-sm">일별 학습 시간 및 활동량</p>
              </div>
              <button className="px-3 py-1.5 text-[#137fec] text-sm font-bold border border-[#137fec]/20 hover:bg-[#137fec]/5 rounded-lg transition-colors">
                상세 분석 보기
              </button>
            </div>

            <div className="grid grid-cols-7 gap-4">
              {MOCK_WEEKLY_DATA.map((data) => {
                const isToday = data.day === todayDay;
                const hasData = data.percent > 0;
                
                return (
                  <div key={data.day} className="group flex flex-col items-center gap-3">
                    <div className={`relative h-36 w-10 rounded-xl overflow-hidden border ${
                      isToday 
                        ? 'bg-[#137fec]/5 dark:bg-[#137fec]/10 border-2 border-[#137fec]/30'
                        : hasData 
                        ? 'bg-slate-50 dark:bg-slate-800/50 border-slate-100 dark:border-slate-800'
                        : 'bg-slate-50 dark:bg-slate-800/50 border-dashed border-slate-200 dark:border-slate-800'
                    }`}>
                      {hasData && (
                        <div 
                          className={`absolute bottom-0 left-0 w-full rounded-t-lg transition-all group-hover:opacity-80 ${
                            isToday 
                              ? 'bg-[#137fec] shadow-[0_0_15px_rgba(19,127,236,0.5)]'
                              : 'bg-[#137fec]/40 group-hover:bg-[#137fec]/60'
                          }`}
                          style={{ height: `${data.percent}%` }}
                        ></div>
                      )}
                    </div>
                    <div className="text-center">
                      <p className={`text-[10px] font-bold uppercase tracking-widest mb-0.5 ${
                        isToday ? 'text-[#137fec]' : 'text-slate-400'
                      }`}>{data.day}</p>
                      <p className={`text-xs font-bold ${
                        isToday ? 'text-[#137fec]' : hasData ? '' : 'text-slate-300'
                      }`}>{data.duration}m</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        </div>

        {/* 오른쪽: 피드백 채팅 패널 (고정) */}
        <aside className="w-96 shrink-0 sticky top-6">
          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-lg border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col h-[calc(100vh-180px)]">
            {/* 헤더 */}
            <div className="bg-[#137fec] p-4 flex items-center justify-between text-white shrink-0">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <div className="size-10 rounded-full bg-white/20 flex items-center justify-center text-lg font-bold">
                    {student.name.charAt(0)}
                  </div>
                  <span className={`absolute bottom-0 right-0 size-3 border-2 border-[#137fec] rounded-full ${
                    student.status === 'speaking' ? 'bg-green-400' : 'bg-gray-400'
                  }`}></span>
                </div>
                <div>
                  <h4 className="font-semibold text-sm leading-tight">피드백 보내기</h4>
                  <p className="text-[10px] text-white/80 uppercase tracking-wider font-bold">
                    {student.name} • {student.status === 'speaking' ? '온라인' : '오프라인'}
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
