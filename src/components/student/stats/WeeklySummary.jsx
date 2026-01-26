// 시간 포맷 유틸: ms를 "X분 Y초" 형태로 변환
function formatTime(ms) {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  if (minutes === 0) {
    return `${seconds}초`;
  }
  if (seconds === 0) {
    return `${minutes}분`;
  }
  return `${minutes}분 ${seconds}초`;
}

export default function WeeklySummary({ weeklySummary }) {
  return (
    <section className="bg-white dark:bg-[#1a242f] rounded-xl p-6 border border-[#dbe0e6] dark:border-gray-800 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-black text-lg text-[#111418] dark:text-white">이번 주 요약</h3>
        <span className="text-xs font-black text-primary bg-primary/10 px-2 py-1 rounded">이번 주</span>
      </div>

      {/* 기본 통계 (4열) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
        <div className="text-center p-4 bg-background-light dark:bg-gray-800 rounded-xl border border-[#dbe0e6]/60 dark:border-gray-700">
          <p className="text-2xl font-black text-[#111418] dark:text-white">
            {formatTime(weeklySummary?.totalRecordingTime || 0)}
          </p>
          <p className="text-xs font-semibold text-[#617589] dark:text-gray-400 mt-1">총 학습 시간</p>
        </div>
        <div className="text-center p-4 bg-background-light dark:bg-gray-800 rounded-xl border border-[#dbe0e6]/60 dark:border-gray-700">
          <p className="text-2xl font-black text-[#111418] dark:text-white">
            {formatTime(weeklySummary?.totalSpeakingTime || 0)}
          </p>
          <p className="text-xs font-semibold text-[#617589] dark:text-gray-400 mt-1">총 발화 시간</p>
        </div>
        <div className="text-center p-4 bg-background-light dark:bg-gray-800 rounded-xl border border-[#dbe0e6]/60 dark:border-gray-700">
          <p className="text-2xl font-black text-[#111418] dark:text-white">
            {weeklySummary?.practiceCount ?? 0}회
          </p>
          <p className="text-xs font-semibold text-[#617589] dark:text-gray-400 mt-1">문장 연습</p>
        </div>
        <div className="text-center p-4 bg-background-light dark:bg-gray-800 rounded-xl border border-[#dbe0e6]/60 dark:border-gray-700">
          <p className="text-2xl font-black text-[#111418] dark:text-white">
            {weeklySummary?.chatTurnsCount ?? 0}회
          </p>
          <p className="text-xs font-semibold text-[#617589] dark:text-gray-400 mt-1">AI 대화</p>
        </div>
      </div>

      {/* 품질 지표 (3열) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="text-center p-4 bg-background-light dark:bg-gray-800 rounded-xl border border-[#dbe0e6]/60 dark:border-gray-700">
          <p className="text-3xl font-black text-primary">{weeklySummary?.speakingRatio ?? 0}%</p>
          <p className="text-xs font-semibold text-[#617589] dark:text-gray-400 mt-1">발화율</p>
        </div>
        <div className="text-center p-4 bg-background-light dark:bg-gray-800 rounded-xl border border-[#dbe0e6]/60 dark:border-gray-700">
          <p className="text-3xl font-black text-yellow-600 dark:text-yellow-400">
            {weeklySummary?.avgQuality ?? '0.0'}점
          </p>
          <p className="text-xs font-semibold text-[#617589] dark:text-gray-400 mt-1">응답 품질</p>
        </div>
        <div className="text-center p-4 bg-background-light dark:bg-gray-800 rounded-xl border border-[#dbe0e6]/60 dark:border-gray-700">
          <p className="text-3xl font-black text-sky-600 dark:text-sky-400">
            {weeklySummary?.paceRatio ?? '0.00'}
          </p>
          <p className="text-xs font-semibold text-[#617589] dark:text-gray-400 mt-1">속도 비율</p>
        </div>
      </div>
    </section>
  );
}
