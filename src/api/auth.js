import axios from './axios';

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
  localStorage.removeItem('idToken');
  localStorage.removeItem('accessToken');
  localStorage.removeItem('refreshToken');
  localStorage.removeItem('user');
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
    
    if (payload.exp * 1000 < Date.now()) {
      logout();
      return null;
    }
    
    // DynamoDB에서 전체 사용자 정보 조회 (role 포함)
    // axios 인터셉터가 Authorization 헤더를 자동 추가함
    const response = await axios.get('/api/auth/user');
    
    return response.data; // { email, name, role, created_at }
    
  } catch (error) {
    console.error('Get current user error:', error);
    // 토큰이 유효하지 않으면 로그아웃
    if (error.response?.status === 401) {
      logout();
    }
    return null;
  }
};

