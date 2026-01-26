// 튜터 실시간 모니터링 대시보드 (Tailwind CSS)

import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import TutorLayout from '../../components/common/TutorLayout';
import FeedbackNotification from '../../components/tutor/FeedbackNotification';
import FeedbackDialog from '../../components/tutor/FeedbackDialog';
import NotificationDialog from '../../components/tutor/NotificationDialog';
import useTutorNotifications from '../../hooks/tutor/useTutorNotifications';
import useTutorStudents from '../../hooks/tutor/useTutorStudents';
import useTutorFeedback from '../../hooks/tutor/useTutorFeedback';

// 상태별 색상
function getStatusStyles(status) {
  switch (status) {
    case 'speaking':
      return { bg: 'bg-green-100', text: 'text-green-800', dot: 'bg-green-500' };
    case 'listening':
      return { bg: 'bg-yellow-100', text: 'text-yellow-800', dot: 'bg-yellow-500' };
    case 'idle':
      return { bg: 'bg-orange-100', text: 'text-orange-800', dot: 'bg-orange-500' };
    case 'inactive':
    default:
      return { bg: 'bg-gray-100', text: 'text-gray-800', dot: 'bg-gray-400' };
  }
}

function getStatusLabel(status) {
  switch (status) {
    case 'speaking': return '학습 중';
    case 'listening': return '듣기만';
    case 'idle': return '미활동';
    case 'inactive': return '오프라인';
    default: return '오프라인';
  }
}

// 레벨 계산 (발음 비율 기반)
function getLevelInfo(speakingRatio) {
  if (speakingRatio >= 80) return { label: 'Advanced', percent: 85, color: 'text-[#137fec]' };
  if (speakingRatio >= 60) return { label: 'Intermediate', percent: 60, color: 'text-[#137fec]' };
  if (speakingRatio >= 40) return { label: 'Elementary', percent: 40, color: 'text-[#137fec]' };
  return { label: 'Beginner', percent: 25, color: 'text-[#137fec]' };
}

// 마지막 활동 시간 계산
function getLastActiveText(lastActive) {
  if (!lastActive) return '활동 없음';
  const now = new Date();
  const last = new Date(lastActive);
  const diffMs = now - last;
  const diffMins = Math.floor(diffMs / 60000);
  
  if (diffMins < 1) return '방금 전';
  if (diffMins < 60) return `${diffMins}분 전`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}시간 전`;
  return `${Math.floor(diffHours / 24)}일 전`;
}

export default function DashboardPage() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [levelFilter, setLevelFilter] = useState('all');

  // 커스텀 훅 사용
  const {
    notifications,
    unreadCount,
    notificationDialogOpen,
    openNotificationDialog,
    closeNotificationDialog,
    refreshNotifications,
  } = useTutorNotifications();

  const {
    students,
    loadingStudents,
    summary,
    wsStatus,
    lastUpdate,
    activeStudents,
    speakingStudents,
    warningStudents,
  } = useTutorStudents();

  const {
    tutorEmail,
    feedbackDialog,
    selectedStudent,
    feedbackText,
    sending,
    feedbackResult,
    openFeedbackDialog,
    closeFeedbackDialog,
    updateFeedbackText,
    submitFeedback,
    clearFeedbackResult,
    handleQuickFeedbackSuccess,
    handleQuickFeedbackError,
  } = useTutorFeedback();

  // 필터링된 학생 목록
  const filteredStudents = useMemo(() => {
    return students.filter(student => {
      // 검색 필터
      const matchesSearch = !searchQuery || 
        student.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        student.email?.toLowerCase().includes(searchQuery.toLowerCase());
      
      // 상태 필터
      const matchesStatus = statusFilter === 'all' || student.status === statusFilter;
      
      // 레벨 필터
      let matchesLevel = true;
      if (levelFilter !== 'all') {
        const level = getLevelInfo(student.speakingRatio || 0).label.toLowerCase();
        matchesLevel = level === levelFilter.toLowerCase();
      }
      
      return matchesSearch && matchesStatus && matchesLevel;
    });
  }, [students, searchQuery, statusFilter, levelFilter]);

  // 학생 클릭 핸들러
  const handleStudentClick = (email) => {
    navigate(`/tutor/students/${email}`);
  };

  // 피드백 결과 알림
  const notification = feedbackResult;
  const handleNotificationClose = () => {
    clearFeedbackResult();
  };

  // 최근 활동 데이터 (실시간 업데이트)
  const recentActivities = useMemo(() => {
    return students
      .filter(s => s.status !== 'inactive')
      .slice(0, 5)
      .map(s => ({
        name: s.name,
        activity: s.activity === 'sentence' ? '문장 연습' : s.activity === 'conversation' ? 'AI 대화' : '학습 중',
        time: getLastActiveText(s.lastActive || new Date()),
      }));
  }, [students]);

  return (
    <TutorLayout
      title="Student Management"
      subtitle="SpeakTracker Tutor Portal"
      studentCount={students.length}
      onNotificationClick={openNotificationDialog}
      unreadNotificationCount={unreadCount}
      onExportData={() => console.log('Export data')}
    >
      {/* 요약 통계 카드 */}
      <div className="grid grid-cols-4 gap-6">
        <div className="flex flex-col gap-2 rounded-xl p-6 border border-[#dbe0e6] dark:border-gray-800 bg-white dark:bg-[#101922]">
          <p className="text-[#617589] text-sm font-medium">전체 학생</p>
          <p className="text-[#111418] dark:text-white tracking-tight text-3xl font-bold">
            {summary.total || students.length}
          </p>
          <p className="text-[#078838] text-sm font-medium flex items-center gap-1">
            <span className="material-symbols-outlined text-sm">group</span> 등록됨
          </p>
        </div>
        <div className="flex flex-col gap-2 rounded-xl p-6 border border-[#dbe0e6] dark:border-gray-800 bg-white dark:bg-[#101922]">
          <p className="text-[#617589] text-sm font-medium">활성 학생</p>
          <p className="text-[#111418] dark:text-white tracking-tight text-3xl font-bold">
            {summary.active || activeStudents.length}
          </p>
          <p className="text-[#078838] text-sm font-medium flex items-center gap-1">
            <span className="material-symbols-outlined text-sm">trending_up</span> 온라인
          </p>
        </div>
        <div className="flex flex-col gap-2 rounded-xl p-6 border border-[#dbe0e6] dark:border-gray-800 bg-white dark:bg-[#101922]">
          <p className="text-[#617589] text-sm font-medium">학습 중</p>
          <p className="text-[#111418] dark:text-white tracking-tight text-3xl font-bold">
            {summary.speaking || speakingStudents.length}
          </p>
          <p className="text-[#078838] text-sm font-medium flex items-center gap-1">
            <span className="material-symbols-outlined text-sm">mic</span> 발음 중
          </p>
        </div>
        <div className="flex flex-col gap-2 rounded-xl p-6 border border-[#dbe0e6] dark:border-gray-800 bg-white dark:bg-[#101922]">
          <p className="text-[#617589] text-sm font-medium">주의 필요</p>
          <p className="text-[#111418] dark:text-white tracking-tight text-3xl font-bold">
            {summary.warning || warningStudents.length}
          </p>
          <p className={`text-sm font-medium flex items-center gap-1 ${warningStudents.length > 0 ? 'text-[#e73908]' : 'text-[#078838]'}`}>
            <span className="material-symbols-outlined text-sm">
              {warningStudents.length > 0 ? 'warning' : 'check_circle'}
            </span> 
            {warningStudents.length > 0 ? '개입 권장' : '양호'}
          </p>
        </div>
      </div>

      {/* 메인 콘텐츠: 테이블 + 사이드바 */}
      <div className="flex gap-8 items-start">
        {/* 학생 테이블 */}
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
                <option value="speaking">학습 중</option>
                <option value="listening">듣기만</option>
                <option value="idle">미활동</option>
                <option value="inactive">오프라인</option>
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
                {loadingStudents ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center">
                      <div className="flex items-center justify-center gap-2 text-[#617589]">
                        <span className="material-symbols-outlined animate-spin">progress_activity</span>
                        로딩 중...
                      </div>
                    </td>
                  </tr>
                ) : filteredStudents.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-[#617589]">
                      {students.length === 0 ? '등록된 학생이 없습니다.' : '검색 결과가 없습니다.'}
                    </td>
                  </tr>
                ) : (
                  filteredStudents.map((student) => {
                    const statusStyles = getStatusStyles(student.status);
                    const levelInfo = getLevelInfo(student.speakingRatio || 0);
                    
                    return (
                      <tr 
                        key={student.email} 
                        className="hover:bg-[#f6f7f8] dark:hover:bg-gray-800/30 transition-colors cursor-pointer"
                        onClick={() => handleStudentClick(student.email)}
                      >
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="size-9 rounded-full bg-[#137fec] flex items-center justify-center text-white font-semibold text-sm">
                              {student.name?.charAt(0) || '?'}
                            </div>
                            <div>
                              <p className="text-sm font-semibold flex items-center gap-2">
                                {student.name || '이름 없음'}
                                {student.warning && (
                                  <span className="material-symbols-outlined text-yellow-500 text-base">warning</span>
                                )}
                                {student.alert && (
                                  <span className="text-[10px] bg-red-500 text-white px-1.5 py-0.5 rounded font-medium">
                                    개입 필요
                                  </span>
                                )}
                              </p>
                              <p className="text-xs text-[#617589]">{student.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${statusStyles.bg} ${statusStyles.text}`}>
                            <span className={`size-1.5 rounded-full ${statusStyles.dot}`}></span>
                            {getStatusLabel(student.status)}
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
                          {getLastActiveText(student.lastActive)}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                openFeedbackDialog(student);
                              }}
                              className="p-2 text-[#617589] hover:text-[#137fec] hover:bg-[#137fec]/10 rounded-lg transition-colors"
                              title="피드백 보내기"
                            >
                              <span className="material-symbols-outlined text-xl">chat</span>
                            </button>
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                handleStudentClick(student.email);
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
            {/* WebSocket 상태 표시 */}
            <div className="flex items-center gap-2 text-xs text-[#617589]">
              <span className={`size-2 rounded-full ${wsStatus === 'connected' ? 'bg-green-500' : 'bg-gray-400'}`}></span>
              {wsStatus === 'connected' ? '실시간 연결됨' : '연결 중...'}
              {lastUpdate && (
                <span className="ml-2">최근 업데이트: {new Date(lastUpdate).toLocaleTimeString('ko-KR')}</span>
              )}
            </div>
          </div>
        </div>

        {/* 실시간 활동 사이드바 */}
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
                recentActivities.map((activity, index) => (
                  <div key={index} className="flex gap-3">
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
            <button className="w-full mt-6 py-2 text-xs font-semibold text-[#617589] hover:text-[#137fec] transition-colors border-t border-[#dbe0e6] dark:border-gray-800 pt-4">
              전체 활동 로그 보기
            </button>
          </div>

          {/* 시스템 상태 */}
          <div className="bg-[#137fec]/10 rounded-xl border border-[#137fec]/20 p-5">
            <h4 className="text-[#137fec] text-xs font-bold uppercase mb-3">연결 상태</h4>
            <div className="space-y-3">
              <div className="flex justify-between items-center text-xs">
                <span className="text-[#617589]">WebSocket</span>
                <span className={`font-bold ${wsStatus === 'connected' ? 'text-green-600' : 'text-yellow-600'}`}>
                  {wsStatus === 'connected' ? '연결됨' : '연결 중'}
                </span>
              </div>
              <div className="w-full h-1.5 bg-[#137fec]/20 rounded-full">
                <div className={`h-full rounded-full transition-all duration-300 ${wsStatus === 'connected' ? 'w-full bg-green-500' : 'w-1/2 bg-yellow-500'}`}></div>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-[#617589]">활성 세션</span>
                <span className="font-bold">{activeStudents.length} / {students.length}</span>
              </div>
            </div>
          </div>
        </aside>
      </div>

      {/* 피드백 다이얼로그 */}
      <FeedbackDialog
        open={feedbackDialog}
        onClose={closeFeedbackDialog}
        student={selectedStudent}
        feedbackText={feedbackText}
        onFeedbackTextChange={updateFeedbackText}
        onSubmit={submitFeedback}
        sending={sending}
      />

      {/* 알림 토스트 */}
      <FeedbackNotification
        notification={notification}
        onClose={handleNotificationClose}
      />

      {/* 튜터 등록 요청 알림 다이얼로그 */}
      <NotificationDialog
        open={notificationDialogOpen}
        onClose={closeNotificationDialog}
        notifications={notifications}
        onUpdate={refreshNotifications}
      />
    </TutorLayout>
  );
}
