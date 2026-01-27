// 통계 요약 카드 컴포넌트

export default function StatsSummaryCards({ summary }) {
  return (
    <div className="grid grid-cols-3 gap-6">
      {/* 전체 학생 */}
      <div className="flex flex-col gap-2 rounded-xl p-6 border border-[#dbe0e6] dark:border-gray-800 bg-white dark:bg-[#101922]">
        <p className="text-[#617589] text-sm font-medium">전체 학생</p>
        <p className="text-[#111418] dark:text-white tracking-tight text-3xl font-bold">
          {summary.total}
        </p>
        <p className="text-[#078838] text-sm font-medium flex items-center gap-1">
          <span className="material-symbols-outlined text-sm">group</span> 등록됨
        </p>
      </div>

      {/* 활성 학생 */}
      <div className="flex flex-col gap-2 rounded-xl p-6 border border-[#dbe0e6] dark:border-gray-800 bg-white dark:bg-[#101922]">
        <p className="text-[#617589] text-sm font-medium">활성 학생</p>
        <p className="text-[#111418] dark:text-white tracking-tight text-3xl font-bold">
          {summary.active}
        </p>
        <p className="text-[#078838] text-sm font-medium flex items-center gap-1">
          <span className="material-symbols-outlined text-sm">trending_up</span> 온라인
        </p>
      </div>

      {/* 학습 중 */}
      <div className="flex flex-col gap-2 rounded-xl p-6 border border-[#dbe0e6] dark:border-gray-800 bg-white dark:bg-[#101922]">
        <p className="text-[#617589] text-sm font-medium">학습 중</p>
        <p className="text-[#111418] dark:text-white tracking-tight text-3xl font-bold">
          {summary.speaking}
        </p>
        <p className="text-[#078838] text-sm font-medium flex items-center gap-1">
          <span className="material-symbols-outlined text-sm">mic</span> 대화/연습
        </p>
      </div>
    </div>
  );
}
