// 문장 연습 페이지 + 튜터 피드백

import { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import {
  Box,
  Typography,
  Button,
  Card,
  CardContent,
  LinearProgress,
  Stack,
  Chip,
  Avatar,
  Paper,
  Snackbar,
  Alert,
} from '@mui/material';
import {
  VolumeUp,
  SkipPrevious,
  SkipNext,
  Replay,
  Mic,
  Notifications,
} from '@mui/icons-material';
import StudentLayout from '../../components/common/StudentLayout';
import { useWebSocket } from '../../hooks/useWebSocket';
import { getFeedbackHistory } from '../../api/tutorFeedback';

// 샘플 문장 데이터
const SAMPLE_SENTENCES = [
  { id: 1, text: "How are you doing today?", category: "greeting" },
  { id: 2, text: "The weather is nice today.", category: "daily" },
  { id: 3, text: "What time is it now?", category: "time" },
  { id: 4, text: "I would like a cup of coffee.", category: "cafe" },
  { id: 5, text: "Where is the nearest subway station?", category: "direction" },
];

export default function PracticePage() {
  const user = useSelector((state) => state.auth.user);
  const userEmail = user?.email;

  const [currentIndex, setCurrentIndex] = useState(0);
  const [speakingTime, setSpeakingTime] = useState(0);
  const [totalTime, setTotalTime] = useState(0);
  const [feedbacks, setFeedbacks] = useState([]);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'info' });

  // WebSocket 연결
  const handleWebSocketMessage = (message) => {
    if (message.type === 'feedback') {
      setFeedbacks((prev) => [message, ...prev]);
      setSnackbar({
        open: true,
        message: `튜터 피드백: ${message.message}`,
        severity: 'success',
      });

      // 브라우저 알림
      if (Notification.permission === 'granted') {
        new Notification('튜터 피드백', {
          body: message.message,
          icon: '/tutor-icon.png',
        });
      }
    }
  };

  const { isConnected, error } = useWebSocket(userEmail, handleWebSocketMessage);

  // 피드백 히스토리 불러오기
  useEffect(() => {
    if (userEmail) {
      getFeedbackHistory(userEmail, 10)
        .then((data) => setFeedbacks(data || []))
        .catch((err) => console.error('Failed to fetch feedback history:', err));
    }

    // 알림 권한 요청
    if (Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, [userEmail]);

  const currentSentence = SAMPLE_SENTENCES[currentIndex];
  const progress = Math.round((speakingTime / (totalTime || 1)) * 100);

  const handleNext = () => {
    if (currentIndex < SAMPLE_SENTENCES.length - 1) {
      setCurrentIndex(currentIndex + 1);
      setSpeakingTime(speakingTime + Math.floor(Math.random() * 5) + 1);
      setTotalTime(totalTime + 10);
    }
  };

  const handlePrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  };

  return (
    <StudentLayout todayTime={totalTime}>
      <Box 
        sx={{ 
          flex: 1, 
          display: 'flex', 
          flexDirection: 'column',
          alignItems: 'center', 
          justifyContent: 'center',
          gap: 2,
          p: 2,
        }}
      >
        {/* WebSocket 상태 + 튜터 피드백 알림 */}
        <Box sx={{ width: '100%', maxWidth: 600 }}>
          <Stack direction="row" spacing={1} alignItems="center" justifyContent="flex-end" mb={1}>
            <Chip 
              icon={<Notifications />}
              label={isConnected ? '연결됨' : '연결 안됨'}
              color={isConnected ? 'success' : 'error'}
              size="small"
            />
          </Stack>

          {/* 튜터 피드백 영역 (최근 1개만 표시) */}
          {feedbacks.length > 0 && (
            <Card sx={{ mb: 2, bgcolor: '#fff3e0' }} elevation={2}>
              <CardContent sx={{ py: 1.5, px: 2 }}>
                <Stack direction="row" spacing={1} alignItems="center">
                  <Avatar sx={{ width: 28, height: 28, bgcolor: 'primary.main', fontSize: 16 }}>
                    👨‍🏫
                  </Avatar>
                  <Box flex={1}>
                    <Typography variant="body2" fontWeight="bold">
                      튜터 피드백
                    </Typography>
                    <Typography variant="body2">
                      {feedbacks[0].message}
                    </Typography>
                    {feedbacks[0].audioUrl && (
                      <audio controls src={feedbacks[0].audioUrl} style={{ width: '100%', height: 28, marginTop: 4 }} />
                    )}
                  </Box>
                </Stack>
              </CardContent>
            </Card>
          )}
        </Box>

        <Card sx={{ maxWidth: 600, width: '100%' }} elevation={3}>
          <CardContent sx={{ p: 4 }}>
            {/* 문장 표시 */}
            <Box sx={{ textAlign: 'center', mb: 4 }}>
              <Typography 
                variant="h4" 
                sx={{ 
                  mb: 3, 
                  fontWeight: 500,
                  color: 'text.primary',
                  lineHeight: 1.5,
                }}
              >
                {currentSentence.text}
              </Typography>
              <Button
                variant="contained"
                startIcon={<VolumeUp />}
                size="large"
                sx={{
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  px: 4,
                }}
              >
                듣기
              </Button>
            </Box>

            {/* 상태 표시 */}
            <Box sx={{ mb: 3 }}>
              <Stack direction="row" alignItems="center" justifyContent="center" spacing={1} sx={{ mb: 2 }}>
                <Mic color="action" />
                <Typography variant="body1" color="text.secondary">
                  준비
                </Typography>
              </Stack>
              
              <LinearProgress 
                variant="determinate" 
                value={progress} 
                sx={{ 
                  height: 10, 
                  borderRadius: 5,
                  mb: 1,
                  bgcolor: '#e0e0e0',
                  '& .MuiLinearProgress-bar': {
                    background: 'linear-gradient(90deg, #667eea 0%, #764ba2 100%)',
                  }
                }}
              />
              
              <Typography 
                variant="body2" 
                align="center" 
                sx={{ fontWeight: 600, color: 'primary.main' }}
              >
                {progress}%
              </Typography>
            </Box>

            {/* 컨트롤 버튼 */}
            <Stack direction="row" spacing={2} justifyContent="center" sx={{ mb: 2 }}>
              <Button
                variant="outlined"
                startIcon={<SkipPrevious />}
                onClick={handlePrev}
                disabled={currentIndex === 0}
              >
                이전
              </Button>
              <Button
                variant="outlined"
                startIcon={<Replay />}
              >
                다시 듣기
              </Button>
              <Button
                variant="outlined"
                endIcon={<SkipNext />}
                onClick={handleNext}
                disabled={currentIndex === SAMPLE_SENTENCES.length - 1}
              >
                다음
              </Button>
            </Stack>

            {/* 문장 카운터 */}
            <Typography variant="body2" align="center" color="text.secondary">
              {currentIndex + 1} / {SAMPLE_SENTENCES.length}
            </Typography>
          </CardContent>
        </Card>
      </Box>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      >
        <Alert 
          onClose={() => setSnackbar({ ...snackbar, open: false })} 
          severity={snackbar.severity}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </StudentLayout>
  );
}
