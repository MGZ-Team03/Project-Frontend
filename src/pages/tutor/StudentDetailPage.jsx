// 튜터 - 학생 상세 + 피드백 페이지 (목업)

import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
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
  Button,
  TextField,
  IconButton,
  Divider,
  LinearProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Alert,
  Snackbar,
} from '@mui/material';
import {
  ArrowBack,
  Send,
  VolumeUp,
  Circle,
  MenuBook,
  Chat,
} from '@mui/icons-material';
import TutorLayout from '../../components/common/TutorLayout';
import FeedbackInput from '../../components/tutor/FeedbackInput';
import FeedbackHistory from '../../components/tutor/FeedbackHistory';
import FeedbackNotification from '../../components/tutor/FeedbackNotification';

// 목업 학생 상세 데이터
const MOCK_STUDENT = {
  email: 'hwplus@gmail.com',
  name: '홍길동',
  activity: 'sentence',
  status: 'speaking',
  speakingRatio: 75,
  todayDuration: 15,
  currentSentence: 'Hello, how are you today?',
};

// 목업 학습 이력
const MOCK_HISTORY = [
  { date: '1/10(금)', duration: 35, ratio: 75, sessions: 3 },
  { date: '1/9(목)', duration: 28, ratio: 68, sessions: 2 },
  { date: '1/8(수)', duration: 32, ratio: 73, sessions: 4 },
  { date: '1/7(화)', duration: 25, ratio: 65, sessions: 2 },
  { date: '1/6(월)', duration: 30, ratio: 70, sessions: 3 },
];

// 목업 피드백 이력
const MOCK_FEEDBACK = [
  { time: '10:30', type: 'text', message: '잘하고 있어요! 조금만 더 힘내세요.' },
  { time: '10:15', type: 'tts', message: 'Great job! Keep practicing.' },
];

export default function StudentDetailPage() {
  const { email } = useParams();
  const navigate = useNavigate();
  const tutorEmail = useSelector(state => state.auth.user?.email);
  
  const [feedbackHistory, setFeedbackHistory] = useState(MOCK_FEEDBACK);
  const [notification, setNotification] = useState(null);

  const student = MOCK_STUDENT; // 실제로는 email로 조회

  const handleFeedbackSuccess = (message, newFeedback) => {
    setFeedbackHistory([newFeedback, ...feedbackHistory]);
    setNotification({ message, severity: 'success' });
  };

  const handleFeedbackError = (message) => {
    setNotification({ message, severity: 'error' });
  };

  const weeklyTotal = MOCK_HISTORY.reduce((sum, d) => sum + d.duration, 0);
  const weeklyAvgRatio = Math.round(
    MOCK_HISTORY.reduce((sum, d) => sum + d.ratio, 0) / MOCK_HISTORY.length
  );

  return (
    <TutorLayout studentCount={8}>
      <Box sx={{ maxWidth: 900, mx: 'auto', width: '100%' }}>
        {/* 헤더 */}
        <Stack direction="row" alignItems="center" spacing={2} sx={{ mb: 3 }}>
          <IconButton onClick={() => navigate('/tutor/dashboard')}>
            <ArrowBack />
          </IconButton>
          <Avatar sx={{ bgcolor: 'primary.main', width: 48, height: 48 }}>
            {student.name.charAt(0)}
          </Avatar>
          <Box sx={{ flexGrow: 1 }}>
            <Typography variant="h5" fontWeight={600}>
              {student.name}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {student.email}
            </Typography>
          </Box>
          <Stack direction="row" spacing={1}>
            <Chip
              icon={student.activity === 'sentence' ? <MenuBook /> : <Chat />}
              label={student.activity === 'sentence' ? '문장연습' : 'AI대화'}
              variant="outlined"
            />
            <Chip
              icon={<Circle sx={{ fontSize: 10 }} />}
              label={student.status === 'speaking' ? '발음 중' : '듣기만'}
              color={student.status === 'speaking' ? 'success' : 'warning'}
            />
          </Stack>
        </Stack>

        <Grid container spacing={3}>
          {/* 현재 상태 */}
          <Grid item xs={12} md={6}>
            <Card elevation={2}>
              <CardContent>
                <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 2 }}>
                  📍 현재 학습 상태
                </Typography>

                <Stack spacing={2}>
                  <Box>
                    <Typography variant="body2" color="text.secondary">
                      현재 문장
                    </Typography>
                    <Typography variant="body1" fontWeight={500}>
                      "{student.currentSentence}"
                    </Typography>
                  </Box>

                  <Box>
                    <Stack direction="row" justifyContent="space-between" sx={{ mb: 0.5 }}>
                      <Typography variant="body2">발음 비율</Typography>
                      <Typography 
                        variant="body2" 
                        fontWeight={600} 
                        color={student.speakingRatio < 50 ? 'error.main' : 'success.main'}
                      >
                        {student.speakingRatio}%
                      </Typography>
                    </Stack>
                    <LinearProgress
                      variant="determinate"
                      value={student.speakingRatio}
                      color={student.speakingRatio < 50 ? 'error' : 'success'}
                      sx={{ height: 8, borderRadius: 4 }}
                    />
                  </Box>

                  <Box>
                    <Typography variant="body2" color="text.secondary">
                      오늘 학습 시간
                    </Typography>
                    <Typography variant="h6" fontWeight={600}>
                      {student.todayDuration}분
                    </Typography>
                  </Box>
                </Stack>
              </CardContent>
            </Card>
          </Grid>

          {/* 피드백 전송 */}
          <Grid item xs={12} md={6}>
            <Card elevation={2}>
              <CardContent>
                <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 2 }}>
                  💬 피드백 보내기
                </Typography>

                <FeedbackInput
                  tutorEmail={tutorEmail}
                  studentEmail={student.email}
                  onSuccess={handleFeedbackSuccess}
                  onError={handleFeedbackError}
                  showTTS={true}
                  rows={3}
                />

                <FeedbackHistory feedbacks={feedbackHistory} maxDisplay={3} />
              </CardContent>
            </Card>
          </Grid>

          {/* 학습 이력 */}
          <Grid item xs={12}>
            <Card elevation={2}>
              <CardContent>
                <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
                  <Typography variant="subtitle1" fontWeight={600}>
                    📈 학습 이력
                  </Typography>
                  <Stack direction="row" spacing={2}>
                    <Box sx={{ textAlign: 'center' }}>
                      <Typography variant="caption" color="text.secondary">
                        이번 주 총 학습
                      </Typography>
                      <Typography variant="h6" fontWeight={600}>
                        {weeklyTotal}분
                      </Typography>
                    </Box>
                    <Box sx={{ textAlign: 'center' }}>
                      <Typography variant="caption" color="text.secondary">
                        평균 발음 비율
                      </Typography>
                      <Typography variant="h6" fontWeight={600} color="success.main">
                        {weeklyAvgRatio}%
                      </Typography>
                    </Box>
                  </Stack>
                </Stack>

                <TableContainer component={Paper} variant="outlined">
                  <Table size="small">
                    <TableHead>
                      <TableRow sx={{ bgcolor: 'grey.50' }}>
                        <TableCell>날짜</TableCell>
                        <TableCell align="right">학습 시간</TableCell>
                        <TableCell align="right">발음 비율</TableCell>
                        <TableCell align="right">세션 수</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {MOCK_HISTORY.map((row) => (
                        <TableRow key={row.date}>
                          <TableCell>{row.date}</TableCell>
                          <TableCell align="right">{row.duration}분</TableCell>
                          <TableCell align="right">
                            <Chip 
                              label={`${row.ratio}%`}
                              size="small"
                              color={row.ratio >= 70 ? 'success' : row.ratio >= 50 ? 'warning' : 'error'}
                            />
                          </TableCell>
                          <TableCell align="right">{row.sessions}회</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        {/* 알림 */}
        <FeedbackNotification
          notification={notification}
          onClose={() => setNotification(null)}
        />
      </Box>
    </TutorLayout>
  );
}
