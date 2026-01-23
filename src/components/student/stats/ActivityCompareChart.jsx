import { Card, Typography, Stack, Box } from '@mui/material';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export default function ActivityCompareChart({ data }) {
  return (
    <Card elevation={0} sx={{ p: 3, borderRadius: 3, border: '1px solid', borderColor: 'divider', height: 290 }}>
      <Typography variant="h6" fontWeight={600} sx={{ mb: 2 }}>
        활동 비교
      </Typography>
      <Stack direction="row" spacing={2} alignItems="center">
        <Box sx={{ width: 200 }}>
          <ResponsiveContainer width="100%" height={200} style={{ marginLeft: -30 }}>
            <BarChart data={data} barCategoryGap="30%">
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
              <XAxis 
                dataKey="name" 
                axisLine={false} 
                tickLine={false}
                tick={false}
              />
              <YAxis 
                axisLine={false} 
                tickLine={false}
                tick={false}
              />
              <Tooltip />
              <Bar dataKey="sentence" stackId="a" fill="#6366f1" name="문장 연습" barSize={25} />
              <Bar dataKey="aiChat" stackId="a" fill="#f43f5e" name="AI 대화" barSize={25} />
            </BarChart>
          </ResponsiveContainer>
        </Box>
        
        {/* 범례 */}
        <Stack spacing={1.5} sx={{ minWidth: 80 }}>
          <Stack direction="row" alignItems="center" spacing={1}>
            <Box sx={{ width: 12, height: 12, borderRadius: 1, bgcolor: '#6366f1' }} />
            <Typography variant="caption" color="text.secondary">문장 연습</Typography>
          </Stack>
          <Stack direction="row" alignItems="center" spacing={1}>
            <Box sx={{ width: 12, height: 12, borderRadius: 1, bgcolor: '#f43f5e' }} />
            <Typography variant="caption" color="text.secondary">AI 대화</Typography>
          </Stack>
        </Stack>
      </Stack>
    </Card>
  );
}
