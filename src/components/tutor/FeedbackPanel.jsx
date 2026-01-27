import { useEffect, useRef } from 'react';
import QuickFeedbackButtons from './QuickFeedbackButtons';

export default function FeedbackPanel({
  studentName,
  studentStatus,
  studentActivity,
  feedbackHistory,
  feedbackLoading,
  feedbackText,
  setFeedbackText,
  sending,
  onSendFeedback,
  onTTSFeedback,
  onQuickFeedback,
}) {
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [feedbackHistory]);

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSendFeedback();
    }
  };

  // AI 대화 또는 문장 연습 중일 때만 피드백 가능
  const canSendFeedback = studentActivity === 'conversation' || studentActivity === 'sentence';

  return (
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
          <div ref={messagesEndRef} />
        </div>

        {/* 입력 영역 */}
        <div className="p-4 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 shrink-0 space-y-3">
          {!canSendFeedback && (
            <div className="px-3 py-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-lg">
              <p className="text-xs text-amber-800 dark:text-amber-200 font-semibold text-center">
                💬 학생이 AI 대화 또는 문장 연습 중일 때만 피드백을 보낼 수 있습니다
              </p>
            </div>
          )}
          
          <QuickFeedbackButtons 
            onQuickFeedback={onQuickFeedback}
            disabled={!canSendFeedback}
          />

          {/* 입력창 */}
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={feedbackText}
              onChange={(e) => setFeedbackText(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder={canSendFeedback ? "피드백을 입력하세요..." : "학생이 학습 중이 아닙니다"}
              disabled={sending || !canSendFeedback}
              className="flex-1 px-4 py-3 bg-slate-100 dark:bg-slate-800 border-none rounded-xl text-sm focus:ring-2 focus:ring-[#137fec] focus:bg-white dark:focus:bg-slate-800 transition-all placeholder:text-slate-400 disabled:opacity-60 disabled:cursor-not-allowed disabled:pointer-events-none"
            />
            <button
              onClick={onTTSFeedback}
              disabled={!feedbackText.trim() || sending || !canSendFeedback}
              className="h-10 px-4 bg-orange-500 text-white rounded-xl flex items-center justify-center gap-1.5 hover:bg-orange-600 shadow-lg shadow-orange-500/30 transition-all disabled:opacity-50 disabled:shadow-none shrink-0 font-bold text-sm"
              title="TTS로 전송 (음성)"
            >
              <span className="material-symbols-outlined text-lg">
                {sending ? 'hourglass_empty' : 'volume_up'}
              </span>
              {!sending && 'TTS'}
            </button>
            <button
              onClick={onSendFeedback}
              disabled={!feedbackText.trim() || sending || !canSendFeedback}
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
  );
}
