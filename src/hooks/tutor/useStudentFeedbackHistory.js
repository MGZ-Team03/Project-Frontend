import { useState, useEffect, useCallback } from 'react';
import { getFeedbackHistory } from '../../api/tutorFeedback';

/**
 * 학생 피드백 히스토리 관리
 */
export default function useStudentFeedbackHistory(email) {
  const [feedbackHistory, setFeedbackHistory] = useState([]);
  const [feedbackLoading, setFeedbackLoading] = useState(true);

  // 피드백 히스토리 불러오기
  useEffect(() => {
    const loadFeedbackHistory = async () => {
      try {
        setFeedbackLoading(true);
        const result = await getFeedbackHistory(email);
        
        // 백엔드에서 파싱된 응답 처리
        const messages = result.messages || [];
        const parsed = messages
          .map((msg, idx) => ({
            id: msg.feedback_id || msg.composite_key || idx,
            message: msg.message_type === 'tts' 
              ? `🔊 ${msg.message || ''}` 
              : (msg.message || ''),
            time: msg.timestamp 
              ? new Date(msg.timestamp).toLocaleTimeString('en-US', { 
                  hour: 'numeric', 
                  minute: '2-digit', 
                  hour12: true 
                })
              : '',
            timestamp: msg.timestamp, // 정렬용 원본 timestamp 보존
            messageType: msg.message_type || 'text',
          }))
          .sort((a, b) => {
            // timestamp 기준 오름차순 정렬 (오래된 것 먼저 → 최신 것이 아래로)
            if (!a.timestamp) return -1;
            if (!b.timestamp) return 1;
            return new Date(a.timestamp) - new Date(b.timestamp);
          });
        
        setFeedbackHistory(parsed);
        console.log('✅ 피드백 히스토리 로드 완료:', parsed.length, '개');
      } catch (error) {
        console.error('❌ 피드백 히스토리 로드 실패:', error);
        setFeedbackHistory([]);
      } finally {
        setFeedbackLoading(false);
      }
    };

    if (email) {
      loadFeedbackHistory();
    }
  }, [email]);

  // 새 피드백 추가
  const addFeedback = useCallback((feedbackData) => {
    const newFeedback = {
      id: Date.now(),
      message: feedbackData.type === 'tts' 
        ? `🔊 ${feedbackData.message}` 
        : feedbackData.message,
      time: feedbackData.time,
      messageType: feedbackData.type || 'text',
    };
    setFeedbackHistory(prev => [...prev, newFeedback]);
  }, []);

  return {
    feedbackHistory,
    feedbackLoading,
    addFeedback,
  };
}
