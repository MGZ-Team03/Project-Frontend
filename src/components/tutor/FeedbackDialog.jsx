// 튜터 피드백 다이얼로그 컴포넌트

import PropTypes from 'prop-types';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  Typography,
} from '@mui/material';
import { Send } from '@mui/icons-material';

/**
 * 튜터가 학생에게 피드백을 전송하는 다이얼로그 컴포넌트
 */
export default function FeedbackDialog({
  open,
  onClose,
  student,
  feedbackText,
  onFeedbackTextChange,
  onSubmit,
  sending = false,
}) {
  const handleTextChange = (e) => {
    onFeedbackTextChange(e.target.value);
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
    >
      <DialogTitle>
        📨 피드백 전송: {student?.name}
      </DialogTitle>
      <DialogContent>
        <TextField
          autoFocus
          fullWidth
          multiline
          rows={4}
          placeholder="학생에게 전달할 피드백을 입력하세요..."
          value={feedbackText}
          onChange={handleTextChange}
          disabled={sending}
          sx={{ mt: 2 }}
        />
        <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
          학생: {student?.email}
        </Typography>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={sending}>
          취소
        </Button>
        <Button
          variant="contained"
          onClick={onSubmit}
          disabled={sending || !feedbackText.trim()}
          startIcon={<Send />}
        >
          {sending ? '전송 중...' : '전송'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

FeedbackDialog.propTypes = {
  open: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  student: PropTypes.shape({
    name: PropTypes.string,
    email: PropTypes.string,
  }),
  feedbackText: PropTypes.string.isRequired,
  onFeedbackTextChange: PropTypes.func.isRequired,
  onSubmit: PropTypes.func.isRequired,
  sending: PropTypes.bool,
};
