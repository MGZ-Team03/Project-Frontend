import { useState } from 'react';
import useFeedbackSender from '../useFeedbackSender';

/**
 * 학생 피드백 전송 관리
 */
export default function useStudentFeedback({ 
  tutorEmail, 
  studentEmail, 
  onFeedbackSent 
}) {
  const [feedbackText, setFeedbackText] = useState('');
  const [notification, setNotification] = useState(null);

  const { send: sendFeedbackMessage, sending } = useFeedbackSender({
    tutorEmail,
    studentEmail,
    onSuccess: (message, feedbackData) => {
      onFeedbackSent?.(feedbackData);
      setFeedbackText('');
      setNotification({ message, severity: 'success' });
    },
    onError: (message) => {
      setNotification({ message, severity: 'error' });
    },
  });

  // 텍스트 피드백 전송
  const handleSendFeedback = async () => {
    if (!feedbackText.trim() || sending) return;
    await sendFeedbackMessage(feedbackText, { withTTS: false });
  };

  // 퀵 피드백 선택
  const handleQuickFeedback = (text) => {
    setFeedbackText(text);
  };

  // TTS 피드백 전송
  const handleTTSFeedback = async () => {
    if (!feedbackText.trim() || sending) return;
    await sendFeedbackMessage(feedbackText, { withTTS: true });
  };

  const closeNotification = () => {
    setNotification(null);
  };

  return {
    feedbackText,
    setFeedbackText,
    sending,
    notification,
    handleSendFeedback,
    handleQuickFeedback,
    handleTTSFeedback,
    closeNotification,
  };
}
