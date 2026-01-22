import axios from './axios';
import ws from "../config/webSocketConfig.js";

// 회원가입
export const register = async (email, password, name, role = 'student') => {
  const response = await axios.post('/api/auth/register', {
    email,
    password,
    name,
    role
  });
  return response.data;
};

// 이메일 인증 확인
export const confirmSignUp = async (email, code) => {
  const response = await axios.post('/api/auth/confirm', {
    email,
    code
  });
  return response.data;
};

// 로그인
export const login = async (email, password) => {
  const response = await axios.post('/api/auth/login', {
    email,
    password
  });
  
  // 토큰 저장
  if (response.data.idToken) {
    localStorage.setItem('idToken', response.data.idToken);
    localStorage.setItem('accessToken', response.data.accessToken);
    localStorage.setItem('refreshToken', response.data.refreshToken);
  }
  
  // DynamoDB에서 사용자 정보 조회 후 반환
  const user = await getCurrentUser();
  return user;
};

// 로그아웃
export const logout = () => {
  ws.disconnect();
  localStorage.removeItem('idToken');
  localStorage.removeItem('accessToken');
  localStorage.removeItem('refreshToken');
  localStorage.removeItem('user');
};

// RefreshToken을 사용하여 새로운 토큰 발급
export const refreshAccessToken = async () => {
  const refreshToken = localStorage.getItem('refreshToken');
  
  if (!refreshToken) {
    throw new Error('No refresh token available');
  }
  
  try {
    const response = await axios.post('/api/auth/refresh', {
      refreshToken
    });
    
    // 새로운 토큰 저장
    if (response.data.idToken) {
      localStorage.setItem('idToken', response.data.idToken);
      localStorage.setItem('accessToken', response.data.accessToken);
      // refreshToken은 동일하게 유지되므로 갱신 불필요
    }
    
    return response.data;
  } catch (error) {
    // RefreshToken도 만료되었거나 유효하지 않으면 로그아웃
    console.error('Token refresh failed:', error);
    logout();
    throw error;
  }
};

// 학생의 튜터 정보 가져오기
export const getMyTutor = async (studentEmail) => {
  try {
    const response = await axios.get('/api/student/tutor', {
      params: { student_email: studentEmail }
    });
    return response.data; // { tutor_email, student_email, assigned_at, status }
  } catch (error) {
    console.error('Get my tutor error:', error);
    if (error.response?.status === 404) {
      return null; // 튜터가 할당되지 않음
    }
    throw error;
  }
};

// 현재 사용자 정보 가져오기 (JWT + DynamoDB)
export const getCurrentUser = async () => {
  const idToken = localStorage.getItem('idToken');
  if (!idToken) return null;
  
  try {
    // JWT 토큰 만료 확인
    const parts = idToken.split('.');
    if (parts.length !== 3) {
      logout();
      return null;
    }
    
    const payload = JSON.parse(atob(parts[1]));
    
    // 토큰 만료 시 RefreshToken으로 갱신 시도
    if (payload.exp * 1000 < Date.now()) {
      try {
        await refreshAccessToken();
        // 갱신 성공 시 다시 getCurrentUser 재귀 호출
        return await getCurrentUser();
      } catch (error) {
        console.error('Token refresh failed, logging out');
        logout();
        return null;
      }
    }
    
    // DynamoDB에서 전체 사용자 정보 조회 (role 포함)
    // axios 인터셉터가 Authorization 헤더를 자동 추가함
    const response = await axios.get('/api/auth/user');
    
    const user = response.data; // { email, name, role, created_at }
    
    // 학생이면 튜터 정보도 가져오기
    if (user.role === 'student') {
      try {
        const tutorInfo = await getMyTutor(user.email);
        if (tutorInfo) {
          user.tutorEmail = tutorInfo.tutor_email;
        }
      } catch (error) {
        console.warn('Failed to get tutor info:', error);
        // 튜터 정보 조회 실패해도 로그인은 유지
      }
    }
    
    return user;
    
  } catch (error) {
    console.error('Get current user error:', error);
    // 토큰이 유효하지 않으면 로그아웃
    if (error.response?.status === 401) {
      logout();
    }
    return null;
  }
};
