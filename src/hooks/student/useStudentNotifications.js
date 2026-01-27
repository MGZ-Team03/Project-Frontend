// 학생 알림 처리 훅

import { useState, useEffect } from 'react';
import { useDispatch } from 'react-redux';
import { checkAuth } from '../../store/slices/authSlice';
import { getNotifications, markNotificationAsRead } from '../../api/notifications';

export default function useStudentNotifications(open, onUpdate) {
  const dispatch = useDispatch();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // 알림 불러오기
  useEffect(() => {
    if (open) {
      loadNotifications();
    }
  }, [open]);

  const loadNotifications = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // 안 읽은 알림만 조회
      const response = await getNotifications(false);
      
      // 백엔드 응답: { data: { notifications: [...], unreadCount: n } }
      setNotifications(response.data?.notifications || []);
    } catch (err) {
      console.error('알림 조회 실패:', err);
      setError('알림을 불러오는 데 실패했습니다.');
      setNotifications([]);
    } finally {
      setLoading(false);
    }
  };

  // 알림 읽음 처리
  const handleMarkAsRead = async (notificationIdTimestamp, notificationType) => {
    try {
      await markNotificationAsRead(notificationIdTimestamp);
      
      // 목록에서 제거 (notificationIdTimestamp로 필터링)
      setNotifications(prev => prev.filter(n => n.notificationIdTimestamp !== notificationIdTimestamp));
      
      // 튜터 등록 승인 시 Redux 업데이트
      if (notificationType === 'TUTOR_REQUEST_APPROVED') {
        console.log('✅ 튜터 등록 승인됨 → Redux 업데이트');
        await dispatch(checkAuth());
      }
      
      // 부모 컴포넌트에 알림
      if (onUpdate) {
        onUpdate();
      }
    } catch (err) {
      console.error('알림 읽음 처리 실패:', err);
    }
  };

  // 에러 초기화
  const clearError = () => {
    setError(null);
  };

  return {
    notifications,
    loading,
    error,
    handleMarkAsRead,
    clearError,
  };
}
