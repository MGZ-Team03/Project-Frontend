// API 및 WebSocket URL
export const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://xxx.execute-api.ap-northeast-2.amazonaws.com/prod';
export const WS_URL = import.meta.env.VITE_WS_URL || 'wss://xxx.execute-api.ap-northeast-2.amazonaws.com/prod';

// Cognito 설정
export const COGNITO_CONFIG = {
  UserPoolId: import.meta.env.VITE_COGNITO_USER_POOL_ID || 'ap-northeast-2_xxxxx',
  ClientId: import.meta.env.VITE_COGNITO_CLIENT_ID || 'xxxxxxxxxxxxxxxxxxxxxxxxxx',
};

// 사용자 역할
export const USER_ROLES = {
  STUDENT: 'student',
  TUTOR: 'tutor',
};

// 발음 상태
export const SPEAKING_STATUS = {
  IDLE: 'idle',
  SPEAKING: 'speaking',
  PROCESSING: 'processing',
};

// 세션 타입
export const SESSION_TYPES = {
  SENTENCE: 'sentence',
  AI_CHAT: 'ai_chat',
};
