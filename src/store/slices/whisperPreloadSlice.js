import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  status: 'idle', // 'idle' | 'loading' | 'ready' | 'error'
  progress: null, // { stage, percent, file, modelId, message }
  error: null,
};

const whisperPreloadSlice = createSlice({
  name: 'whisperPreload',
  initialState,
  reducers: {
    setWhisperStatus: (state, action) => {
      state.status = action.payload;
    },
    setWhisperProgress: (state, action) => {
      state.progress = action.payload;
    },
    setWhisperError: (state, action) => {
      state.error = action.payload;
    },
    resetWhisperPreload: (state) => {
      state.status = 'idle';
      state.progress = null;
      state.error = null;
    },
  },
});

export const {
  setWhisperStatus,
  setWhisperProgress,
  setWhisperError,
  resetWhisperPreload,
} = whisperPreloadSlice.actions;

// Selectors
export const selectWhisperPreloadStatus = (state) => state.whisperPreload.status;
export const selectWhisperProgress = (state) => state.whisperPreload.progress;
export const selectWhisperError = (state) => state.whisperPreload.error;

export default whisperPreloadSlice.reducer;
