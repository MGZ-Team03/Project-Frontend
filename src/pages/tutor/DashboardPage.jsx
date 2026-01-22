// 튜터 실시간 모니터링 대시보드 (목업)

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { useWebSocket } from '../../hooks/useWebSocket';
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
import FeedbackNotification from '../../components/tutor/FeedbackNotification';
import QuickFeedbackChips from '../../components/tutor/QuickFeedbackChips';
import NotificationDialog from '../../components/tutor/NotificationDialog';
import { sendFeedback, getMyStudents } from '../../api/tutorFeedback';
import { getNotifications } from '../../api/notifications';
import { getTutorRequests } from '../../api/tutorRegister';

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

function StudentCard({ student, onClick, onFeedbackClick, tutorEmail, disabled, onQuickFeedbackSuccess, onQuickFeedbackError }) {
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

        {/* 빠른 피드백 */}
        <QuickFeedbackChips
          student={student}
          tutorEmail={tutorEmail}
          disabled={disabled}
          onSuccess={onQuickFeedbackSuccess}
          onError={onQuickFeedbackError}
        />
      </CardContent>
    </Card>
  );
}

export default function DashboardPage() {
  const navigate = useNavigate();
  const tutorEmail = useSelector(state => state.auth.user?.email) || 'hw_plus@naver.com';
  
  // 학생 목록 (승인된 학생만)
  const [students, setStudents] = useState([]);
  const [loadingStudents, setLoadingStudents] = useState(false);
  
  const [feedbackDialog, setFeedbackDialog] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [feedbackText, setFeedbackText] = useState('');
  const [notification, setNotification] = useState(null);
  const [sending, setSending] = useState(false);

  // 알림 관리
  const [notifications, setNotifications] = useState([]);
  const [notificationDialog, setNotificationDialog] = useState(false);
  const [loadingNotifications, setLoadingNotifications] = useState(false);

  // 승인된 학생 목록 불러오기
  const loadStudents = async () => {
    try {
      setLoadingStudents(true);
      const response = await getMyStudents();
      console.log('📚 학생 목록 응답:', response);
      
      // 백엔드 응답 구조에 맞게 파싱
      const studentList = response.data?.students || response.students || [];
      
      // 학생 데이터를 대시보드 형식으로 변환
      const formattedStudents = studentList.map(s => ({
        email: s.studentEmail || s.student_email || s.email,
        name: s.studentName || s.student_name || s.name || '이름 없음',
        activity: null,  // WebSocket으로 실시간 업데이트
        status: 'inactive',  // 기본값, WebSocket으로 업데이트
        speakingRatio: 0,
        duration: 0,
        currentSentence: '',
        assignedAt: s.assignedAt || s.assigned_at,
      }));
      
      setStudents(formattedStudents);
    } catch (error) {
      console.error('학생 목록 로드 실패:', error);
      setStudents([]);
    } finally {
      setLoadingStudents(false);
    }
  };

  // 알림 목록 불러오기 (notifications API 사용)
  const loadNotifications = async () => {
    try {
      setLoadingNotifications(true);
      
      // 안 읽은 알림만 조회 (백엔드에서 pending 상태 필터링됨)
      const response = await getNotifications(false);
      
      // 백엔드 응답: { data: { notifications: [...], unreadCount: n } }
      setNotifications(response.data?.notifications || []);
    } catch (error) {
      console.error('알림 로드 실패:', error);
      // 에러 발생 시에도 빈 배열 설정
      setNotifications([]);
    } finally {
      setLoadingNotifications(false);
    }
  };

  // 컴포넌트 마운트 시 알림 및 학생 목록 로드
  useEffect(() => {
    loadNotifications();
    loadStudents();
  }, [tutorEmail]);

  // WebSocket 연결 - 튜터 등록 요청 알림 수신
  const { isConnected, error: wsError } = useWebSocket(
    tutorEmail,
    null, // 튜터는 tutor_email 파라미터 불필요
    (data) => {
      // 새로운 튜터 등록 요청 알림
      if (data.type === 'NEW_TUTOR_REQUEST') {
        setNotification({
          message: `${data.data.student_name}님이 등록 요청을 보냈습니다!`,
          severity: 'info'
        });
        
        // 실시간으로 알림 추가 (백엔드 API 없이 WebSocket 데이터로 직접 추가)
        const newNotification = {
          notification_id: data.data.request_id,
          type: 'NEW_TUTOR_REQUEST',
          data: data.data,
          created_at: data.data.created_at || Date.now(),
          read: false,
        };
        
        setNotifications(prev => [newNotification, ...prev]);
      }
      
      // 기타 알림 타입 처리
      if (data.type === 'FEEDBACK_RECEIVED' || data.type === 'SESSION_UPDATE') {
        // 기존 알림 처리 로직
      }
    }
  );

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

  // 빠른 피드백 성공/실패 핸들러
  const handleQuickFeedbackSuccess = (message) => {
    setNotification({ message, severity: 'success' });
  };

  const handleQuickFeedbackError = (message) => {
    setNotification({ message, severity: 'error' });
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

  // 읽지 않은 알림 개수
  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <TutorLayout 
      studentCount={students.length}
      onNotificationClick={() => setNotificationDialog(true)}
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

        <Stack spacing={2}>
          {loadingStudents ? (
            <Card elevation={2}>
              <CardContent sx={{ textAlign: 'center', py: 4 }}>
                <Typography color="text.secondary">학생 목록을 불러오는 중...</Typography>
              </CardContent>
            </Card>
          ) : students.length === 0 ? (
            <Card elevation={2}>
              <CardContent sx={{ textAlign: 'center', py: 4 }}>
                <Typography color="text.secondary">
                  아직 승인된 학생이 없습니다.
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                  학생의 등록 요청을 승인하면 여기에 표시됩니다.
                </Typography>
              </CardContent>
            </Card>
          ) : (
            students.map((student) => (
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
            ))
          )}
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

        {/* 튜터 등록 요청 알림 다이얼로그 */}
        <NotificationDialog
          open={notificationDialog}
          onClose={() => {
            setNotificationDialog(false);
            // 모달 닫을 때 학생 목록 갱신 (승인된 학생 반영)
            loadStudents();
          }}
          notifications={notifications}
          onUpdate={loadNotifications}
        />

        {/* 알림 */}
        <FeedbackNotification
          notification={notification}
          onClose={() => setNotification(null)}
        />
      </Box>
    </TutorLayout>
  );
}