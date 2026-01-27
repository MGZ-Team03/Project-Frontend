// 실시간 활동 사이드바 컴포넌트

export default function RealTimeActivitySidebar({ 
  recentActivities, 
  activeStudents, 
  totalStudents,
  loading, 
  error 
}) {
  return (
    <aside className="w-80 space-y-4 shrink-0">
      {/* 실시간 활동 */}
      <div className="bg-white dark:bg-[#101922] rounded-xl border border-[#dbe0e6] dark:border-gray-800 p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-bold flex items-center gap-2">
            <span className="size-2 rounded-full bg-red-500 animate-pulse"></span>
            실시간 활동
          </h3>
          <span className="text-[10px] text-[#617589] font-semibold uppercase">Live</span>
        </div>
        <div className="space-y-4">
          {recentActivities.length === 0 ? (
            <p className="text-sm text-[#617589] text-center py-4">활동 중인 학생이 없습니다</p>
          ) : (
            recentActivities.map((activity) => (
              <div key={activity.email} className="flex gap-3">
                <div className="size-8 rounded-full bg-[#137fec] flex items-center justify-center text-white text-xs font-semibold shrink-0">
                  {activity.name?.charAt(0) || '?'}
                </div>
                <div>
                  <p className="text-xs">
                    <span className="font-semibold">{activity.name}</span>
                    {' '}
                    <span className="font-semibold text-[#137fec]">'{activity.activity}'</span> 진행 중
                  </p>
                  <p className="text-[10px] text-[#617589] mt-1">{activity.time}</p>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* 시스템 상태 */}
      <div className="bg-[#137fec]/10 rounded-xl border border-[#137fec]/20 p-5">
        <h4 className="text-[#137fec] text-xs font-bold uppercase mb-3">연결 상태</h4>
        <div className="space-y-3">
          <div className="flex justify-between items-center text-xs">
            <span className="text-[#617589]">API 연결</span>
            <span className={`font-bold ${loading ? 'text-yellow-600' : error ? 'text-red-600' : 'text-green-600'}`}>
              {loading ? '로딩 중' : error ? '연결 오류' : '정상'}
            </span>
          </div>
          <div className="w-full h-1.5 bg-[#137fec]/20 rounded-full">
            <div className={`h-full rounded-full transition-all duration-300 ${loading ? 'w-1/2 bg-yellow-500' : error ? 'w-1/4 bg-red-500' : 'w-full bg-green-500'}`}></div>
          </div>
          <div className="flex justify-between items-center text-xs">
            <span className="text-[#617589]">활성 학생</span>
            <span className="font-bold">{activeStudents.length} / {totalStudents}</span>
          </div>
          <div className="flex justify-between items-center text-xs">
            <span className="text-[#617589]">자동 새로고침</span>
            <span className="font-bold text-[#137fec]">60초</span>
          </div>
        </div>
      </div>
    </aside>
  );
}
