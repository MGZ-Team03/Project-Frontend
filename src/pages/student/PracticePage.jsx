// 로그인 확인용 목업 페이지

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import { logout } from '../../store/slices/authSlice';
import {
  Box,
  AppBar,
  Toolbar,
  Typography,
  Button,
  Card,
  CardContent,
  LinearProgress,
  IconButton,
  BottomNavigation,
  BottomNavigationAction,
  Chip,
  Stack,
} from '@mui/material';
import {
  VolumeUp,
  SkipPrevious,
  SkipNext,
  Replay,
  Mic,
  MenuBook,
  Chat,
  BarChart,
  Logout,
} from '@mui/icons-material';

// 샘플 문장 데이터
const SAMPLE_SENTENCES = [
  { id: 1, text: "How are you doing today?", category: "greeting" },
  { id: 2, text: "The weather is nice today.", category: "daily" },
  { id: 3, text: "What time is it now?", category: "time" },
  { id: 4, text: "I would like a cup of coffee.", category: "cafe" },
  { id: 5, text: "Where is the nearest subway station?", category: "direction" },
];

export default function PracticePage() {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { user } = useSelector((state) => state.auth);
  
  const [currentIndex, setCurrentIndex] = useState(0);
  const [speakingTime, setSpeakingTime] = useState(0);
  const [totalTime, setTotalTime] = useState(0);
  const [navValue, setNavValue] = useState(0);

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

  const handleLogout = () => {
    dispatch(logout());
    navigate('/login');
  };

  const handleNavigation = (event, newValue) => {
    setNavValue(newValue);
    const routes = ['/practice', '/chat', '/stats'];
    navigate(routes[newValue]);
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', bgcolor: '#f5f5f5' }}>
      {/* 헤더 */}
      <AppBar position="static" sx={{ bgcolor: 'white', color: 'text.primary' }} elevation={1}>
        <Toolbar>
          <Typography variant="h6" sx={{ flexGrow: 0, mr: 4, color: 'primary.main', fontWeight: 700 }}>
            🎤 SpeakTracker
          </Typography>
          <Chip 
            label={`오늘 학습: ${Math.floor(totalTime / 60)}분 ${totalTime % 60}초`}
            color="primary"
            variant="outlined"
            sx={{ mr: 'auto' }}
          />
          <Typography variant="body2" sx={{ mr: 2 }}>
            {user?.name || user?.email}
          </Typography>
          <Button 
            onClick={handleLogout} 
            startIcon={<Logout />}
            variant="outlined"
            size="small"
          >
            로그아웃
          </Button>
        </Toolbar>
      </AppBar>

      {/* 메인 컨텐츠 */}
      <Box 
        sx={{ 
          flex: 1, 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          p: 3,
          pb: 10, // 하단 네비게이션 공간
        }}
      >
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

      {/* 하단 네비게이션 */}
      <BottomNavigation
        value={navValue}
        onChange={handleNavigation}
        showLabels
        sx={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          borderTop: 1,
          borderColor: 'divider',
        }}
      >
        <BottomNavigationAction label="연습" icon={<MenuBook />} />
        <BottomNavigationAction label="대화" icon={<Chat />} />
        <BottomNavigationAction label="통계" icon={<BarChart />} />
      </BottomNavigation>
    </Box>
  );
}
