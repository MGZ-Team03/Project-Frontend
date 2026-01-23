import axios from './axios';

/**
 * 튜터 피드백 전송
 * 
 * @param {object} feedbackData - 피드백 데이터
 * @param {string} feedbackData.tutor_email - 튜터 이메일
 * @param {string} feedbackData.student_email - 학생 이메일
 * @param {string} feedbackData.message - 피드백 메시지
 * @param {string} feedbackData.message_type - 메시지 타입 (text/tts)
 * @param {string} [feedbackData.session_id] - 세션 ID (선택)
 * @param {string} [feedbackData.audio_url] - TTS 오디오 URL (선택)
 * @returns {Promise<object>} 응답 데이터
 */
export const sendFeedback = async (feedbackData) => {
  try {
    const response = await axios.post('/api/tutor/feedback', feedbackData);
    return response.data;
  } catch (error) {
    console.error('❌ 피드백 전송 실패:', error);
    throw error;
  }
};

/**
 * 학생 피드백 히스토리 조회
 * 
 * @param {string} studentEmail - 학생 이메일
 * @param {number} [limit=50] - 조회할 메시지 수
 * @returns {Promise<object>} 피드백 히스토리
 */
export const getFeedbackHistory = async (studentEmail, limit = 50) => {
  try {
    const response = await axios.get('/api/tutor/feedback', {
      params: { 
        student_email: studentEmail, 
        limit 
      }
    });
    return response.data;
  } catch (error) {
    console.error('❌ 피드백 히스토리 조회 실패:', error);
    throw error;
  }
};

/**
 * 튜터의 담당 학생 목록 조회 (승인된 학생만)
 * 
 * @returns {Promise<object>} 학생 목록
 */
export const getMyStudents = async () => {
  try {
    const response = await axios.get('/api/tutor/students');
    return response.data;
  } catch (error) {
    console.error('❌ 학생 목록 조회 실패:', error);
    throw error;
  }
};
