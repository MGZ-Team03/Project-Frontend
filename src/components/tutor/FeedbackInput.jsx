import { useState } from 'react';
import { TextField, Button, Stack } from '@mui/material';
import { Send, VolumeUp } from '@mui/icons-material';
import useFeedbackSender from '../../hooks/useFeedbackSender';

export default function FeedbackInput({ 
  tutorEmail, 
  studentEmail, 
  onSuccess, 
  onError,
  showTTS = false,
  rows = 3,
  placeholder = "학생에게 보낼 피드백을 입력하세요..."
}) {
  const [feedbackText, setFeedbackText] = useState('');
  const { send, sending } = useFeedbackSender({ 
    tutorEmail, 
    studentEmail, 
    onSuccess, 
    onError 
  });

  const handleSendFeedback = async (withTTS) => {
    const success = await send(feedbackText, { withTTS });
    if (success) {
      setFeedbackText('');
    }
  };

  return (
    <>
      <TextField
        fullWidth
        multiline
        rows={rows}
        placeholder={placeholder}
        value={feedbackText}
        onChange={(e) => setFeedbackText(e.target.value)}
        disabled={sending}
        sx={{ mb: 2 }}
      />

      <Stack direction="row" spacing={1}>
        <Button
          variant="contained"
          startIcon={<Send />}
          onClick={() => handleSendFeedback(false)}
          disabled={!feedbackText.trim() || sending}
        >
          {sending ? '전송 중...' : '텍스트 전송'}
        </Button>
        {showTTS && (
          <Button
            variant="outlined"
            startIcon={<VolumeUp />}
            onClick={() => handleSendFeedback(true)}
            disabled={!feedbackText.trim() || sending}
          >
            {sending ? '전송 중...' : 'TTS 전송'}
          </Button>
        )}
      </Stack>
    </>
  );
}
