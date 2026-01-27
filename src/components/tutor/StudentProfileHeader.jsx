import { useNavigate } from 'react-router-dom';

export default function StudentProfileHeader({ 
  student, 
  email, 
  activityBadge,
  loadingStudents 
}) {
  const navigate = useNavigate();
  const studentName = student?.name || '이름 없음';
  const studentStatus = student?.status || 'inactive';

  return (
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
  );
}
