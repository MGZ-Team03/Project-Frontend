import api from './axios';

/**
 * 알림 목록 조회
 * @param {boolean|null} isRead - true: 읽은 알림만, false: 안 읽은 알림만, null: 모든 알림
 * @returns {Promise<Object>} { data: { notifications: [], unreadCount: number } }
 */
export const getNotifications = async (isRead = null) => {
  const params = {};
  if (isRead !== null) {
    params.is_read = isRead;
  }
  
  const response = await api.get('/api/notifications', { params });
  return response.data;
};

/**
 * 알림 읽음 처리
 * @param {string} notificationId - 알림 ID (notification_id_timestamp 형식)
 * @returns {Promise<Object>}
 */
export const markNotificationAsRead = async (notificationId) => {
  const response = await api.put(`/api/notifications/${encodeURIComponent(notificationId)}`);
  return response.data;
};
