// 통계 페이지 추후 구현 될 기능들을 위한 API 함수들

import axios from './axios';

/**
 * 오늘 통계 조회
 * @param {string} studentEmail - 학생 이메일
 * @returns {Promise<{success: boolean, data: object}>}
 */
export async function getTodayStatistics(studentEmail) {
  const res = await axios.get('/api/statistics/today', {
    params: { studentEmail }
  });
  return res.data;
}

/**
 * 주간 통계 조회
 * @param {string} studentEmail - 학생 이메일
 * @returns {Promise<{success: boolean, data: object}>}
 */
export async function getWeeklyStatistics(studentEmail) {
  const res = await axios.get('/api/statistics/weekly', {
    params: { studentEmail }
  });
  return res.data;
}

/**
 * 세션 시작
 * @param {string} studentEmail - 학생 이메일
 * @param {string} sessionType - 세션 타입 ('sentence' | 'chat')
 * @returns {Promise<object>}
 */
export async function startSession(studentEmail, sessionType) {
  const res = await axios.post('/api/sessions/start', {
    studentEmail,
    sessionType
  });
  return res.data;
}

/**
 * 세션 종료
 * @param {object} sessionData - 세션 데이터
 * @returns {Promise<object>}
 */
export async function endSession(sessionData) {
  const res = await axios.post('/api/sessions/end', sessionData);
  return res.data;
}

/**
 * 세션 이력 조회
 * @param {string} studentEmail - 학생 이메일
 * @param {number} limit - 조회 개수
 * @returns {Promise<object>}
 */
export async function getSessionHistory(studentEmail, limit = 10) {
  const res = await axios.get('/api/sessions/history', {
    params: { studentEmail, limit }
  });
  return res.data;
}
