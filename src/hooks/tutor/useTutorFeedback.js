import { useState, useCallback } from 'react';
import { useSelector } from 'react-redux';
import { sendFeedback } from '../../api/tutorFeedback';

/**
 * 튜터 피드백 전송 관리 훅
 * - 피드백 다이얼로그 상태 관리
 * - 피드백 전송 로직
 */
export default function useTutorFeedback() {
  const tutorEmail = useSelector(state => state.auth.user?.email);
  
  const [feedbackDialog, setFeedbackDialog] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [feedbackText, setFeedbackText] = useState('');
  const [sending, setSending] = useState(false);
  const [feedbackResult, setFeedbackResult] = useState(null);

  // 세션 ID 생성 함수
  const generateSessionId = useCallback((studentEmail) => {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    return `session_${timestamp}_${studentEmail.split('@')[0]}_${random}`;
  }, []);

  // 피드백 다이얼로그 열기
  const openFeedbackDialog = useCallback((student, event) => {
    event?.stopPropagation();
    setSelectedStudent(student);
    setFeedbackText('');
    setFeedbackDialog(true);
  }, []);

  // 피드백 다이얼로그 닫기
  const closeFeedbackDialog = useCallback(() => {
    if (!sending) {
      setFeedbackDialog(false);
      setFeedbackText('');
      setSelectedStudent(null);
    }
  }, [sending]);

  // 피드백 텍스트 변경
  const updateFeedbackText = useCallback((text) => {
    setFeedbackText(text);
  }, []);

  // 피드백 전송
  const submitFeedback = useCallback(async () => {
    if (!feedbackText.trim()) {
      setFeedbackResult({ 
        success: false, 
        message: '피드백 메시지를 입력해주세요.',
        severity: 'warning'
      });
      return false;
    }

    setSending(true);
    try {
      const sessionId = generateSessionId(selectedStudent.email);
      const result = await sendFeedback({
        tutor_email: tutorEmail,
        student_email: selectedStudent.email,
        message: feedbackText,
        message_type: 'text',
        session_id: sessionId
      });

      console.log('피드백 전송 결과:', result);

      setFeedbackResult({
        success: true,
        message: `피드백 전송 성공! ${result.websocket_sent ? '(실시간 전달됨)' : '(오프라인)'}`,
        severity: 'success',
      });

      setFeedbackDialog(false);
      setFeedbackText('');
      return true;
    } catch (error) {
      console.error('피드백 전송 실패:', error);
      setFeedbackResult({
        success: false,
        message: '피드백 전송에 실패했습니다.',
        severity: 'error',
      });
      return false;
    } finally {
      setSending(false);
    }
  }, [feedbackText, selectedStudent, tutorEmail, generateSessionId]);

  // 결과 알림 초기화
  const clearFeedbackResult = useCallback(() => {
    setFeedbackResult(null);
  }, []);

  // 빠른 피드백 성공 핸들러
  const handleQuickFeedbackSuccess = useCallback((message) => {
    setFeedbackResult({ success: true, message, severity: 'success' });
  }, []);

  // 빠른 피드백 실패 핸들러
  const handleQuickFeedbackError = useCallback((message) => {
    setFeedbackResult({ success: false, message, severity: 'error' });
  }, []);

  return {
    tutorEmail,
    feedbackDialog,
    selectedStudent,
    feedbackText,
    sending,
    feedbackResult,
    openFeedbackDialog,
    closeFeedbackDialog,
    updateFeedbackText,
    submitFeedback,
    clearFeedbackResult,
    handleQuickFeedbackSuccess,
    handleQuickFeedbackError,
  };
}
