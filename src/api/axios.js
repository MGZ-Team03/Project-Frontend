import axios from 'axios';
import { API_BASE_URL } from '../utils/constants';

const api = axios.create({
  // DEV에서는 API_BASE_URL이 ''일 수 있음 (Vite proxy 사용)
  baseURL: API_BASE_URL || undefined,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// 요청 인터셉터: 토큰 자동 첨부
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('idToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// 응답 인터셉터: 에러 처리
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // 401 에러 시 자동 로그아웃 및 로그인 페이지 이동
    if (error.response?.status === 401) {
      // 사용자에게 알림 후 리다이렉트
      const currentPath = window.location.pathname;
      const isLoginPage = currentPath === '/login';

      if (!isLoginPage) {
        // 로그인 페이지가 아닌 경우에만 알림
        console.warn('[Auth] Session expired, redirecting to login');

        // 작업 중인 데이터 임시 저장 시도
        const hasUnsavedWork =
          currentPath.includes('/practice') ||
          currentPath.includes('/chat');

        if (hasUnsavedWork) {
          alert('세션이 만료되었습니다. 로그인 페이지로 이동합니다.');
        }

        localStorage.removeItem('idToken');
        localStorage.removeItem('user');
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export default api;
