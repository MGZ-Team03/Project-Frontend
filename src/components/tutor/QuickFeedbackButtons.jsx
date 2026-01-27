const QUICK_FEEDBACKS = [
  '잘하고 있어요!',
  '조금만 더 연습해요',
  '발음이 좋아요',
  '천천히 말해보세요',
];

export default function QuickFeedbackButtons({ onQuickFeedback, disabled = false }) {
  return (
    <div className="flex flex-wrap gap-2">
      {QUICK_FEEDBACKS.map((text) => (
        <button
          key={text}
          onClick={() => onQuickFeedback(text)}
          disabled={disabled}
          className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 text-[11px] font-bold rounded-lg hover:bg-[#137fec] hover:text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-slate-100 disabled:hover:text-current"
        >
          {text}
        </button>
      ))}
    </div>
  );
}
