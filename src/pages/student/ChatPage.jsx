// AI 대화 페이지 + 튜터 피드백

import { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import {
  Box,
  Typography,
  Button,
  Card,
  CardContent,
  Stack,
  TextField,
  Avatar,
  Chip,
  IconButton,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  Paper,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Snackbar,
  Alert,
  Divider,
} from '@mui/material';
import {
  VolumeUp,
  Mic,
  MicOff,
  SmartToy,
  Person,
  Send,
  Notifications,
} from '@mui/icons-material';
import StudentLayout from '../../components/common/StudentLayout';
import { useWebSocket } from '../../hooks/useWebSocket';
import { getFeedbackHistory } from '../../api/tutorFeedback';

// 목업 대화 주제
const TOPICS = [
  { id: 'intro', label: '자기소개', difficulty: '초급' },
  { id: 'cafe', label: '카페 주문', difficulty: '초급' },
  { id: 'direction', label: '길 묻기', difficulty: '중급' },
  { id: 'movie', label: '영화 추천', difficulty: '중급' },
  { id: 'interview', label: '면접 연습', difficulty: '고급' },
];

// 목업 대화 데이터
const MOCK_MESSAGES = [
  {
    role: 'ai',
    content: "Hello! Welcome to the coffee shop. What would you like to order today?",
    speakingTime: null,
  },
  {
    role: 'user',
    content: "I'd like a latte, please.",
    speakingTime: 2.3,
  },
  {
    role: 'ai',
    content: "Great choice! Would you like it hot or iced?",
    speakingTime: null,
  },
];

export default function ChatPage() {
  const [topic, setTopic] = useState('cafe');
  const [messages, setMessages] = useState(MOCK_MESSAGES);
  const [isRecording, setIsRecording] = useState(false);
  const [inputText, setInputText] = useState('');
  const [totalSpeakingTime, setTotalSpeakingTime] = useState(2.3);
  const [totalTime, setTotalTime] = useState(45);
  
  // 튜터 피드백 관련 상태
  const [feedbacks, setFeedbacks] = useState([]);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'info' });
  const userEmail = useSelector(state => state.auth.user?.email);

  // WebSocket 메시지 핸들러
  const handleWebSocketMessage = (data) => {
    console.log('WebSocket 메시지:', data);

    if (data.type === 'feedback') {
      // 새로운 튜터 피드백 추가
      const newFeedback = {
        from: data.from,
        message: data.message,
        messageType: data.messageType || 'text',
        audioUrl: data.audioUrl,
        timestamp: data.timestamp || new Date().toISOString(),
      };

      setFeedbacks(prev => [newFeedback, ...prev]);
      
      // 알림 표시
      setSnackbar({
        open: true,
        message: `튜터: ${data.message}`,
        severity: 'info',
      });

      // 브라우저 알림
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification('새로운 튜터 피드백', {
          body: data.message,
        });
      }
    }
  };

  // WebSocket 연결
  const { isConnected } = useWebSocket(userEmail, handleWebSocketMessage);

  // 브라우저 알림 권한 요청
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  const handleTopicChange = (e) => {
    setTopic(e.target.value);
    setMessages([{
      role: 'ai',
      content: getInitialMessage(e.target.value),
      speakingTime: null,
    }]);
  };

  const getInitialMessage = (topicId) => {
    const initMessages = {
      intro: "Hi! I'd like to know more about you. Could you introduce yourself?",
      cafe: "Hello! Welcome to the coffee shop. What would you like to order today?",
      direction: "Excuse me, you look a bit lost. Can I help you find something?",
      movie: "Hey! Have you watched any good movies recently?",
      interview: "Good morning. Thank you for coming in today. Please tell me about yourself.",
    };
    return initMessages[topicId] || initMessages.intro;
  };

  const handleSend = () => {
    if (!inputText.trim()) return;

    const speakingTime = Math.random() * 3 + 1;
    
    // 사용자 메시지 추가
    const newMessages = [
      ...messages,
      { role: 'user', content: inputText, speakingTime },
    ];

    // AI 응답 추가 (목업)
    setTimeout(() => {
      setMessages([
        ...newMessages,
        { role: 'ai', content: getAIResponse(), speakingTime: null },
      ]);
    }, 1000);

    setMessages(newMessages);
    setTotalSpeakingTime(prev => prev + speakingTime);
    setTotalTime(prev => prev + 10);
    setInputText('');
  };

  const getAIResponse = () => {
    const responses = [
      "That sounds great! Could you tell me more?",
      "Interesting! What else would you like to add?",
      "I see. And what about the size?",
      "Perfect! Is there anything else I can help you with?",
      "That's a good point. What do you think about that?",
    ];
    return responses[Math.floor(Math.random() * responses.length)];
  };

  const handleMicToggle = () => {
    setIsRecording(!isRecording);
  };

  const currentTopic = TOPICS.find(t => t.id === topic);

  return (
    <StudentLayout todayTime={totalTime}>
      <Box sx={{ maxWidth: 700, mx: 'auto', width: '100%' }}>
        {/* 주제 선택 + WebSocket 상태 */}
        <Card sx={{ mb: 2 }} elevation={2}>
          <CardContent>
            <Stack direction="row" alignItems="center" spacing={2}>
              <FormControl size="small" sx={{ minWidth: 150 }}>
                <InputLabel>주제</InputLabel>
                <Select value={topic} label="주제" onChange={handleTopicChange}>
                  {TOPICS.map((t) => (
                    <MenuItem key={t.id} value={t.id}>
                      {t.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <Chip 
                label={currentTopic?.difficulty} 
                size="small"
                color={
                  currentTopic?.difficulty === '초급' ? 'success' :
                  currentTopic?.difficulty === '중급' ? 'warning' : 'error'
                }
              />
              <Box sx={{ flexGrow: 1 }} />
              <Chip 
                icon={<Notifications />}
                label={isConnected ? '연결됨' : '연결 안됨'}
                color={isConnected ? 'success' : 'error'}
                size="small"
              />
              <Typography variant="body2" color="text.secondary">
                발음: {totalSpeakingTime.toFixed(1)}초
              </Typography>
            </Stack>
          </CardContent>
        </Card>

        {/* 튜터 피드백 영역 (있을 경우만 표시) */}
        {feedbacks.length > 0 && (
          <Card sx={{ mb: 2, bgcolor: '#fff3e0' }} elevation={2}>
            <CardContent>
              <Typography variant="subtitle2" fontWeight="bold" mb={1}>
                👨‍🏫 튜터 피드백
              </Typography>
              <Stack spacing={1}>
                {feedbacks.slice(0, 3).map((feedback, idx) => (
                  <Paper key={idx} sx={{ p: 1.5, bgcolor: 'white' }}>
                    <Stack direction="row" spacing={1} alignItems="flex-start">
                      <Avatar sx={{ width: 24, height: 24, bgcolor: 'primary.main', fontSize: 14 }}>
                        👨‍🏫
                      </Avatar>
                      <Box flex={1}>
                        <Typography variant="body2">
                          {feedback.message}
                        </Typography>
                        {feedback.audioUrl && (
                          <audio controls src={feedback.audioUrl} style={{ width: '100%', height: 30, marginTop: 4 }} />
                        )}
                        <Typography variant="caption" color="text.secondary">
                          {new Date(feedback.timestamp).toLocaleTimeString('ko-KR')}
                        </Typography>
                      </Box>
                    </Stack>
                  </Paper>
                ))}
                {feedbacks.length > 3 && (
                  <Typography variant="caption" color="text.secondary" textAlign="center">
                    +{feedbacks.length - 3}개 더보기
                  </Typography>
                )}
              </Stack>
            </CardContent>
          </Card>
        )}

        {/* 대화 영역 */}
        <Paper 
          sx={{ 
            height: 400, 
            overflow: 'auto', 
            mb: 2, 
            p: 2,
            bgcolor: '#fafafa',
          }} 
          elevation={1}
        >
          <List>
            {messages.map((msg, index) => (
              <ListItem 
                key={index}
                sx={{ 
                  flexDirection: msg.role === 'user' ? 'row-reverse' : 'row',
                  alignItems: 'flex-start',
                }}
              >
                <ListItemAvatar sx={{ minWidth: msg.role === 'user' ? 0 : 56, ml: msg.role === 'user' ? 2 : 0 }}>
                  <Avatar sx={{ bgcolor: msg.role === 'ai' ? 'primary.main' : 'secondary.main' }}>
                    {msg.role === 'ai' ? <SmartToy /> : <Person />}
                  </Avatar>
                </ListItemAvatar>
                <Box 
                  sx={{ 
                    maxWidth: '70%',
                    bgcolor: msg.role === 'ai' ? 'white' : 'primary.light',
                    color: msg.role === 'ai' ? 'text.primary' : 'white',
                    p: 2,
                    borderRadius: 2,
                    boxShadow: 1,
                  }}
                >
                  <Typography variant="body1">{msg.content}</Typography>
                  <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 1 }}>
                    {msg.role === 'ai' && (
                      <IconButton size="small" color="primary">
                        <VolumeUp fontSize="small" />
                      </IconButton>
                    )}
                    {msg.speakingTime && (
                      <Typography variant="caption" color={msg.role === 'ai' ? 'text.secondary' : 'inherit'}>
                        발음: {msg.speakingTime.toFixed(1)}초
                      </Typography>
                    )}
                  </Stack>
                </Box>
              </ListItem>
            ))}
          </List>
        </Paper>

        {/* 입력 영역 */}
        <Card elevation={2}>
          <CardContent>
            <Stack direction="row" spacing={2} alignItems="center">
              <IconButton 
                onClick={handleMicToggle}
                color={isRecording ? 'error' : 'primary'}
                sx={{ 
                  bgcolor: isRecording ? 'error.light' : 'primary.light',
                  '&:hover': {
                    bgcolor: isRecording ? 'error.main' : 'primary.main',
                  }
                }}
              >
                {isRecording ? <MicOff /> : <Mic />}
              </IconButton>
              <TextField
                fullWidth
                placeholder="영어로 답변하세요..."
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSend()}
                size="small"
              />
              <Button 
                variant="contained" 
                endIcon={<Send />}
                onClick={handleSend}
                disabled={!inputText.trim()}
              >
                전송
              </Button>
            </Stack>
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
