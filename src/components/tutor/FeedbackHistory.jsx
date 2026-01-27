import { Box, Stack, Typography, Chip, Divider } from '@mui/material';

export default function FeedbackHistory({ feedbacks, maxDisplay = 3 }) {
  if (!feedbacks || feedbacks.length === 0) {
    return null;
  }

  return (
    <>
      <Divider sx={{ my: 2 }} />
      <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
        최근 피드백
      </Typography>
      <Stack spacing={1}>
        {feedbacks.slice(0, maxDisplay).map((fb, index) => (
          <Box 
            key={index}
            sx={{ 
              p: 1, 
              bgcolor: 'grey.100', 
              borderRadius: 1,
              fontSize: '0.875rem',
            }}
          >
            <Stack direction="row" spacing={1} alignItems="center">
              <Typography variant="caption" color="text.secondary">
                {fb.time}
              </Typography>
              <Chip 
                label={fb.type === 'tts' ? 'TTS' : '텍스트'} 
                size="small" 
                variant="outlined"
              />
            </Stack>
            <Typography variant="body2">{fb.message}</Typography>
          </Box>
        ))}
      </Stack>
    </>
  );
}
