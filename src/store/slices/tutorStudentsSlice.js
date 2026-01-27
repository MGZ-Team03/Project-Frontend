import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  students: [],           // 학생 목록
  loading: false,         // 로딩 상태
  error: null,           // 에러 메시지
  lastUpdate: null,      // 마지막 업데이트 시간
};

const tutorStudentsSlice = createSlice({
  name: 'tutorStudents',
  initialState,
  reducers: {
    // 로딩 시작
    setLoading: (state, action) => {
      state.loading = action.payload;
    },
    
    // 학생 목록 설정
    setStudents: (state, action) => {
      state.students = action.payload;
      state.lastUpdate = new Date().toISOString();
      state.error = null;
    },
    
    // 에러 설정
    setError: (state, action) => {
      state.error = action.payload;
      state.loading = false;
    },
    
    // 개별 학생 업데이트 (실시간 상태 변경)
    updateStudent: (state, action) => {
      const { email, updates } = action.payload;
      const index = state.students.findIndex(s => s.email === email);
      if (index !== -1) {
        state.students[index] = { ...state.students[index], ...updates };
      }
    },
    
    // 학생 추가
    addStudent: (state, action) => {
      state.students.push(action.payload);
    },
    
    // 학생 제거
    removeStudent: (state, action) => {
      state.students = state.students.filter(s => s.email !== action.payload);
    },
    
    // 초기화
    reset: () => initialState,
  },
});

export const {
  setLoading,
  setStudents,
  setError,
  updateStudent,
  addStudent,
  removeStudent,
  reset,
} = tutorStudentsSlice.actions;

export default tutorStudentsSlice.reducer;
