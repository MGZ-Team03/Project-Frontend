import { Card, Typography, Grid, Box, Stack, Divider } from '@mui/material';

export default function WeeklySummary({ weeklySummary }) {
  return (
    <Card elevation={0} sx={{ p: 3, borderRadius: 3, border: '1px solid', borderColor: 'divider', mb: 4, width: 940 }}>
      <Typography variant="h6" fontWeight={600} sx={{ mb: 3 }}>
        이번 주 요약
      </Typography>
      
      <Grid container spacing={3}>
        <Grid item sx={{ flexGrow: 1 }}>
          <Box sx={{ textAlign: 'center', p: 2, bgcolor: 'grey.50', borderRadius: 2 }}>
            <Typography variant="h4" fontWeight={700} color="primary.main">
              {weeklySummary.speakingRatio}%
            </Typography>
            <Typography variant="caption" color="text.secondary">
              발음 비율
            </Typography>
          </Box>
        </Grid>
        <Grid item sx={{ flexGrow: 1 }}>
          <Box sx={{ textAlign: 'center', p: 2, bgcolor: 'grey.50', borderRadius: 2 }}>
            <Typography variant="h4" fontWeight={700} color="success.main">
              {weeklySummary.avgResponse}초
            </Typography>
            <Typography variant="caption" color="text.secondary">
              평균 응답 시간
            </Typography>
          </Box>
        </Grid>
        <Grid item sx={{ flexGrow: 1 }}>
          <Box sx={{ textAlign: 'center', p: 2, bgcolor: 'grey.50', borderRadius: 2 }}>
            <Typography variant="h4" fontWeight={700} color="warning.main">
              {weeklySummary.tutorFeedbacks}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              튜터 피드백
            </Typography>
          </Box>
        </Grid>
        <Grid item sx={{ flexGrow: 1 }}>
          <Box sx={{ textAlign: 'center', p: 2, bgcolor: 'grey.50', borderRadius: 2 }}>
            <Typography variant="h4" fontWeight={700} color="info.main">
              {weeklySummary.paceRatio}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              속도 비율
            </Typography>
          </Box>
        </Grid>
      </Grid>

      <Divider sx={{ my: 3 }} />

      <Stack direction="row" justifyContent="space-between" alignItems="center">
        <Box>
          <Typography variant="body2" color="text.secondary">
            이번 주 총합
          </Typography>
          <Typography variant="h5" fontWeight={700}>
            {weeklySummary.totalMinutes}분
          </Typography>
        </Box>
        <Box>
          <Typography variant="body2" color="text.secondary" align="right">
            이번 주 세션
          </Typography>
          <Typography variant="h5" fontWeight={700} align="right">
            {weeklySummary.totalSessions}회
          </Typography>
        </Box>
      </Stack>
    </Card>
  );
}
