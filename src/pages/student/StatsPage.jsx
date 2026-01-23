// 학습 통계 페이지 (Speaking Analytics)

import { Box, Typography, Stack, Grid } from '@mui/material';
import { useSelector } from 'react-redux';
import StudentLayout from '../../components/common/StudentLayout';
import KPICards from '../../components/student/stats/KPICards';
import WeeklySummary from '../../components/student/stats/WeeklySummary';
import LearningTrendChart from '../../components/student/stats/LearningTrendChart';
import ActivityCompareChart from '../../components/student/stats/ActivityCompareChart';
import ActivityDistributionChart from '../../components/student/stats/ActivityDistributionChart';

// TODO: 백엔드 API 준비되면 아래 목 데이터 제거하고 실제 API 연동

// 목업 데이터
const MOCK_KPI = {
  totalTime: { value: 1250, change: 65, unit: '분' },
  speakingTime: { value: 847, change: 25, unit: '분' },
  practiceCount: { value: 156, change: -5, unit: '회' },
};

const MOCK_WEEKLY_SUMMARY = {
  speakingRatio: 68,
  avgResponse: '1.2',
  tutorFeedbacks: 23,
  paceRatio: '0.95',
  totalMinutes: 375,
  totalSessions: 12,
};

const MOCK_WEEKLY_TREND = [
  { name: '월', speaking: 45, listening: 30, practice: 25 },
  { name: '화', speaking: 52, listening: 35, practice: 30 },
  { name: '수', speaking: 38, listening: 28, practice: 22 },
  { name: '목', speaking: 65, listening: 42, practice: 35 },
  { name: '금', speaking: 55, listening: 38, practice: 28 },
  { name: '토', speaking: 72, listening: 48, practice: 40 },
  { name: '일', speaking: 48, listening: 32, practice: 26 },
];

const MOCK_MONTHLY_TREND = [
  { name: '1월', speaking: 320, listening: 210, practice: 180 },
  { name: '2월', speaking: 380, listening: 250, practice: 220 },
  { name: '3월', speaking: 290, listening: 190, practice: 160 },
  { name: '4월', speaking: 420, listening: 280, practice: 240 },
  { name: '5월', speaking: 510, listening: 340, practice: 290 },
  { name: '6월', speaking: 480, listening: 320, practice: 270 },
  { name: '7월', speaking: 550, listening: 370, practice: 310 },
  { name: '8월', speaking: 490, listening: 330, practice: 280 },
  { name: '9월', speaking: 580, listening: 390, practice: 330 },
  { name: '10월', speaking: 620, listening: 410, practice: 350 },
  { name: '11월', speaking: 540, listening: 360, practice: 300 },
  { name: '12월', speaking: 600, listening: 400, practice: 340 },
];

const MOCK_ACTIVITY_COMPARE = [
  { name: '1주차', sentence: 45, aiChat: 38 },
  { name: '2주차', sentence: 52, aiChat: 42 },
  { name: '3주차', sentence: 48, aiChat: 35 },
  { name: '4주차', sentence: 60, aiChat: 48 },
];

const MOCK_ACTIVITY_DISTRIBUTION = [
  { name: '문장 연습', value: 45, color: '#6366f1' },
  { name: 'AI 대화', value: 35, color: '#22c55e' },
  { name: '튜터 피드백', value: 20, color: '#fbbf24' },
];

export default function StatsPage() {
  const user = useSelector((state) => state.auth.user);

  // TODO: 백엔드 API 준비되면 아래 주석 해제하고 목 데이터 제거
  // const [todayStats, setTodayStats] = useState(null);
  // const [weeklyStats, setWeeklyStats] = useState(null);
  // const [loading, setLoading] = useState(true);
  // const [error, setError] = useState(null);

  // 임시 목 데이터 사용 (백엔드 API 준비 전)
  const kpiData = MOCK_KPI;
  const weeklySummary = MOCK_WEEKLY_SUMMARY;

  return (
    <StudentLayout todayTime={kpiData.totalTime.value}>
      <Box sx={{ maxWidth: 1200, mx: 'auto', width: '100%' }}>
        {/* 헤더 */}
        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 3 }}>
          <Typography variant="h5" fontWeight={700}>
            학습 통계
          </Typography>
        </Stack>

        {/* KPI 카드 */}
        <KPICards kpiData={kpiData} />

        {/* 이번 주 요약 */}
        <WeeklySummary weeklySummary={weeklySummary} />

        {/* 메인 차트 섹션 */}
        <Grid container spacing={3}>
          {/* 학습 추이 라인 차트 */}
          <Grid item xs={12} md={8}>
            <LearningTrendChart 
              weeklyData={MOCK_WEEKLY_TREND}
              monthlyData={MOCK_MONTHLY_TREND}
            />
          </Grid>

          {/* 활동 비교 & 분포 차트 */}
          <Grid item xs={12} md={4}>
            <Stack spacing={3}>
              <ActivityCompareChart data={MOCK_ACTIVITY_COMPARE} />
              <ActivityDistributionChart data={MOCK_ACTIVITY_DISTRIBUTION} />
            </Stack>
          </Grid>
        </Grid>
      </Box>
    </StudentLayout>
  );
}
