import axios from 'axios';
import { API_BASE_URL } from '../utils/constants';

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// RefreshToken으로 토큰 갱신하는 함수 (순환 참조 방지를 위해 여기서 직접 구현)
let isRefreshing = false;
let refreshSubscribers = [];

const onRefreshed = (newToken) => {
  refreshSubscribers.forEach((callback) => callback(newToken));
  refreshSubscribers = [];
};

const addRefreshSubscriber = (callback) => {
  refreshSubscribers.push(callback);
};

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

// 응답 인터셉터: 401 에러 시 토큰 갱신 시도
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    
    // 401 에러이고, refresh 엔드포인트가 아니며, 재시도하지 않은 요청인 경우
    if (error.response?.status === 401 && 
        !originalRequest.url.includes('/auth/refresh') && 
        !originalRequest._retry) {
      
      if (isRefreshing) {
        // 이미 갱신 중이면 대기 후 재시도
        return new Promise((resolve) => {
          addRefreshSubscriber((newToken) => {
            originalRequest.headers.Authorization = `Bearer ${newToken}`;
            resolve(api(originalRequest));
          });
        });
      }
      
      originalRequest._retry = true;
      isRefreshing = true;
      
      const refreshToken = localStorage.getItem('refreshToken');
      
      if (!refreshToken) {
        // RefreshToken이 없으면 로그아웃
        isRefreshing = false;
        localStorage.removeItem('idToken');
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        localStorage.removeItem('user');
        window.location.href = '/login';
        return Promise.reject(error);
      }
      
      try {
        // RefreshToken으로 새 토큰 발급
        const response = await axios.post(`${API_BASE_URL}/api/auth/refresh`, {
          refreshToken
        });
        
        const { idToken, accessToken } = response.data;
        
        // 새 토큰 저장
        localStorage.setItem('idToken', idToken);
        localStorage.setItem('accessToken', accessToken);
        
        // 원래 요청에 새 토큰 적용
        originalRequest.headers.Authorization = `Bearer ${idToken}`;
        
        // 대기 중인 요청들에 새 토큰 전달
        onRefreshed(idToken);
        isRefreshing = false;
        
        // 원래 요청 재시도
        return api(originalRequest);
      } catch (refreshError) {
        // RefreshToken도 만료되었으면 로그아웃
        isRefreshing = false;
        localStorage.removeItem('idToken');
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        localStorage.removeItem('user');
        window.location.href = '/login';
        return Promise.reject(refreshError);
      }
    }
    
    return Promise.reject(error);
  }
);

export default api;
