// 학습 통계 페이지 (목업)

import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  LinearProgress,
  Stack,
  Divider,
} from '@mui/material';
import {
  Timer,
  RecordVoiceOver,
  MenuBook,
  Chat,
  TrendingUp,
} from '@mui/icons-material';
import StudentLayout from '../../components/common/StudentLayout';

// 목업 통계 데이터
const MOCK_TODAY = {
  totalDuration: 25 * 60, // 25분 (초)
  speakingDuration: 17 * 60, // 17분 (초)
  speakingRatio: 68,
  sentenceSessions: { duration: 15 * 60, ratio: 72 },
  aiChatSessions: { duration: 10 * 60, ratio: 62 },
};

const MOCK_WEEKLY = [
  { day: '월', duration: 30, ratio: 70 },
  { day: '화', duration: 25, ratio: 65 },
  { day: '수', duration: 0, ratio: 0 },
  { day: '목', duration: 25, ratio: 68 },
  { day: '금', duration: 0, ratio: 0 },
  { day: '토', duration: 0, ratio: 0 },
  { day: '일', duration: 0, ratio: 0 },
];

function formatTime(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}분 ${secs}초`;
}

function StatCard({ icon, title, value, subValue, color = 'primary' }) {
  return (
    <Card elevation={2}>
      <CardContent>
        <Stack direction="row" alignItems="center" spacing={2}>
          <Box 
            sx={{ 
              p: 1.5, 
              borderRadius: 2, 
              bgcolor: `${color}.light`,
              color: `${color}.main`,
            }}
          >
            {icon}
          </Box>
          <Box sx={{ flexGrow: 1 }}>
            <Typography variant="body2" color="text.secondary">
              {title}
            </Typography>
            <Typography variant="h5" fontWeight={600}>
              {value}
            </Typography>
            {subValue && (
              <Typography variant="caption" color="text.secondary">
                {subValue}
              </Typography>
            )}
          </Box>
        </Stack>
      </CardContent>
    </Card>
  );
}

export default function StatsPage() {
  const todayTime = MOCK_TODAY.totalDuration;

  return (
    <StudentLayout todayTime={todayTime}>
      <Box sx={{ maxWidth: 800, mx: 'auto', width: '100%' }}>
        {/* 오늘 학습 현황 */}
        <Typography variant="h5" fontWeight={600} sx={{ mb: 3 }}>
          📊 오늘 학습 현황
        </Typography>

        <Grid container spacing={2} sx={{ mb: 4 }}>
          <Grid item xs={12} sm={6} md={3}>
            <StatCard
              icon={<Timer />}
              title="총 학습 시간"
              value={formatTime(MOCK_TODAY.totalDuration)}
              color="primary"
            />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <StatCard
              icon={<RecordVoiceOver />}
              title="발음 시간"
              value={formatTime(MOCK_TODAY.speakingDuration)}
              subValue={`전체의 ${MOCK_TODAY.speakingRatio}%`}
              color="success"
            />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <StatCard
              icon={<MenuBook />}
              title="문장 연습"
              value={formatTime(MOCK_TODAY.sentenceSessions.duration)}
              subValue={`발음 ${MOCK_TODAY.sentenceSessions.ratio}%`}
              color="info"
            />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <StatCard
              icon={<Chat />}
              title="AI 대화"
              value={formatTime(MOCK_TODAY.aiChatSessions.duration)}
              subValue={`발음 ${MOCK_TODAY.aiChatSessions.ratio}%`}
              color="secondary"
            />
          </Grid>
        </Grid>

        {/* 발음 비율 진행바 */}
        <Card elevation={2} sx={{ mb: 4 }}>
          <CardContent>
            <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 2 }}>
              오늘 발음 비율
            </Typography>
            <Box sx={{ mb: 1 }}>
              <Stack direction="row" justifyContent="space-between" sx={{ mb: 0.5 }}>
                <Typography variant="body2">발음 시간</Typography>
                <Typography variant="body2" fontWeight={600} color="primary.main">
                  {MOCK_TODAY.speakingRatio}%
                </Typography>
              </Stack>
              <LinearProgress 
                variant="determinate" 
                value={MOCK_TODAY.speakingRatio} 
                sx={{ 
                  height: 12, 
                  borderRadius: 6,
                  bgcolor: '#e0e0e0',
                  '& .MuiLinearProgress-bar': {
                    background: 'linear-gradient(90deg, #667eea 0%, #764ba2 100%)',
                    borderRadius: 6,
                  }
                }}
              />
            </Box>
          </CardContent>
        </Card>

        {/* 이번 주 학습 */}
        <Typography variant="h5" fontWeight={600} sx={{ mb: 3 }}>
          📅 이번 주 학습
        </Typography>

        <Card elevation={2}>
          <CardContent>
            <Grid container spacing={1}>
              {MOCK_WEEKLY.map((day, index) => (
                <Grid item xs key={day.day}>
                  <Box 
                    sx={{ 
                      textAlign: 'center',
                      p: 1,
                      borderRadius: 2,
                      bgcolor: day.duration > 0 ? 'primary.light' : 'grey.100',
                    }}
                  >
                    <Typography 
                      variant="caption" 
                      fontWeight={600}
                      color={day.duration > 0 ? 'primary.main' : 'text.secondary'}
                    >
                      {day.day}
                    </Typography>
                    <Typography 
                      variant="body2" 
                      fontWeight={600}
                      color={day.duration > 0 ? 'primary.main' : 'text.disabled'}
                    >
                      {day.duration > 0 ? `${day.duration}분` : '-'}
                    </Typography>
                    {day.duration > 0 && (
                      <Typography variant="caption" color="text.secondary">
                        {day.ratio}%
                      </Typography>
                    )}
                  </Box>
                </Grid>
              ))}
            </Grid>

            <Divider sx={{ my: 2 }} />

            <Stack direction="row" justifyContent="space-between" alignItems="center">
              <Box>
                <Typography variant="body2" color="text.secondary">
                  이번 주 총 학습
                </Typography>
                <Typography variant="h6" fontWeight={600}>
                  {MOCK_WEEKLY.reduce((sum, d) => sum + d.duration, 0)}분
                </Typography>
              </Box>
              <Box sx={{ textAlign: 'right' }}>
                <Typography variant="body2" color="text.secondary">
                  평균 발음 비율
                </Typography>
                <Typography variant="h6" fontWeight={600} color="success.main">
                  <TrendingUp sx={{ fontSize: 18, mr: 0.5, verticalAlign: 'middle' }} />
                  {Math.round(
                    MOCK_WEEKLY.filter(d => d.duration > 0).reduce((sum, d) => sum + d.ratio, 0) /
                    MOCK_WEEKLY.filter(d => d.duration > 0).length || 0
                  )}%
                </Typography>
              </Box>
            </Stack>
          </CardContent>
        </Card>
      </Box>
    </StudentLayout>
  );
}
