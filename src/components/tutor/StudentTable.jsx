// 학생 테이블 컴포넌트

import { useState, useMemo } from 'react';
import { getStatusStyles, getStatusLabel, getLevelInfo, getLastActiveText } from '../../utils/dashboardHelpers';

export default function StudentTable({ 
  students, 
  loading, 
  error,
  onStudentClick, 
  onFeedbackClick,
  onRefresh
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [levelFilter, setLevelFilter] = useState('all');

  // 필터링된 학생 목록
  const filteredStudents = useMemo(() => {
    return students.filter(student => {
      // 검색 필터
      const matchesSearch = !searchQuery || 
        student.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        student.email?.toLowerCase().includes(searchQuery.toLowerCase());
      
      // 상태 필터
      const matchesStatus = statusFilter === 'all' || student.statusLabel === statusFilter;
      
      // 레벨 필터
      let matchesLevel = true;
      if (levelFilter !== 'all') {
        const level = getLevelInfo(student.speakingRatio || 0).label.toLowerCase();
        matchesLevel = level === levelFilter.toLowerCase();
      }
      
      return matchesSearch && matchesStatus && matchesLevel;
    });
  }, [students, searchQuery, statusFilter, levelFilter]);

  return (
    <div className="flex-1 bg-white dark:bg-[#101922] rounded-xl border border-[#dbe0e6] dark:border-gray-800 overflow-hidden">
      {/* 검색 및 필터 */}
      <div className="p-4 border-b border-[#dbe0e6] dark:border-gray-800 flex flex-wrap gap-3 items-center">
        <div className="flex-1 min-w-[300px]">
          <label className="flex items-center h-10 w-full bg-[#f0f2f4] dark:bg-gray-800 rounded-lg px-3 gap-2 border border-transparent focus-within:border-[#137fec]/30 transition-all">
            <span className="material-symbols-outlined text-[#617589]">search</span>
            <input 
              className="bg-transparent border-none focus:ring-0 focus:outline-none text-sm w-full placeholder:text-[#617589]" 
              placeholder="이름, 이메일로 검색..." 
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </label>
        </div>
        <div className="flex gap-2">
          <select 
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="flex h-10 items-center justify-center gap-2 rounded-lg bg-[#f0f2f4] dark:bg-gray-800 pl-4 pr-10 text-sm font-medium hover:bg-[#e4e6e9] dark:hover:bg-gray-700 transition-colors border-none focus:ring-0 cursor-pointer"
          >
            <option value="all">상태: 전체</option>
            <option value="online">온라인</option>
            <option value="ai">AI 대화중</option>
            <option value="sentence">문장 연습중</option>
            <option value="away">자리비움</option>
            <option value="offline">오프라인</option>
          </select>
          <select 
            value={levelFilter}
            onChange={(e) => setLevelFilter(e.target.value)}
            className="flex h-10 items-center justify-center gap-2 rounded-lg bg-[#f0f2f4] dark:bg-gray-800 px-4 text-sm font-medium hover:bg-[#e4e6e9] dark:hover:bg-gray-700 transition-colors border-none focus:ring-0 cursor-pointer"
          >
            <option value="all">레벨: 전체</option>
            <option value="advanced">Advanced</option>
            <option value="intermediate">Intermediate</option>
            <option value="elementary">Elementary</option>
            <option value="beginner">Beginner</option>
          </select>
        </div>
      </div>

      {/* 테이블 */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-[#f0f2f4]/50 dark:bg-gray-800/50 text-[#617589] text-xs font-semibold uppercase tracking-wider">
              <th className="px-6 py-4">학생</th>
              <th className="px-6 py-4">상태</th>
              <th className="px-6 py-4">발음 레벨</th>
              <th className="px-6 py-4">마지막 활동</th>
              <th className="px-6 py-4 text-right">액션</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#dbe0e6] dark:divide-gray-800">
            {loading ? (
              <tr key="loading">
                <td colSpan={5} className="px-6 py-12 text-center">
                  <div className="flex items-center justify-center gap-2 text-[#617589]">
                    <span className="material-symbols-outlined animate-spin">progress_activity</span>
                    로딩 중...
                  </div>
                </td>
              </tr>
            ) : filteredStudents.length === 0 ? (
              <tr key="empty">
                <td colSpan={5} className="px-6 py-12 text-center text-[#617589]">
                  {students.length === 0 ? '등록된 학생이 없습니다.' : '검색 결과가 없습니다.'}
                </td>
              </tr>
            ) : (
              filteredStudents.map((student) => {
                const statusStyles = getStatusStyles(student.statusLabel);
                const levelInfo = getLevelInfo(student.speakingRatio || 0);
                
                return (
                  <tr 
                    key={student.email} 
                    className="hover:bg-[#f6f7f8] dark:hover:bg-gray-800/30 transition-colors cursor-pointer"
                    onClick={() => onStudentClick(student.email)}
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="size-9 rounded-full bg-[#137fec] flex items-center justify-center text-white font-semibold text-sm">
                          {student.name?.charAt(0) || '?'}
                        </div>
                        <div>
                          <p className="text-sm font-semibold flex items-center gap-2">
                            {student.name || '이름 없음'}
                            <span className="text-base">{student.emoji}</span>
                          </p>
                          <p className="text-xs text-[#617589]">{student.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${statusStyles.bg} ${statusStyles.text}`}>
                        <span className={`size-1.5 rounded-full ${statusStyles.dot}`}></span>
                        {getStatusLabel(student.statusLabel)}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col gap-1">
                        <span className={`text-xs font-semibold ${levelInfo.color}`}>
                          {levelInfo.label}
                        </span>
                        <div className="w-24 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                          <div 
                            className="bg-[#137fec] h-full transition-all duration-300" 
                            style={{ width: `${student.speakingRatio || levelInfo.percent}%` }}
                          ></div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-[#617589]">
                      {getLastActiveText(student.updated_at)}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {(() => {
                          const canSendFeedback = ['ai', 'sentence'].includes(student.statusLabel) || 
                            (student.statusLabel === 'away' && ['ai', 'sentence'].includes(student.room));
                          
                          return (
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                if (canSendFeedback) {
                                  onFeedbackClick(student);
                                }
                              }}
                              disabled={!canSendFeedback}
                              className={`p-2 rounded-lg transition-colors ${
                                canSendFeedback
                                  ? 'text-[#617589] hover:text-[#137fec] hover:bg-[#137fec]/10 cursor-pointer'
                                  : 'text-gray-300 dark:text-gray-600 cursor-not-allowed'
                              }`}
                              title={
                                canSendFeedback
                                  ? '피드백 보내기'
                                  : '학습 중일 때만 피드백 가능'
                              }
                            >
                              <span className="material-symbols-outlined text-xl">chat</span>
                            </button>
                          );
                        })()}
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            onStudentClick(student.email);
                          }}
                          className="p-2 text-[#617589] hover:text-[#137fec] hover:bg-[#137fec]/10 rounded-lg transition-colors"
                          title="상세 보기"
                        >
                          <span className="material-symbols-outlined text-xl">visibility</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* 테이블 푸터 */}
      <div className="p-4 border-t border-[#dbe0e6] dark:border-gray-800 flex justify-between items-center">
        <p className="text-sm text-[#617589]">
          총 {filteredStudents.length}명의 학생
          {searchQuery && ` (검색: "${searchQuery}")`}
        </p>
        {/* API 상태 표시 */}
        <div className="flex items-center gap-3 text-xs text-[#617589]">
          <span className={`size-2 rounded-full ${loading ? 'bg-yellow-500' : error ? 'bg-red-500' : 'bg-green-500'}`}></span>
          {loading ? '로딩 중...' : error ? '연결 오류' : 'API 연결됨'}
          <span className="ml-2">자동 새로고침: 60초</span>
          <button
            onClick={onRefresh}
            disabled={loading}
            className="p-1.5 rounded-lg hover:bg-[#137fec]/10 text-[#617589] hover:text-[#137fec] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            title="새로고침"
          >
            <span className={`material-symbols-outlined text-base ${loading ? 'animate-spin' : ''}`}>
              {loading ? 'progress_activity' : 'refresh'}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
