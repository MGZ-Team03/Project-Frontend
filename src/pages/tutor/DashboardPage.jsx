// 튜터 실시간 모니터링 대시보드

import { useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  Stack,
  CircularProgress,
} from '@mui/material';
import { Circle } from '@mui/icons-material';
import TutorLayout from '../../components/common/TutorLayout';
import FeedbackNotification from '../../components/tutor/FeedbackNotification';
import FeedbackDialog from '../../components/tutor/FeedbackDialog';
import StudentCard from '../../components/tutor/StudentCard';
import NotificationDialog from '../../components/tutor/NotificationDialog';
import useTutorNotifications from '../../hooks/tutor/useTutorNotifications';
import useTutorStudents from '../../hooks/tutor/useTutorStudents';
import useTutorFeedback from '../../hooks/tutor/useTutorFeedback';

export default function DashboardPage() {
  const navigate = useNavigate();

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

  // 학생 클릭 핸들러
  const handleStudentClick = (email) => {
    navigate(`/tutor/students/${email}`);
  };

  // 피드백 결과 알림
  const notification = feedbackResult;
  const handleNotificationClose = () => {
    clearFeedbackResult();
  };

  return (
    <TutorLayout
      studentCount={students.length}
      onNotificationClick={openNotificationDialog}
      unreadNotificationCount={unreadCount}
    >
      <Box sx={{ maxWidth: 900, mx: 'auto', width: '100%' }}>
        {/* 요약 통계 */}
        <Grid container spacing={2} sx={{ mb: 3 }}>
          <Grid item xs={4}>
            <Card elevation={2}>
              <CardContent sx={{ textAlign: 'center', py: 2 }}>
                <Typography variant="h4" fontWeight={700} color="primary.main">
                  {students.length}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  전체 학생
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={4}>
            <Card elevation={2}>
              <CardContent sx={{ textAlign: 'center', py: 2 }}>
                <Typography variant="h4" fontWeight={700} color="success.main">
                  {speakingStudents.length}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  발음 중
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={4}>
            <Card elevation={2}>
              <CardContent sx={{ textAlign: 'center', py: 2 }}>
                <Typography variant="h4" fontWeight={700} color="warning.main">
                  {warningStudents.length}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  주의 필요
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        {/* 상태 범례 */}
        <Stack direction="row" spacing={2} sx={{ mb: 2 }}>
          <Stack direction="row" alignItems="center" spacing={0.5}>
            <Circle sx={{ fontSize: 10, color: 'success.main' }} />
            <Typography variant="caption">발음 중</Typography>
          </Stack>
          <Stack direction="row" alignItems="center" spacing={0.5}>
            <Circle sx={{ fontSize: 10, color: 'warning.main' }} />
            <Typography variant="caption">발음 비율 낮음</Typography>
          </Stack>
          <Stack direction="row" alignItems="center" spacing={0.5}>
            <Circle sx={{ fontSize: 10, color: 'error.main' }} />
            <Typography variant="caption">미활동</Typography>
          </Stack>
        </Stack>

        {/* 학생 목록 */}
        <Typography variant="h6" fontWeight={600} sx={{ mb: 2 }}>
          📋 현재 학습 중인 학생 ({activeStudents.length}명)
        </Typography>

        {loadingStudents ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress />
          </Box>
        ) : students.length === 0 ? (
          <Card elevation={1} sx={{ p: 3, textAlign: 'center' }}>
            <Typography color="text.secondary">
              등록된 학생이 없습니다.
            </Typography>
          </Card>
        ) : (
          <Stack spacing={2}>
            {students.map((student) => (
              <StudentCard
                key={student.email}
                student={student}
                onClick={handleStudentClick}
                onFeedbackClick={openFeedbackDialog}
                tutorEmail={tutorEmail}
                disabled={sending}
                onQuickFeedbackSuccess={handleQuickFeedbackSuccess}
                onQuickFeedbackError={handleQuickFeedbackError}
              />
            ))}
          </Stack>
        )}

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
      </Box>
    </TutorLayout>
  );
}
