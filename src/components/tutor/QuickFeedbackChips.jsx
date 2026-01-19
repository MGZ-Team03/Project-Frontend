import { Box, Chip } from '@mui/material';
import useFeedbackSender from '../../hooks/useFeedbackSender';

const QUICK_FEEDBACKS = [
  { label: '👍 잘하고 있어요!', message: '발음이 좋아졌어요! 계속 연습하세요.' },
  { label: '💪 힘내세요!', message: '좀 더 천천히 발음해보세요.' },
  { label: '🔊 크게 말해요', message: '좀 더 크게 말씀해주세요.' },
];

export default function QuickFeedbackChips({ 
  student, 
  tutorEmail, 
  disabled,
  onSuccess,
  onError 
}) {
  const { send, sending } = useFeedbackSender({
    tutorEmail,
    studentEmail: student.email,
    onSuccess: (message) => onSuccess?.(`빠른 피드백 전송 완료! ${message.includes('실시간') ? '(실시간)' : '(오프라인)'}`),
    onError
  });

  const handleQuickFeedback = async (message, event) => {
    event?.stopPropagation();
    await send(message);
  };

  return (
    <Box display="flex" gap={0.5} mt={2} flexWrap="wrap">
      {QUICK_FEEDBACKS.map((fb, index) => (
        <Chip
          key={index}
          label={fb.label}
          size="small"
          onClick={(e) => handleQuickFeedback(fb.message, e)}
          disabled={disabled || sending}
          sx={{ cursor: 'pointer' }}
        />
      ))}
    </Box>
  );
}
