import { Card, Typography, Stack, Box } from '@mui/material';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';

export default function ActivityDistributionChart({ data }) {
  return (
    <Card elevation={0} sx={{ p: 3, borderRadius: 3, border: '1px solid', borderColor: 'divider', height: 290 }}>
      <Typography variant="h6" fontWeight={600} sx={{ mb: 1 }}>
        활동 분포
      </Typography>
      <Typography variant="caption" color="text.secondary" sx={{ mb: 2, display: 'block' }}>
        이번 달
      </Typography>
      
      <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 1 }}>
        <Box sx={{ flexShrink: 0 }}>
          <ResponsiveContainer width={180} height={180}>
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={40}
                outerRadius={60}
                paddingAngle={3}
                dataKey="value"
              >
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </Box>

        {/* 범례 */}
        <Stack spacing={1.5} sx={{ flexGrow: 1, pl: 1 }}>
          {data.map((item, index) => (
            <Stack key={index} direction="row" alignItems="center" spacing={1}>
              <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: item.color }} />
              <Typography variant="caption" color="text.secondary">{item.name}</Typography>
            </Stack>
          ))}
        </Stack>
      </Stack>
    </Card>
  );
}
