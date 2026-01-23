import { useEffect } from 'react';
import { useSelector } from 'react-redux';
import { Box, LinearProgress, Stack, Typography, CircularProgress } from '@mui/material';
import Header from './Header';
import BottomNav from './BottomNav';
import { useWhisperGlobalPreload } from '../../hooks/useWhisperSTT';
import {
  selectWhisperPreloadStatus,
  selectWhisperProgress,
} from '../../store/slices/whisperPreloadSlice';

export default function StudentLayout({ 
  children, 
  todayTime = 0, 
  onTutorSearchClick, 
  onNotificationClick, 
  unreadNotificationCount = 0 
}) {
  const { preloadGlobal } = useWhisperGlobalPreload();
  const whisperStatus = useSelector(selectWhisperPreloadStatus);
  const whisperProgress = useSelector(selectWhisperProgress);
  const dailyRecordingMs = useSelector((state) => state.speakingStats?.dailyStats?.totalRecordingTime || 0);
  const sessionRecordingMs = useSelector((state) => state.speakingStats?.currentSession?.totalRecordingTime || 0);
  const todayTimeSec = Math.floor((dailyRecordingMs + sessionRecordingMs) / 1000);

  // 마운트 시 1회 preload (이미 ready면 스킵)
  useEffect(() => {
    preloadGlobal();
  }, [preloadGlobal]);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', bgcolor: '#f5f5f5' }}>
      <Header 
        todayTime={todayTimeSec} 
        onTutorSearchClick={onTutorSearchClick}
        onNotificationClick={onNotificationClick}
        unreadNotificationCount={unreadNotificationCount}
      />

      {/* Whisper 로딩 배너 - loading 상태일 때만 표시 */}
      {whisperStatus === 'loading' && (
        <Box sx={{ px: 2, py: 1.5, bgcolor: 'primary.light', color: 'primary.contrastText' }}>
          <Stack spacing={1}>
            <Stack direction="row" alignItems="center" spacing={1}>
              <CircularProgress size={16} color="inherit" />
              <Typography variant="body2" fontWeight={500}>
                음성인식 모델 준비 중...
              </Typography>
              {whisperProgress?.percent != null && (
                <Typography variant="body2" fontWeight={600}>
                  {whisperProgress.percent}%
                </Typography>
              )}
            </Stack>
            <LinearProgress
              variant={whisperProgress?.percent != null ? 'determinate' : 'indeterminate'}
              value={whisperProgress?.percent || 0}
              sx={{
                bgcolor: 'rgba(255, 255, 255, 0.3)',
                '& .MuiLinearProgress-bar': {
                  bgcolor: 'primary.contrastText',
                },
              }}
            />
            {whisperProgress?.file && (
              <Typography variant="caption" sx={{ opacity: 0.9 }}>
                파일: {whisperProgress.file}
              </Typography>
            )}
          </Stack>
        </Box>
      )}

      <Box
        sx={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          p: 3,
          pb: 10, // 하단 네비게이션 공간
        }}
      >
        {children}
      </Box>

      <BottomNav />
    </Box>
  );
}
