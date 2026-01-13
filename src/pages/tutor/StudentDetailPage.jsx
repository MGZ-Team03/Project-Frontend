// 튜터 - 학생 상세 + 피드백 페이지 (목업)

import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
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

// 목업 학생 상세 데이터
const MOCK_STUDENT = {
  email: 'choi@student.com',
  name: '최토익',
  activity: 'sentence',
  status: 'listening',
  speakingRatio: 30,
  todayDuration: 8,
  currentSentence: 'The weather is nice today.',
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
  const [feedbackText, setFeedbackText] = useState('');
  const [feedbackHistory, setFeedbackHistory] = useState(MOCK_FEEDBACK);

  const student = MOCK_STUDENT; // 실제로는 email로 조회

  const handleSendFeedback = (type) => {
    if (!feedbackText.trim()) return;

    const newFeedback = {
      time: new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }),
      type,
      message: feedbackText,
    };

    setFeedbackHistory([newFeedback, ...feedbackHistory]);
    setFeedbackText('');
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

                <TextField
                  fullWidth
                  multiline
                  rows={3}
                  placeholder="학생에게 보낼 피드백을 입력하세요..."
                  value={feedbackText}
                  onChange={(e) => setFeedbackText(e.target.value)}
                  sx={{ mb: 2 }}
                />

                <Stack direction="row" spacing={1}>
                  <Button
                    variant="contained"
                    startIcon={<Send />}
                    onClick={() => handleSendFeedback('text')}
                    disabled={!feedbackText.trim()}
                  >
                    텍스트 전송
                  </Button>
                  <Button
                    variant="outlined"
                    startIcon={<VolumeUp />}
                    onClick={() => handleSendFeedback('tts')}
                    disabled={!feedbackText.trim()}
                  >
                    TTS 전송
                  </Button>
                </Stack>

                {feedbackHistory.length > 0 && (
                  <>
                    <Divider sx={{ my: 2 }} />
                    <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
                      최근 피드백
                    </Typography>
                    <Stack spacing={1}>
                      {feedbackHistory.slice(0, 3).map((fb, index) => (
                        <Box 
                          key={index}
                          sx={{ 
                            p: 1, 
                            bgcolor: 'grey.100', 
                            borderRadius: 1,
                            fontSize: '0.875rem',
                          }}
                        >
                          <Stack direction="row" spacing={1} alignItems="center">
                            <Typography variant="caption" color="text.secondary">
                              {fb.time}
                            </Typography>
                            <Chip 
                              label={fb.type === 'tts' ? 'TTS' : '텍스트'} 
                              size="small" 
                              variant="outlined"
                            />
                          </Stack>
                          <Typography variant="body2">{fb.message}</Typography>
                        </Box>
                      ))}
                    </Stack>
                  </>
                )}
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
      </Box>
    </TutorLayout>
  );
}
