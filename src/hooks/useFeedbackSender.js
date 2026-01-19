import { useState } from 'react';
import { sendFeedback } from '../api/tutorFeedback';
import { requestTTS } from '../api/tts';

export default function useFeedbackSender({ tutorEmail, studentEmail, onSuccess, onError }) {
  const [sending, setSending] = useState(false);

  const generateSessionId = (studentEmail) => {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    return `session_${timestamp}_${studentEmail.split('@')[0]}_${random}`;
  };

  const send = async (message, options = {}) => {
    const { withTTS = false } = options;

    if (!message.trim()) {
      onError?.('피드백 메시지를 입력해주세요.');
      return false;
    }

    setSending(true);
    try {
      let audioUrl = null;

      // TTS 타입이면 먼저 TTS URL 생성
      if (withTTS) {
        console.log('🔊 TTS URL 생성 중...');
        const ttsResult = await requestTTS({ text: message });
        audioUrl = ttsResult?.audioUrl;
        
        if (!audioUrl) {
          throw new Error('TTS URL 생성 실패');
        }
        console.log('✅ TTS URL 생성 완료:', audioUrl);
      }

      const sessionId = generateSessionId(studentEmail);
      const result = await sendFeedback({
        tutor_email: tutorEmail,
        student_email: studentEmail,
        message: message,
        message_type: withTTS ? 'tts' : 'text',
        audio_url: audioUrl,
        session_id: sessionId
      });

      console.log('✅ 피드백 전송 결과:', result);

      const successMessage = `피드백 전송 성공! ${result.websocket_sent ? '(실시간 전달됨)' : '(오프라인)'}`;
      const feedbackData = {
        time: new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }),
        type: withTTS ? 'tts' : 'text',
        message: message,
      };

      onSuccess?.(successMessage, feedbackData);
      return true;
    } catch (error) {
      console.error('피드백 전송 실패:', error);
      onError?.('피드백 전송에 실패했습니다.');
      return false;
    } finally {
      setSending(false);
    }
  };

  return { send, sending };
}
