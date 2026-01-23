import { Grid, Card, Stack, Box, Typography } from '@mui/material';
import { Timer, RecordVoiceOver, EmojiEvents, TrendingUp, TrendingDown } from '@mui/icons-material';

function KPICard({ icon, label, value, unit, change, gradient }) {
  const isPositive = change >= 0;
  
  return (
    <Card 
      elevation={0}
      sx={{ 
        p: 2.5,
        borderRadius: 3,
        background: gradient,
        color: 'white',
        height: '100%',
      }}
    >
      <Stack spacing={1}>
        <Stack direction="row" alignItems="center" justifyContent="space-between">
          <Box sx={{ 
            p: 1, 
            borderRadius: 2, 
            bgcolor: 'rgba(255,255,255,0.2)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            {icon}
          </Box>
          <Stack direction="row" alignItems="center" spacing={0.5}>
            {isPositive ? (
              <TrendingUp sx={{ fontSize: 16 }} />
            ) : (
              <TrendingDown sx={{ fontSize: 16 }} />
            )}
            <Typography variant="caption" fontWeight={600}>
              {isPositive ? '+' : ''}{change}%
            </Typography>
          </Stack>
        </Stack>
        <Typography variant="caption" sx={{ opacity: 0.9 }}>
          {label}
        </Typography>
        <Typography variant="h4" fontWeight={700}>
          {value.toLocaleString()}{unit && <Typography component="span" variant="body1" sx={{ ml: 0.5 }}>{unit}</Typography>}
        </Typography>
      </Stack>
    </Card>
  );
}

export default function KPICards({ kpiData }) {
  return (
    <Grid container spacing={2} sx={{ mb: 4 }}>
      <Grid item xs={12} sm={4} sx={{ minWidth: 240 }}>
        <KPICard
          icon={<Timer />}
          label="총 학습 시간"
          value={kpiData.totalTime.value}
          unit="분"
          change={kpiData.totalTime.change}
          gradient="linear-gradient(135deg, #667eea 0%, #764ba2 100%)"
        />
      </Grid>
      <Grid item xs={12} sm={4} sx={{ minWidth: 240 }}>
        <KPICard
          icon={<RecordVoiceOver />}
          label="발음 시간"
          value={kpiData.speakingTime.value}
          unit="분"
          change={kpiData.speakingTime.change}
          gradient="linear-gradient(135deg, #f093fb 0%, #f5576c 100%)"
        />
      </Grid>
      <Grid item xs={12} sm={4} sx={{ minWidth: 240 }}>
        <KPICard
          icon={<EmojiEvents />}
          label="연습 횟수"
          value={kpiData.practiceCount.value}
          unit="회"
          change={kpiData.practiceCount.change}
          gradient="linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)"
        />
      </Grid>
    </Grid>
  );
}
