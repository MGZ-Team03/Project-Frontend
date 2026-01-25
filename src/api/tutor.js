import axios from './axios';

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
