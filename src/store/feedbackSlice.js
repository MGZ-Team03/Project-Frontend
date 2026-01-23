import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { getFeedbackHistory } from '../api/tutorFeedback';

// DynamoDB AttributeValue 파싱 헬퍼 함수
const parseAttributeValue = (value) => {
  if (!value) return undefined;
  if (typeof value === 'string') return value;
  if (value.s) return value.s; // String
  if (value.n) return value.n; // Number
  if (value.m) return value.m; // Map
  if (value.l) return value.l; // List
  return value;
};

// 피드백 히스토리 로드 (비동기)
export const loadFeedbackHistory = createAsyncThunk(
  'feedback/loadHistory',
  async ({ userEmail, limit = 20 }) => {
    const history = await getFeedbackHistory(userEmail, limit);
    
    if (history.messages && history.messages.length > 0) {
      return history.messages.map(msg => ({
        type: 'feedback',
        from: parseAttributeValue(msg.tutor_email),
        message: parseAttributeValue(msg.message_text),
        messageType: parseAttributeValue(msg.message_type) || 'text',
        audioUrl: parseAttributeValue(msg.audio_url),
        timestamp: parseAttributeValue(msg.timestamp),
      }));
    }
    
    return [];
  }
);

const feedbackSlice = createSlice({
  name: 'feedback',
  initialState: {
    feedbacks: [],
    loadingHistory: false,
    error: null,
    lastUpdate: null,
  },
  reducers: {
    // 실시간 피드백 추가 (WebSocket)
    addFeedback: (state, action) => {
      state.feedbacks.unshift(action.payload);
      state.lastUpdate = new Date().toISOString();
      console.log('✅ Redux: 피드백 추가됨', action.payload);
    },
    
    // 피드백 초기화
    clearFeedbacks: (state) => {
      state.feedbacks = [];
      state.lastUpdate = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(loadFeedbackHistory.pending, (state) => {
        state.loadingHistory = true;
        state.error = null;
      })
      .addCase(loadFeedbackHistory.fulfilled, (state, action) => {
        state.feedbacks = action.payload;
        state.loadingHistory = false;
        state.lastUpdate = new Date().toISOString();
        console.log(`✅ Redux: 과거 피드백 ${action.payload.length}개 로드됨`);
      })
      .addCase(loadFeedbackHistory.rejected, (state, action) => {
        state.loadingHistory = false;
        state.error = action.error.message;
        console.error('❌ Redux: 피드백 로드 실패', action.error.message);
      });
  },
});

export const { addFeedback, clearFeedbacks } = feedbackSlice.actions;
export default feedbackSlice.reducer;
