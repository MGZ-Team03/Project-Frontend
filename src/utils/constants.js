// API 및 WebSocket URL
// DEV(localhost)에서는 CORS를 피하기 위해 Vite proxy를 통해 호출한다.
// - API: axios baseURL을 비워서(`/api/...` 상대경로) Vite가 프록시하도록 함
// - WS: 상대경로(`/Dev`)로 연결해서 Vite ws proxy를 타도록 함
export const API_BASE_URL =
  import.meta.env.DEV ? '' : (import.meta.env.VITE_API_URL || 'https://xxx.execute-api.ap-northeast-2.amazonaws.com/prod');
export const WS_URL =
  import.meta.env.DEV ? '/Dev' : (import.meta.env.VITE_WS_URL || 'wss://xxx.execute-api.ap-northeast-2.amazonaws.com/prod');

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
