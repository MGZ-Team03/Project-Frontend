export default function WeeklySummary({ weeklySummary }) {
  return (
    <section className="bg-white dark:bg-[#1a242f] rounded-xl p-8 border border-[#dbe0e6] dark:border-gray-800 shadow-sm">
      <div className="flex items-center justify-between mb-6">
        <h3 className="font-black text-xl text-[#111418] dark:text-white">Weekly Summary</h3>
        <span className="text-xs font-black text-primary bg-primary/10 px-2 py-1 rounded">This Week</span>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="text-center p-4 bg-background-light dark:bg-gray-800 rounded-xl border border-[#dbe0e6]/60 dark:border-gray-700">
          <p className="text-3xl font-black text-primary">{weeklySummary?.speakingRatio ?? 0}%</p>
          <p className="text-xs font-semibold text-[#617589] dark:text-gray-400 mt-1">발화 비율</p>
        </div>
        <div className="text-center p-4 bg-background-light dark:bg-gray-800 rounded-xl border border-[#dbe0e6]/60 dark:border-gray-700">
          <p className="text-3xl font-black text-green-600 dark:text-green-400">
            {weeklySummary?.avgQuality ?? '0.0'}점
          </p>
          <p className="text-xs font-semibold text-[#617589] dark:text-gray-400 mt-1">평균 품질</p>
        </div>
        <div className="text-center p-4 bg-background-light dark:bg-gray-800 rounded-xl border border-[#dbe0e6]/60 dark:border-gray-700">
          <p className="text-3xl font-black text-yellow-600 dark:text-yellow-400">
            {weeklySummary?.tutorFeedbacks ?? 0}
          </p>
          <p className="text-xs font-semibold text-[#617589] dark:text-gray-400 mt-1">튜터 피드백</p>
        </div>
        <div className="text-center p-4 bg-background-light dark:bg-gray-800 rounded-xl border border-[#dbe0e6]/60 dark:border-gray-700">
          <p className="text-3xl font-black text-sky-600 dark:text-sky-400">
            {weeklySummary?.paceRatio ?? '0.00'}
          </p>
          <p className="text-xs font-semibold text-[#617589] dark:text-gray-400 mt-1">속도 비율</p>
        </div>
      </div>

      <div className="h-px bg-[#dbe0e6] dark:bg-gray-800 my-6" />

      <div className="flex items-end justify-between">
        <div>
          <p className="text-xs font-semibold text-[#617589] dark:text-gray-400">이번 주 총합</p>
          <p className="text-2xl font-black text-[#111418] dark:text-white">{weeklySummary?.totalMinutes ?? '-'}</p>
        </div>
        <div className="text-right">
          <p className="text-xs font-semibold text-[#617589] dark:text-gray-400">이번 주 세션</p>
          <p className="text-2xl font-black text-[#111418] dark:text-white">
            {weeklySummary?.totalSessions ?? 0}회
          </p>
        </div>
      </div>
    </section>
  );
}
