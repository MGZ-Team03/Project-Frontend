// 튜터 실시간 모니터링 대시보드 (Tailwind CSS)

import { useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import TutorLayout from '../../components/common/TutorLayout';
import FeedbackNotification from '../../components/tutor/FeedbackNotification';
import FeedbackDialog from '../../components/tutor/FeedbackDialog';
import NotificationDialog from '../../components/tutor/NotificationDialog';
import StatsSummaryCards from '../../components/tutor/StatsSummaryCards';
import StudentTable from '../../components/tutor/StudentTable';
import RealTimeActivitySidebar from '../../components/tutor/RealTimeActivitySidebar';
import useTutorNotifications from '../../hooks/tutor/useTutorNotifications';
import useTutorStudentsRedux from '../../hooks/tutor/useTutorStudentsRedux';
import useTutorFeedback from '../../hooks/tutor/useTutorFeedback';
import { getStudentStatus } from '../../utils/timeUtils';
import { getLastActiveText } from '../../utils/dashboardHelpers';
import { loadLearningLevelsOnce } from '../../store/slices/tutorStatsSlice';

export default function DashboardPage() {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const learningLevelsByEmail = useSelector((state) => state.tutorStats?.learningLevelsByEmail || {});

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
    loading: loadingStudents,
    error,
    refetch,
  } = useTutorStudentsRedux();

  // 학습 레벨은 세션당 1회만 로딩
  useEffect(() => {
    dispatch(loadLearningLevelsOnce());
  }, [dispatch]);

  // 학생 데이터에 상태 정보 추가
  const studentsWithStatus = useMemo(() => {
    return students.map(student => {
      const statusInfo = getStudentStatus(student);
      const rawLevel = learningLevelsByEmail?.[student.email];
      const levelDisplay = rawLevel === '상' || rawLevel === '중' || rawLevel === '하' ? rawLevel : '-';
      return {
        ...student,
        statusLabel: statusInfo.status,
        emoji: statusInfo.emoji,
        activity: statusInfo.activity,
        learningLevelRaw: rawLevel,
        levelDisplay,
      };
    });
  }, [students, learningLevelsByEmail]);

  // 요약 통계 계산
  const summary = useMemo(() => {
    const total = studentsWithStatus.length;
    const active = studentsWithStatus.filter(s => ['online', 'ai', 'sentence'].includes(s.statusLabel)).length;
    const speaking = studentsWithStatus.filter(s => ['ai', 'sentence'].includes(s.statusLabel)).length;
    
    return { total, active, speaking };
  }, [studentsWithStatus]);

  const activeStudents = studentsWithStatus.filter(s => ['online', 'ai', 'sentence'].includes(s.statusLabel));
  const speakingStudents = studentsWithStatus.filter(s => ['ai', 'sentence'].includes(s.statusLabel));

  const {
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
  } = useTutorFeedback();

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
    return studentsWithStatus
      .filter(s => s.statusLabel !== 'offline')
      .slice(0, 5)
      .map(s => ({
        email: s.email,
        name: s.name,
        activity: s.activity,
        time: getLastActiveText(s.updated_at),
      }));
  }, [studentsWithStatus]);

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
      <StatsSummaryCards summary={summary} />

      {/* 메인 콘텐츠: 테이블 + 사이드바 */}
      <div className="flex gap-8 items-start">
        {/* 학생 테이블 */}
        <StudentTable
          students={studentsWithStatus}
          loading={loadingStudents}
          error={error}
          onStudentClick={handleStudentClick}
          onFeedbackClick={openFeedbackDialog}
          onRefresh={refetch}
        />

        {/* 실시간 활동 사이드바 */}
        <RealTimeActivitySidebar
          recentActivities={recentActivities}
          activeStudents={activeStudents}
          totalStudents={studentsWithStatus.length}
          loading={loadingStudents}
          error={error}
        />
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
        onStudentListUpdate={refetch}
      />
    </TutorLayout>
  );
}
