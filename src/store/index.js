import { configureStore } from '@reduxjs/toolkit';
import authReducer from './slices/authSlice';

export const store = configureStore({
  reducer: {
    auth: authReducer,
    // practice: practiceReducer,  // 추후 추가
    // chat: chatReducer,          // 추후 추가
    // students: studentReducer,   // 추후 추가
  },
});

export default store;
