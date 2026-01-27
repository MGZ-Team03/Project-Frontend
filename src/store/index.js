import { configureStore } from '@reduxjs/toolkit';
import authReducer from './slices/authSlice';
import speakingStatsReducer from './slices/speakingStatsSlice';
import whisperPreloadReducer from './slices/whisperPreloadSlice';
import tutorStatsReducer from './slices/tutorStatsSlice';
import ws from '../config/webSocketConfig';

export const store = configureStore({
  reducer: {
    auth: authReducer,
    speakingStats: speakingStatsReducer,
    whisperPreload: whisperPreloadReducer,
    tutorStats: tutorStatsReducer,
    // practice: practiceReducer,  // 추후 추가
    // chat: chatReducer,          // 추후 추가
    // students: studentReducer,   // 추후 추가
  },
});

// WebSocket 싱글톤에 store 주입
ws.setStore(store);

export default store;
