import { useState } from 'react';
import { Card, Typography, Stack, Box, FormControl, Select, MenuItem } from '@mui/material';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

// 커스텀 툴팁
function CustomTooltip({ active, payload, label }) {
  if (active && payload && payload.length) {
    return (
      <Card sx={{ p: 1.5, boxShadow: 3 }}>
        <Typography variant="caption" color="text.secondary">{label}</Typography>
        {payload.map((entry, index) => (
          <Typography key={index} variant="body2" sx={{ color: entry.color }}>
            {entry.name}: {entry.value}분
          </Typography>
        ))}
      </Card>
    );
  }
  return null;
}

export default function LearningTrendChart({ weeklyData, monthlyData }) {
  const [trendPeriod, setTrendPeriod] = useState('weekly');
  const trendData = trendPeriod === 'weekly' ? weeklyData : monthlyData;

  return (
    <Card elevation={0} sx={{ p: 3, borderRadius: 3, border: '1px solid', borderColor: 'divider', minWidth: 740, minHeight: 604 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 3 }}>
        <Typography variant="h6" fontWeight={600}>
          학습 추이
        </Typography>
        <FormControl size="small" sx={{ minWidth: 100 }}>
          <Select
            value={trendPeriod}
            onChange={(e) => setTrendPeriod(e.target.value)}
            sx={{ borderRadius: 2 }}
          >
            <MenuItem value="weekly">주간</MenuItem>
            <MenuItem value="monthly">월간</MenuItem>
          </Select>
        </FormControl>
      </Stack>
      
      {/* 범례 */}
      <Stack direction="row" spacing={3} justifyContent="center" sx={{ mb: 2 }}>
        <Stack direction="row" alignItems="center" spacing={1}>
          <Box sx={{ width: 12, height: 12, borderRadius: '50%', bgcolor: '#6366f1' }} />
          <Typography variant="caption" color="text.secondary">발음</Typography>
        </Stack>
        <Stack direction="row" alignItems="center" spacing={1}>
          <Box sx={{ width: 12, height: 12, borderRadius: '50%', bgcolor: '#f43f5e' }} />
          <Typography variant="caption" color="text.secondary">듣기</Typography>
        </Stack>
        <Stack direction="row" alignItems="center" spacing={1}>
          <Box sx={{ width: 12, height: 12, borderRadius: '50%', bgcolor: '#10b981' }} />
          <Typography variant="caption" color="text.secondary">연습</Typography>
        </Stack>
      </Stack>

      <ResponsiveContainer width="100%" height={280}>
        <LineChart data={trendData}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis 
            dataKey="name" 
            axisLine={false} 
            tickLine={false}
            tick={{ fill: '#9ca3af', fontSize: 12 }}
          />
          <YAxis 
            axisLine={false} 
            tickLine={false}
            tick={false}
          />
          <Tooltip content={<CustomTooltip />} />
          <Line 
            type="monotone" 
            dataKey="speaking" 
            stroke="#6366f1" 
            strokeWidth={3}
            dot={false}
            activeDot={false}
            name="발음"
          />
          <Line 
            type="monotone" 
            dataKey="listening" 
            stroke="#f43f5e" 
            strokeWidth={3}
            dot={false}
            activeDot={false}
            name="듣기"
          />
          <Line 
            type="monotone" 
            dataKey="practice" 
            stroke="#10b981" 
            strokeWidth={3}
            dot={false}
            activeDot={false}
            name="연습"
          />
        </LineChart>
      </ResponsiveContainer>
    </Card>
  );
}
