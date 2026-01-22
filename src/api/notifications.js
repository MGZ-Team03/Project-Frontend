import api from './axios';

/**
 * 알림 목록 조회
 * @param {string} userEmail - 사용자 이메일
 * @param {number} limit - 조회할 알림 개수 (기본 50)
 * @returns {Promise<Array>} 알림 목록
 */
export const getNotifications = async (userEmail, limit = 50) => {
  const response = await api.get('/api/notifications', {
    params: { limit }
  });
  return response.data;
};

/**
 * 알림 읽음 처리
 * @param {string} notificationId - 알림 ID
 * @returns {Promise<Object>}
 */
export const markNotificationAsRead = async (notificationId) => {
  const response = await api.put(`/api/notifications/${notificationId}/read`);
  return response.data;
};
