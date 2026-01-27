// 튜터 알림 처리 훅

import { useState } from 'react';
import { markNotificationAsRead } from '../../api/notifications';
import { processTutorRequest } from '../../api/tutorRegister';

export function useNotificationHandler(notifications, onUpdate, onStudentListUpdate) {
  const [processing, setProcessing] = useState(null);
  const [error, setError] = useState(null);
  const [confirmDialog, setConfirmDialog] = useState({
    open: false,
    requestId: null,
    studentName: '',
    studentEmail: ''
  });

  // 승인 처리
  const handleApprove = async (requestId) => {
    try {
      setProcessing(requestId);
      await processTutorRequest(requestId, 'approve');

      // 알림 읽음 처리
      const notification = notifications.find(n => n.data?.request_id === requestId);
      if (notification?.notificationIdTimestamp) {
        try {
          await markNotificationAsRead(notification.notificationIdTimestamp);
        } catch (readErr) {
          console.error('알림 읽음 처리 실패:', readErr);
        }
      }

      // 알림 목록 갱신
      if (onUpdate) {
        await onUpdate();
      }

      // 학생 목록 즉시 갱신
      if (onStudentListUpdate) {
        await onStudentListUpdate();
      }
    } catch (err) {
      setError('승인 처리 중 오류가 발생했습니다.');
      console.error('Approve error:', err);
    } finally {
      setProcessing(null);
    }
  };

  // 거부 확인 대화상자 열기
  const handleRejectClick = (requestId, studentName, studentEmail) => {
    setConfirmDialog({
      open: true,
      requestId,
      studentName,
      studentEmail
    });
  };

  // 실제 거부 처리
  const handleReject = async () => {
    const { requestId } = confirmDialog;

    try {
      setProcessing(requestId);
      setConfirmDialog({ open: false, requestId: null, studentName: '', studentEmail: '' });

      await processTutorRequest(requestId, 'reject', '현재 학생을 받을 수 없습니다.');

      // 알림 읽음 처리
      const notification = notifications.find(n => n.data?.request_id === requestId);
      
      if (notification?.notificationIdTimestamp) {
        try {
          await markNotificationAsRead(notification.notificationIdTimestamp);
        } catch (readErr) {
          console.error('알림 읽음 처리 실패:', readErr);
        }
      }

      // 알림 목록 갱신
      if (onUpdate) {
        await onUpdate();
      }
    } catch (err) {
      setError('거부 처리 중 오류가 발생했습니다.');
      console.error('Reject error:', err);
    } finally {
      setProcessing(null);
    }
  };

  // 거부 확인 대화상자 닫기
  const handleRejectCancel = () => {
    setConfirmDialog({ open: false, requestId: null, studentName: '', studentEmail: '' });
  };

  // 에러 초기화
  const clearError = () => {
    setError(null);
  };

  return {
    processing,
    error,
    confirmDialog,
    handleApprove,
    handleRejectClick,
    handleReject,
    handleRejectCancel,
    clearError,
  };
}

export default useNotificationHandler;
