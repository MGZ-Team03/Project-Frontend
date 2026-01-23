import { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Stack,
  Typography,
  Chip,
  Alert,
  Box,
  CircularProgress,
  Paper,
  Avatar,
  TextField,
} from '@mui/material';
import { Notifications, Send } from '@mui/icons-material';

export default function FeedbackDialog({
  open,
  onClose,
  feedbacks,
  loadingHistory,
  isConnected,
  wsError,
  userEmail,
  onSendWebSocket,
  onAddLocal,
}) {
  const [mockFeedbackText, setMockFeedbackText] = useState('');

  const handleLocalAdd = () => {
    if (mockFeedbackText.trim()) {
      onAddLocal(mockFeedbackText);
      setMockFeedbackText('');
    }
  };

  const handleWebSocketSend = () => {
    if (mockFeedbackText.trim()) {
      onSendWebSocket(mockFeedbackText);
      setMockFeedbackText('');
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        <Stack direction="row" alignItems="center" spacing={2}>
          <Typography variant="h6" flex={1}>튜터 피드백</Typography>
          <Chip
            icon={<Notifications />}
            label={isConnected ? 'WebSocket 연결됨' : 'WebSocket 연결 안됨'}
            color={isConnected ? 'success' : 'error'}
            size="small"
          />
        </Stack>
      </DialogTitle>

      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          {/* WebSocket 상태 정보 */}
          <Alert severity={isConnected ? 'success' : 'warning'}>
            <Typography variant="body2" fontWeight="bold" mb={0.5}>
              연결 상태: {isConnected ? '✅ 연결됨' : '❌ 연결 안됨'}
            </Typography>
            <Typography variant="caption">
              사용자 이메일: {userEmail}
            </Typography>
            {wsError && (
              <Typography variant="caption" color="error" display="block" mt={0.5}>
                에러: {wsError}
              </Typography>
            )}
          </Alert>

          {/* 받은 피드백 목록 */}
          {loadingHistory ? (
            <Box textAlign="center" py={3}>
              <CircularProgress size={40} />
              <Typography variant="body2" color="text.secondary" mt={2}>
                피드백 히스토리 로딩 중...
              </Typography>
            </Box>
          ) : feedbacks.length > 0 ? (
            <Box>
              <Typography variant="subtitle2" fontWeight="bold" mb={1}>
                받은 피드백 ({feedbacks.length})
              </Typography>
              <Stack spacing={1} sx={{ maxHeight: 300, overflow: 'auto' }}>
                {feedbacks.map((feedback, idx) => (
                  <Paper key={idx} sx={{ p: 1.5, bgcolor: '#f5f5f5' }} elevation={1}>
                    <Stack direction="row" spacing={1} alignItems="flex-start">
                      <Avatar sx={{ width: 28, height: 28, bgcolor: 'primary.main', fontSize: 14 }}>
                        👨‍🏫
                      </Avatar>
                      <Box flex={1}>
                        <Typography variant="body2" fontWeight={500}>
                          {feedback.message}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {new Date(feedback.timestamp).toLocaleTimeString('ko-KR')}
                        </Typography>
                      </Box>
                    </Stack>
                  </Paper>
                ))}
              </Stack>
            </Box>
          ) : (
            <Alert severity="info">
              아직 받은 피드백이 없습니다.
            </Alert>
          )}

          {/* 구분선 */}
          <Box sx={{ borderTop: 1, borderColor: 'divider', pt: 2 }}>
            <Typography variant="subtitle2" fontWeight="bold" mb={1}>
              테스트 메시지 전송
            </Typography>
            <Alert severity="info" sx={{ mb: 2 }}>
              WebSocket이 연결되어 있으면 실제로 메시지가 전송됩니다. 연결 안되어 있으면 로컬에서만 표시됩니다.
            </Alert>

            <TextField
              label="테스트 메시지"
              multiline
              rows={3}
              fullWidth
              value={mockFeedbackText}
              onChange={(e) => setMockFeedbackText(e.target.value)}
              placeholder="테스트 메시지를 입력하세요..."
              helperText={isConnected ? '📡 WebSocket으로 전송됩니다' : '💾 로컬에만 저장됩니다'}
            />
          </Box>
        </Stack>
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose}>닫기</Button>
        <Button
          onClick={handleLocalAdd}
          variant="outlined"
          disabled={!mockFeedbackText.trim()}
        >
          로컬 추가
        </Button>
        {isConnected && (
          <Button
            onClick={handleWebSocketSend}
            variant="contained"
            disabled={!mockFeedbackText.trim()}
            startIcon={<Send />}
          >
            WebSocket 전송
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}
