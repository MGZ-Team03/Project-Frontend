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
