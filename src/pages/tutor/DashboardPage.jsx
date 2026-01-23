// 튜터 실시간 모니터링 대시보드 (목업)

import {useEffect, useState} from 'react';
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
import {WS_URL} from "../../utils/constants.js";

// 목업 학생 데이터
const MOCK_STUDENTS = [
  {
    email: 'park@student.com',
    name: '박영어',
    activity: 'sentence',
    status: 'speaking',
    speakingRatio: 85,
    duration: 12,
    currentSentence: 'How are you doing today?',
  },
  {
    email: 'kim@student.com',
    name: '김스피킹',
    activity: 'ai_chat',
    status: 'speaking',
    speakingRatio: 78,
    duration: 23,
    currentTopic: '카페 주문',
  },
  {
    email: 'choi@student.com',
    name: '최토익',
    activity: 'sentence',
    status: 'listening',
    speakingRatio: 30,
    duration: 8,
    currentSentence: 'The weather is nice today.',
    warning: true,
  },
  {
    email: 'jung@student.com',
    name: '정회화',
    activity: null,
    status: 'inactive',
    speakingRatio: 0,
    duration: 0,
    lastActive: '5분 전',
    alert: true,
  },
  {
    email: 'lee@student.com',
    name: '이잉글',
    activity: 'ai_chat',
    status: 'speaking',
    speakingRatio: 72,
    duration: 15,
    currentTopic: '길 묻기',
  },
  {
    email: 'han@student.com',
    name: '한영희',
    activity: 'sentence',
    status: 'speaking',
    speakingRatio: 80,
    duration: 18,
    currentSentence: 'I would like a cup of coffee.',
  },
  {
    email: 'song@student.com',
    name: '송민수',
    activity: 'ai_chat',
    status: 'listening',
    speakingRatio: 45,
    duration: 10,
    currentTopic: '자기소개',
    warning: true,
  },
  {
    email: 'yoon@student.com',
    name: '윤지민',
    activity: 'sentence',
    status: 'speaking',
    speakingRatio: 90,
    duration: 30,
    currentSentence: 'Where is the nearest subway station?',
  },
];
import FeedbackNotification from '../../components/tutor/FeedbackNotification';
import QuickFeedbackChips from '../../components/tutor/QuickFeedbackChips';
import { sendFeedback } from '../../api/tutorFeedback';
import {WS_URL} from "../../utils/constants.js";

// 목업 학생 데이터
// const MOCK_STUDENTS = [
//   {
//     email: 'hwplus@gmail.com',
//     name: '홍길동',
//     activity: 'sentence',
//     status: 'speaking',
//     speakingRatio: 75,
//     duration: 15,
//     currentSentence: 'Hello, how are you today?',
//   },
// ];

function getStatusColor(status) {
  switch (status) {
    case 'speaking': return 'success';   // 🟢 발음 중
    case 'listening': return 'warning';  // 🟠 듣기만
    case 'idle': return 'error';         // 🔴 미활동 (개입 필요!)
    case 'inactive': return 'default';   // ⚪ 오프라인
    default: return 'default';
  }
}

function getStatusLabel(status) {
  switch (status) {
    case 'speaking': return '학습 중';
    case 'listening': return '듣기만';
    case 'idle': return '미활동';         // 빨강 (개입 필요)
    case 'inactive': return '오프라인';   // 회색
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
                {student.alert && student.status !== 'inactive' && (
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

  const [students,setStudents] = useState([]);
  const [feedbackDialog, setFeedbackDialog] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [feedbackText, setFeedbackText] = useState('');
  const [notification, setNotification] = useState(null);
  const [sending, setSending] = useState(false);

  const [summary, setSummary] = useState({ total: 0, active: 0, speaking: 0, warning: 0 });
  const [wsStatus, setWsStatus] = useState('connecting');
  const [lastUpdate, setLastUpdate] = useState(null);
  const user = useSelector(state => state.auth.user);

  console.log("user auth : " + JSON.stringify(user));
  useEffect(() => {

    console.log('🔌 WebSocket 연결 시도:', WS_URL);
    const ws = new WebSocket(WS_URL);

    ws.onopen = () => {
      console.log('✅ WebSocket 연결 성공');
      setWsStatus('connected');

      const authMessage = {
        action: "dashboard",
        name: user.name,
        tutorEmail: user.email,
      };
      if(user.role === "tutor"){
        console.log("auth:",authMessage)
        console.log('📤 인증 메시지 전송:', authMessage);
        ws.send(JSON.stringify(authMessage));
        setWsStatus('connected');
      }
    };

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        console.log('📊 대시보드 업데이트 수신!:', message);

        if (message.type === 'dashboard_update') {
          setStudents(message.students || []);
          setSummary(message.summary || { total: 0, active: 0, speaking: 0, warning: 0 });
          setLastUpdate(new Date(message.timestamp));

          console.log('✅ 대시보드 업데이트 완료:', message.students?.length, '명');
        }

      } catch (error) {
        console.error('❌ 메시지 파싱 에러:', error);
      }
    };

    ws.onerror = (error) => {
      console.error('❌ WebSocket 에러:', error);
      setWsStatus('disconnected');
    };

    ws.onclose = () => {
      console.log('🔌 WebSocket 연결 종료');
      setWsStatus('disconnected');
    };

    return () => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
    };
  }, []);

  // 세션 ID 생성 함수
  const generateSessionId = (studentEmail) => {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    return `session_${timestamp}_${studentEmail.split('@')[0]}_${random}`;
  };

  const activeStudents = students.filter(s => s.status !== 'inactive');
  const speakingStudents = students.filter(s => s.status === 'speaking');
  const warningStudents = students.filter(s => s.warning || s.alert);

  // const [students, setStudents] = useState([]);
  const [summary, setSummary] = useState({ total: 0, active: 0, speaking: 0, warning: 0 });
  const [wsStatus, setWsStatus] = useState('connecting');
  const [lastUpdate, setLastUpdate] = useState(null);


  const handleStudentClick = (email) => {
    navigate(`/tutor/students/${email}`);
  };

  useEffect(() => {

    console.log('🔌 WebSocket 연결 시도:', WS_URL);
    const ws = new WebSocket(WS_URL);

    ws.onopen = () => {
      console.log('✅ WebSocket 연결 성공');
      setWsStatus('connected');
    };

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        console.log('📊 대시보드 업데이트 수신!:', message);

        if (message.type === 'dashboard_update') {
          setStudents(message.students || []);
          setSummary(message.summary || { total: 0, active: 0, speaking: 0, warning: 0 });
          setLastUpdate(new Date(message.timestamp));

          console.log('✅ 대시보드 업데이트 완료:', message.students?.length, '명');
        }

      } catch (error) {
        console.error('❌ 메시지 파싱 에러:', error);
      }

      ws.onerror = (error) => {
        console.error('❌ WebSocket 에러:', error);
        setWsStatus('disconnected');
      };

      ws.onclose = () => {
        console.log('🔌 WebSocket 연결 종료');
        setWsStatus('disconnected');
      };

      return () => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.close();
        }
      };
    };


  },[]);

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
                    tutorEmail={tutorEmail}
                    disabled={sending}
                    onQuickFeedbackSuccess={handleQuickFeedbackSuccess}
                    onQuickFeedbackError={handleQuickFeedbackError}
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

          {/* 알림 */}
          <FeedbackNotification
              notification={notification}
              onClose={() => setNotification(null)}
          />
        </Box>
      </TutorLayout>
  );
}