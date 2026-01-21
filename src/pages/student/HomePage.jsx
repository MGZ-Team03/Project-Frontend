import { useNavigate } from 'react-router-dom';
import {useCallback, useState} from 'react';
import { useSelector } from 'react-redux';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Grid,
  LinearProgress,
  Stack,
  ToggleButtonGroup,
  ToggleButton,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from '@mui/material';
import {
  MenuBook,
  Chat,
  LocalFireDepartment,
  Timer,
  TrendingUp,
} from '@mui/icons-material';
import StudentLayout from '../../components/common/StudentLayout';
import { scenarios } from '../../data/conversation/scenarios';
import useWebSocket from "../../hooks/webSocket/useWebSocket.js";
import { selectWhisperPreloadStatus } from '../../store/slices/whisperPreloadSlice';

export default function HomePage() {
  const user = useSelector(state => state.auth.user);
  const navigate = useNavigate();
  const whisperStatus = useSelector(selectWhisperPreloadStatus);
  const [practiceDifficulty, setPracticeDifficulty] = useState('중');
  const [practiceTopicId, setPracticeTopicId] = useState('small_talk');
  const [chatDifficulty, setChatDifficulty] = useState('중');
  const [chatScenario, setChatScenario] = useState('small_talk');


  // 웹소켓 연결만 수행 (데이터 전송 없음)
  const getData = useCallback(() => {
    console.log("HomePage: no room 상태 전송");

    if(!user?.email) {
      console.log("❌ 사용자 정보 없음");
      return null;
    }
    return {
      action: "status",
      data: {
        tutorEmail: user.tutorEmail || "ssdii44@naver.com",
        studentEmail: user.email,
        status: "active",
        room: "no room",  // 홈은 "no room"
        assignedAt: new Date().toISOString().split("T")[0],
      }
    };
  },[user?.email]);

  const socket = useWebSocket(getData, {
    sendImmediately: true,
    enableInterval: true,
    interval: 5000
  });


  // TODO: 실제 데이터는 Redux나 API에서 가져오기
  const todayStats = {
    totalTime: 25, // 분
    speakingTime: 17, // 분
    speakingRatio: 68, // %
    streak: 5, // 연속 학습일
  };

  const formatTime = (minutes) => {
    if (minutes < 60) return `${minutes}분`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}시간 ${mins}분`;
  };

  return (
    <StudentLayout todayTime={todayStats.totalTime}>
      <Box sx={{ maxWidth: 800, mx: 'auto', width: '100%' }}>
        {/* 환영 메시지 */}
        <Box sx={{ mb: 4, textAlign: 'center' }}>
          <Typography variant="h4" sx={{ fontWeight: 700, mb: 1 }}>
            환영합니다! 👋
          </Typography>
          <Typography variant="body1" color="text.secondary">
            오늘도 즐겁게 영어 연습을 시작해볼까요?
          </Typography>
        </Box>

        {/* 오늘의 학습 요약 */}
        <Card
          elevation={3}
          sx={{
            mb: 4,
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          }}
        >
          <CardContent sx={{ p: 4 }}>
            <Typography
              variant="h5"
              sx={{ color: 'white', fontWeight: 600, mb: 3 }}
            >
              📊 오늘의 학습 현황
            </Typography>

            <Grid container spacing={3}>
              <Grid item xs={6} sm={3}>
                <Box sx={{ textAlign: 'center' }}>
                  <Timer sx={{ fontSize: 40, color: 'white', mb: 1 }} />
                  <Typography variant="h6" sx={{ color: 'white', fontWeight: 700 }}>
                    {formatTime(todayStats.totalTime)}
                  </Typography>
                  <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.8)' }}>
                    총 학습 시간
                  </Typography>
                </Box>
              </Grid>

              <Grid item xs={6} sm={3}>
                <Box sx={{ textAlign: 'center' }}>
                  <TrendingUp sx={{ fontSize: 40, color: 'white', mb: 1 }} />
                  <Typography variant="h6" sx={{ color: 'white', fontWeight: 700 }}>
                    {todayStats.speakingRatio}%
                  </Typography>
                  <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.8)' }}>
                    발음 비율
                  </Typography>
                </Box>
              </Grid>

              <Grid item xs={6} sm={3}>
                <Box sx={{ textAlign: 'center' }}>
                  <LocalFireDepartment sx={{ fontSize: 40, color: '#FF6B6B', mb: 1 }} />
                  <Typography variant="h6" sx={{ color: 'white', fontWeight: 700 }}>
                    {todayStats.streak}일
                  </Typography>
                  <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.8)' }}>
                    연속 학습
                  </Typography>
                </Box>
              </Grid>

              <Grid item xs={6} sm={3}>
                <Box sx={{ textAlign: 'center' }}>
                  <Typography variant="h6" sx={{ color: 'white', fontWeight: 700 }}>
                    {formatTime(todayStats.speakingTime)}
                  </Typography>
                  <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.8)' }}>
                    발음 시간
                  </Typography>
                </Box>
              </Grid>
            </Grid>

            {/* 발음 비율 프로그레스 바 */}
            <Box sx={{ mt: 3 }}>
              <Stack direction="row" justifyContent="space-between" sx={{ mb: 1 }}>
                <Typography variant="body2" sx={{ color: 'white' }}>
                  오늘의 발음 참여도
                </Typography>
                <Typography variant="body2" sx={{ color: 'white', fontWeight: 600 }}>
                  {todayStats.speakingRatio}%
                </Typography>
              </Stack>
              <LinearProgress
                variant="determinate"
                value={todayStats.speakingRatio}
                sx={{
                  height: 10,
                  borderRadius: 5,
                  bgcolor: 'rgba(255,255,255,0.3)',
                  '& .MuiLinearProgress-bar': {
                    bgcolor: 'white',
                    borderRadius: 5,
                  }
                }}
              />
            </Box>
          </CardContent>
        </Card>

        {/* 빠른 시작 버튼 */}
        <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
          🚀 빠른 시작
        </Typography>

        <Stack direction="row" spacing={2} sx={{ mb: 4 }}>
          <Card
            elevation={2}
            sx={{ flex: 1, display: 'flex', flexDirection: 'column' }}
          >
            <CardContent sx={{ p: 3, display: 'flex', flexDirection: 'column', height: '100%' }}>
              <Box sx={{ textAlign: 'center', mb: 3 }}>
                <Box
                  sx={{
                    width: 60,
                    height: 60,
                    borderRadius: '50%',
                    bgcolor: '#E3F2FD',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    mx: 'auto',
                    mb: 2,
                  }}
                >
                  <MenuBook sx={{ fontSize: 30, color: '#2196F3' }} />
                </Box>
                <Typography variant="h6" sx={{ fontWeight: 600, mb: 1 }}>
                  문장 연습
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ minHeight: 40 }}>
                  주어진 문장을 따라 읽으며<br />발음 시간을 측정해보세요
                </Typography>
              </Box>

              <Box sx={{ mb: 2, flexGrow: 1 }}>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                  난이도 선택
                </Typography>
                <ToggleButtonGroup
                  value={practiceDifficulty}
                  exclusive
                  onChange={(e, newValue) => newValue && setPracticeDifficulty(newValue)}
                  size="small"
                  fullWidth
                >
                  <ToggleButton value="하">하</ToggleButton>
                  <ToggleButton value="중">중</ToggleButton>
                  <ToggleButton value="상">상</ToggleButton>
                </ToggleButtonGroup>

                <Typography variant="body2" color="text.secondary" sx={{ mt: 2, mb: 1 }}>
                  문장 주제
                </Typography>
                <FormControl size="small" fullWidth>
                  <InputLabel>주제 선택</InputLabel>
                  <Select
                    value={practiceTopicId}
                    label="주제 선택"
                    onChange={(e) => setPracticeTopicId(e.target.value)}
                  >
                    {scenarios.map((s) => (
                      <MenuItem key={s.id} value={s.id}>
                        {s.title}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Box>

              <Button
                variant="contained"
                fullWidth
                disabled={whisperStatus !== 'ready'}
                onClick={() =>
                  navigate('/practice', {
                    state: { difficulty: practiceDifficulty, topicId: practiceTopicId },
                  })
                }
                sx={{
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  py: 1.5,
                }}
              >
                {whisperStatus === 'loading' ? '음성인식 로드 중...' : '시작하기'}
              </Button>
            </CardContent>
          </Card>

          <Card
            elevation={2}
            sx={{ flex: 1, display: 'flex', flexDirection: 'column' }}
          >
            <CardContent sx={{ p: 3, display: 'flex', flexDirection: 'column', height: '100%' }}>
              <Box sx={{ textAlign: 'center', mb: 3 }}>
                <Box
                  sx={{
                    width: 60,
                    height: 60,
                    borderRadius: '50%',
                    bgcolor: '#F3E5F5',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    mx: 'auto',
                    mb: 2,
                  }}
                >
                  <Chat sx={{ fontSize: 30, color: '#9C27B0' }} />
                </Box>
                <Typography variant="h6" sx={{ fontWeight: 600, mb: 1 }}>
                  AI 대화
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ minHeight: 40 }}>
                  AI와 자유롭게 영어로<br />대화해보세요
                </Typography>
              </Box>

              <Box sx={{ mb: 2, flexGrow: 1 }}>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                  난이도 선택
                </Typography>
                <ToggleButtonGroup
                  value={chatDifficulty}
                  exclusive
                  onChange={(e, newValue) => newValue && setChatDifficulty(newValue)}
                  size="small"
                  fullWidth
                >
                  <ToggleButton value="하">하</ToggleButton>
                  <ToggleButton value="중">중</ToggleButton>
                  <ToggleButton value="상">상</ToggleButton>
                </ToggleButtonGroup>

                <Typography variant="body2" color="text.secondary" sx={{ mt: 2, mb: 1 }}>
                  대화 주제
                </Typography>
                <FormControl size="small" fullWidth>
                  <InputLabel>주제 선택</InputLabel>
                  <Select
                    value={chatScenario}
                    label="주제 선택"
                    onChange={(e) => setChatScenario(e.target.value)}
                  >
                    {scenarios.map((s) => (
                      <MenuItem key={s.id} value={s.id}>
                        {s.title}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Box>

              <Button
                variant="contained"
                fullWidth
                disabled={whisperStatus !== 'ready'}
                onClick={() => navigate('/chat', {
                  state: {
                    difficulty: chatDifficulty,
                    scenario: chatScenario
                  }
                })}
                sx={{
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  py: 1.5,
                }}
              >
                {whisperStatus === 'loading' ? '음성인식 로드 중...' : '시작하기'}
              </Button>
            </CardContent>
          </Card>
        </Stack>

        {/* 학습 팁 */}
        <Card elevation={1} sx={{ mt: 4, bgcolor: '#FFF9C4' }}>
          <CardContent>
            <Typography variant="body2" sx={{ fontWeight: 600, mb: 1 }}>
              💡 학습 팁
            </Typography>
            <Typography variant="body2" color="text.secondary">
              매일 조금씩이라도 꾸준히 연습하는 것이 실력 향상의 지름길입니다.
              오늘도 {todayStats.streak}일째 연속 학습 중이시네요! 파이팅! 🔥
            </Typography>
          </CardContent>
        </Card>
      </Box>
    </StudentLayout>
  );
}
