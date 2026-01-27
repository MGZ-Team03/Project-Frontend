import api from './axios';

/**
 * 일별 통계 조회 (오늘 통계)
 * @param {string} studentEmail - 학생 이메일
 * @returns {Promise<Object>} 일별 통계 데이터
 */
export const getDailyStats = async (studentEmail) => {
  const response = await api.get('/api/statistics/today', {
    params: { student_email: studentEmail }
  });
  return response.data;
};

/**
 * 주간 통계 조회
 * @param {string} studentEmail - 학생 이메일
 * @returns {Promise<Object>} 주간 통계 데이터
 */
export const getWeeklyStats = async (studentEmail) => {
  const response = await api.get('/api/statistics/weekly', {
    params: { student_email: studentEmail }
  });
  return response.data;
};

/**
 * 일별 통계 업서트(백업)
 * - Cognito Authorizer: axios 인터셉터가 Authorization(Bearer idToken) 자동 첨부
 * @param {Object} payload - 백엔드 스펙 payload
 * @returns {Promise<Object>}
 */
export const postDailyStats = async (payload) => {
  // 서버 스펙 변경: 녹음 종료 후 통계 업서트는 today 엔드포인트로 통일
  const response = await api.post('/api/statistics/today', payload);
  return response.data;
};
