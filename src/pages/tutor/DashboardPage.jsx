// 튜터 실시간 모니터링 대시보드 (목업)

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  Stack,
  Avatar,
  Chip,
  IconButton,
  LinearProgress,
  Tooltip,
  TextField,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
  Snackbar,
} from '@mui/material';
import {
  Circle,
  Visibility,
  Message,
  MenuBook,
  Chat,
  Warning,
  Send,
} from '@mui/icons-material';
import TutorLayout from '../../components/common/TutorLayout';
import { sendFeedback } from '../../api/tutorFeedback';

// 목업 학생 데이터
const MOCK_STUDENTS = [
  {
    email: 'hwplus@gmail.com',
    name: '홍길동',
    activity: 'sentence',
    status: 'speaking',
    speakingRatio: 75,
    duration: 15,
    currentSentence: 'Hello, how are you today?',
  },
];

function getStatusColor(status) {
  switch (status) {
    case 'speaking': return 'success';
    case 'listening': return 'warning';
    case 'inactive': return 'error';
    default: return 'default';
  }
}

function getStatusLabel(status) {
  switch (status) {
    case 'speaking': return '발음 중';
    case 'listening': return '듣기만';
    case 'inactive': return '미활동';
    default: return '오프라인';
  }
}

function StudentCard({ student, onClick, onFeedbackClick, onQuickFeedback, disabled }) {
  const statusColor = getStatusColor(student.status);

  return (
    <Card 
      elevation={student.alert ? 4 : 2}
      sx={{ 
        cursor: 'pointer',
        border: student.alert ? '2px solid' : 'none',
        borderColor: 'error.main',
        '&:hover': { boxShadow: 6 },
      }}
      onClick={() => onClick(student.email)}
    >
      <CardContent>
        <Stack direction="row" alignItems="center" spacing={2}>
          {/* 상태 아이콘 */}
          <Circle 
            sx={{ 
              fontSize: 12, 
              color: `${statusColor}.main`,
            }} 
          />

          {/* 프로필 */}
          <Avatar sx={{ bgcolor: 'primary.main' }}>
            {student.name.charAt(0)}
          </Avatar>

          {/* 정보 */}
          <Box sx={{ flexGrow: 1, minWidth: 0 }}>
            <Stack direction="row" alignItems="center" spacing={1}>
              <Typography variant="subtitle1" fontWeight={600} noWrap>
                {student.name}
              </Typography>
              {student.warning && (
                <Tooltip title="발음 비율 낮음">
                  <Warning color="warning" sx={{ fontSize: 18 }} />
                </Tooltip>
              )}
              {student.alert && (
                <Chip label="개입 필요" size="small" color="error" />
              )}
            </Stack>

            <Stack direction="row" alignItems="center" spacing={1}>
              {student.activity && (
                <Chip
                  icon={student.activity === 'sentence' ? <MenuBook sx={{ fontSize: 14 }} /> : <Chat sx={{ fontSize: 14 }} />}
                  label={student.activity === 'sentence' ? '문장연습' : 'AI대화'}
                  size="small"
                  variant="outlined"
                />
              )}
              <Chip
                label={getStatusLabel(student.status)}
                size="small"
                color={statusColor}
              />
            </Stack>
          </Box>

          {/* 발음 비율 & 시간 */}
          <Box sx={{ textAlign: 'right', minWidth: 80 }}>
            {student.status !== 'inactive' ? (
              <>
                <Typography variant="h6" fontWeight={600} color={`${statusColor}.main`}>
                  {student.speakingRatio}%
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {student.duration}분
                </Typography>
              </>
            ) : (
              <Typography variant="caption" color="error.main">
                {student.lastActive}
              </Typography>
            )}
          </Box>

          {/* 액션 버튼 */}
          <Stack direction="row" spacing={0.5}>
            <Tooltip title="상세 보기">
              <IconButton 
                size="small" 
                color="primary"
                onClick={(e) => {
                  e.stopPropagation();
                  onClick(student.email);
                }}
              >
                <Visibility fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title="피드백 보내기">
              <IconButton 
                size="small" 
                color="secondary"
                onClick={(e) => onFeedbackClick(student, e)}
                disabled={disabled}
              >
                <Message fontSize="small" />
              </IconButton>
            </Tooltip>
          </Stack>
        </Stack>

        {/* 진행률 바 */}
        {student.status !== 'inactive' && (
          <LinearProgress
            variant="determinate"
            value={student.speakingRatio}
            color={statusColor}
            sx={{ mt: 1, height: 4, borderRadius: 2 }}
          />
        )}

        {/* 빠른 피드백 버튼 */}
        <Box display="flex" gap={0.5} mt={2} flexWrap="wrap">
          <Chip
            label="👍 잘하고 있어요!"
            size="small"
            onClick={(e) => onQuickFeedback(student, '발음이 좋아졌어요! 계속 연습하세요.', e)}
            disabled={disabled}
            sx={{ cursor: 'pointer' }}
          />
          <Chip
            label="💪 힘내세요!"
            size="small"
            onClick={(e) => onQuickFeedback(student, '좀 더 천천히 발음해보세요.', e)}
            disabled={disabled}
            sx={{ cursor: 'pointer' }}
          />
          <Chip
            label="🔊 크게 말해요"
            size="small"
            onClick={(e) => onQuickFeedback(student, '좀 더 크게 말씀해주세요.', e)}
            disabled={disabled}
            sx={{ cursor: 'pointer' }}
          />
        </Box>
      </CardContent>
    </Card>
  );
}

export default function DashboardPage() {
  const navigate = useNavigate();
  const tutorEmail = useSelector(state => state.auth.user?.email) || 'hw_plus@naver.com';
  
  const [students] = useState(MOCK_STUDENTS);
  const [feedbackDialog, setFeedbackDialog] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [feedbackText, setFeedbackText] = useState('');
  const [notification, setNotification] = useState(null);
  const [sending, setSending] = useState(false);

  // 세션 ID 생성 함수
  const generateSessionId = (studentEmail) => {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    return `session_${timestamp}_${studentEmail.split('@')[0]}_${random}`;
  };

  const activeStudents = students.filter(s => s.status !== 'inactive');
  const speakingStudents = students.filter(s => s.status === 'speaking');
  const warningStudents = students.filter(s => s.warning || s.alert);

  const handleStudentClick = (email) => {
    navigate(`/tutor/students/${email}`);
  };

  // 피드백 다이얼로그 열기
  const openFeedbackDialog = (student, event) => {
    event?.stopPropagation();
    setSelectedStudent(student);
    setFeedbackText('');
    setFeedbackDialog(true);
  };

  // 피드백 전송
  const handleSendFeedback = async () => {
    if (!feedbackText.trim()) {
      setNotification({ message: '피드백 메시지를 입력해주세요.', severity: 'warning' });
      return;
    }

    setSending(true);
    try {
      const sessionId = generateSessionId(selectedStudent.email);
      const result = await sendFeedback({
        tutor_email: tutorEmail,
        student_email: selectedStudent.email,
        message: feedbackText,
        message_type: 'text',
        session_id: sessionId
      });

      console.log('피드백 전송 결과:', result);

      setNotification({
        message: `피드백 전송 성공! ${result.websocket_sent ? '(실시간 전달됨)' : '(오프라인)'}`,
        severity: 'success',
      });

      setFeedbackDialog(false);
      setFeedbackText('');
    } catch (error) {
      console.error('피드백 전송 실패:', error);
      setNotification({
        message: '피드백 전송에 실패했습니다.',
        severity: 'error',
      });
    } finally {
      setSending(false);
    }
  };

  // 빠른 피드백 전송 (미리 정의된 메시지)
  const sendQuickFeedback = async (student, message, event) => {
    event?.stopPropagation();
    setSending(true);
    try {
      const sessionId = generateSessionId(student.email);
      const result = await sendFeedback({
        tutor_email: tutorEmail,
        student_email: student.email,
        message: message,
        message_type: 'text',
        session_id: sessionId
      });

      setNotification({
        message: `빠른 피드백 전송 완료! ${result.websocket_sent ? '(실시간)' : '(오프라인)'}`,
        severity: 'success',
      });
    } catch (error) {
      setNotification({
        message: '피드백 전송 실패',
        severity: 'error',
      });
    } finally {
      setSending(false);
    }
  };

  return (
    <TutorLayout studentCount={students.length}>
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

        <Stack spacing={2}>
          {students.map((student) => (
            <StudentCard
              key={student.email}
              student={student}
              onClick={handleStudentClick}
              onFeedbackClick={openFeedbackDialog}
              onQuickFeedback={sendQuickFeedback}
              disabled={sending}
            />
          ))}
        </Stack>

        {/* 피드백 다이얼로그 */}
        <Dialog
          open={feedbackDialog}
          onClose={() => !sending && setFeedbackDialog(false)}
          maxWidth="sm"
          fullWidth
        >
          <DialogTitle>
            📨 피드백 전송: {selectedStudent?.name}
          </DialogTitle>
          <DialogContent>
            <TextField
              autoFocus
              fullWidth
              multiline
              rows={4}
              placeholder="학생에게 전달할 피드백을 입력하세요..."
              value={feedbackText}
              onChange={(e) => setFeedbackText(e.target.value)}
              disabled={sending}
              sx={{ mt: 2 }}
            />
            <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
              학생: {selectedStudent?.email}
            </Typography>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setFeedbackDialog(false)} disabled={sending}>
              취소
            </Button>
            <Button
              variant="contained"
              onClick={handleSendFeedback}
              disabled={sending || !feedbackText.trim()}
              startIcon={<Send />}
            >
              {sending ? '전송 중...' : '전송'}
            </Button>
          </DialogActions>
        </Dialog>

        {/* 알림 스낵바 */}
        <Snackbar
          open={!!notification}
          autoHideDuration={4000}
          onClose={() => setNotification(null)}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        >
          <Alert 
            onClose={() => setNotification(null)} 
            severity={notification?.severity || 'info'}
          >
            {notification?.message}
          </Alert>
        </Snackbar>
      </Box>
    </TutorLayout>
  );
}