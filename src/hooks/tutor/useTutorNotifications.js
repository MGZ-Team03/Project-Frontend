import { useState, useEffect, useCallback } from 'react';
import { useSelector } from 'react-redux';
import ws from '../../config/webSocketConfig';
import { getNotifications } from '../../api/notifications';

/**
 * 튜터 알림 관리 훅
 * - 알림 목록 조회 (초기 로드 + 30초 폴링)
 * - WebSocket 실시간 알림 수신
 * - 읽지 않은 알림 개수 관리
 */
export default function useTutorNotifications() {
  const user = useSelector(state => state.auth.user);
  
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notificationDialogOpen, setNotificationDialogOpen] = useState(false);

  // 알림 목록 가져오기
  const fetchNotifications = useCallback(async () => {
    try {
      const result = await getNotifications(false); // 안 읽은 알림만

      const notificationList = result?.data?.notifications || [];
      const count = result?.data?.unreadCount || 0;

      setNotifications(notificationList);
      setUnreadCount(count);
    } catch (error) {
      console.error('알림 조회 실패:', error);
    }
  }, []);

  // 알림 다이얼로그 열기
  const openNotificationDialog = useCallback(() => {
    setNotificationDialogOpen(true);
  }, []);

  // 알림 다이얼로그 닫기
  const closeNotificationDialog = useCallback(() => {
    setNotificationDialogOpen(false);
  }, []);

  // 알림 목록 갱신 (승인/거부 후)
  const refreshNotifications = useCallback(async () => {
    await fetchNotifications();
  }, [fetchNotifications]);

  // WebSocket 메시지 핸들러
  const handleWebSocketMessage = useCallback((data) => {
    if (data.type === 'NEW_TUTOR_REQUEST') {
      // SQS → Lambda → DynamoDB 저장 완료 후 뱃지 업데이트를 위해 폴링
      const pollForNotification = async (retryCount = 0, maxRetries = 10) => {
        try {
          const result = await getNotifications(false);
          const notificationList = result?.data?.notifications || [];
          const count = result?.data?.unreadCount || 0;
          setNotifications(notificationList);
          setUnreadCount(count);
        } catch (error) {
          console.error('알림 조회 실패:', error);
        }
        
        if (retryCount < maxRetries) {
          setTimeout(() => pollForNotification(retryCount + 1, maxRetries), 1000);
        }
      };
      
      // 1초 후 폴링 시작
      setTimeout(() => pollForNotification(), 1000);
    }
  }, []); // dependency 제거

  // 초기 로드 및 폴링
  useEffect(() => {
    if (user?.role === 'tutor' && user?.email) {
      // 토큰 저장 타이밍 보장을 위한 최소 지연
      const timeout = setTimeout(fetchNotifications, 100);

      const interval = setInterval(fetchNotifications, 30000);
      return () => {
        clearTimeout(timeout);
        clearInterval(interval);
      };
    }
  }, [user?.role, user?.email, fetchNotifications]);

  // WebSocket 리스너 등록 (한 번만 등록)
  useEffect(() => {
    if (user?.role === 'tutor' && user?.email) {
      ws.getSocket();
      const unsubscribe = ws.addMessageListener(handleWebSocketMessage);
      return () => unsubscribe();
    }
  }, [user?.role, user?.email, handleWebSocketMessage]);

  return {
    notifications,
    unreadCount,
    notificationDialogOpen,
    openNotificationDialog,
    closeNotificationDialog,
    refreshNotifications,
  };
}
