import { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  Typography,
  Avatar,
  Stack,
  Box,
} from '@mui/material';

export default function TutorRequestDialog({ open, tutor, onClose, onSubmit }) {
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      await onSubmit(message);
      setMessage(''); // 초기화
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    setMessage('');
    onClose();
  };

  if (!tutor) return null;

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>튜터 등록 요청</DialogTitle>
      
      <DialogContent>
        <Stack spacing={3} mt={1}>
          {/* 튜터 정보 */}
          <Box
            sx={{
              p: 2,
              bgcolor: 'grey.50',
              borderRadius: 1,
              border: '1px solid',
              borderColor: 'grey.200',
            }}
          >
            <Stack direction="row" spacing={2} alignItems="center">
              <Avatar
                src={tutor.profile_image}
                alt={tutor.name}
                sx={{ width: 56, height: 56 }}
              />
              <Box>
                <Typography variant="h6">{tutor.name}</Typography>
                <Typography variant="body2" color="text.secondary">
                  {tutor.bio}
                </Typography>
              </Box>
            </Stack>
          </Box>

          {/* 요청 메시지 */}
          <TextField
            fullWidth
            multiline
            rows={4}
            label="요청 메시지 (선택사항)"
            placeholder="튜터님께 전달할 메시지를 입력해주세요."
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            helperText={`${message.length}/500`}
            inputProps={{ maxLength: 500 }}
          />

          <Typography variant="caption" color="text.secondary">
            💡 등록 요청을 보내면 튜터가 검토 후 승인/거부합니다.
          </Typography>
        </Stack>
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 3 }}>
        <Button onClick={handleClose} disabled={submitting}>
          취소
        </Button>
        <Button
          variant="contained"
          onClick={handleSubmit}
          disabled={submitting}
        >
          {submitting ? '요청 중...' : '요청 보내기'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
