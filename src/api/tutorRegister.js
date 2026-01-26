import axios from './axios';

/**
 * 튜터 등록 관련 API
 */

// 튜터 목록 조회
export const getTutors = async (searchParams = {}) => {
  const { search, specialty } = searchParams;
  const params = {};
  
  if (search) params.search = search;
  if (specialty) params.specialty = specialty;
  
  const response = await axios.get('/api/tutors', { params });
  return response.data;
};

// 튜터 등록 요청
export const requestTutor = async (tutorEmail, message = '') => {
  const response = await axios.post(`/api/tutors/${tutorEmail}/request`, {
    message
  });

  return response.data;
};

// 내 튜터 요청 목록 조회
export const getMyTutorRequests = async (status = 'all') => {
  const response = await axios.get('/api/my/tutor-requests', {
    params: { status }
  });
  return response.data;
};

// 튜터 요청 취소
export const cancelTutorRequest = async (requestId) => {
  const response = await axios.delete(`/api/my/tutor-requests/${requestId}`);
  return response.data;
};

// 튜터용: 요청 목록 조회
export const getTutorRequests = async (status = 'pending') => {
  const response = await axios.get('/api/tutor/requests', {
    params: { status }
  });
  return response.data;
};

// 튜터용: 요청 승인
export const approveTutorRequest = async (requestId) => {
  const response = await axios.post(`/api/tutors/requests/${requestId}/approve`);
  return response.data;
};

// 튜터용: 요청 거부
export const rejectTutorRequest = async (requestId, reason = '') => {
  const response = await axios.post(`/api/tutors/requests/${requestId}/reject`, {
    reason
  });
  return response.data;
};

// 튜터용: 요청 처리 (승인/거부)
export const processTutorRequest = async (requestId, action, reason = '') => {
  if (action === 'approve') {
    return await approveTutorRequest(requestId);
  } else if (action === 'reject') {
    return await rejectTutorRequest(requestId, reason);
  }
  throw new Error('Invalid action. Use "approve" or "reject"');
};
