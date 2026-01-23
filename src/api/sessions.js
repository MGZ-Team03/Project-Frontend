import axios from './axios';

/**
 * 세션 시작 알림
 * @param {Object} params
 * @param {string} params.studentEmail - 학생 이메일
 * @param {string} params.sessionType - 'sentence' | 'ai_chat'
 * @param {string} params.tutorEmail - 튜터 이메일
 */
export async function startSession({ studentEmail, sessionType, tutorEmail }) {
  const res = await axios.post('/api/sessions/start', {
    studentEmail,
    sessionType,
    tutorEmail,
  });
  return res.data;
}

/**
 * 세션 종료 및 통계 전송
 * @param {Object} payload - 세션 데이터
 * @param {string} payload.studentEmail - 학생 이메일
 * @param {string} payload.timestamp - ISO 8601 형식 타임스탬프
 * @param {number} payload.recordingDuration - 총 녹음 시간 (ms)
 * @param {number} payload.speakingDuration - 총 발화 시간 (ms)
 * @param {Array} [payload.practiceRecords] - 문장 연습 기록 (문장 연습 전용)
 */
export async function endSession(payload) {
  const res = await axios.post('/api/sessions/end', payload);
  return res.data;
}
