import { configureStore } from '@reduxjs/toolkit';
import authReducer from './slices/authSlice';
import speakingStatsReducer from './slices/speakingStatsSlice';

export const store = configureStore({
  reducer: {
    auth: authReducer,
    speakingStats: speakingStatsReducer,
    // practice: practiceReducer,  // 추후 추가
    // chat: chatReducer,          // 추후 추가
    // students: studentReducer,   // 추후 추가
  },
});

export default store;
