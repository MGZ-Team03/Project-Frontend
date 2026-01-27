import { createSlice } from '@reduxjs/toolkit';

// 오늘 날짜 키 생성
function getTodayKey() {
  return new Date().toISOString().split('T')[0]; // 'YYYY-MM-DD'
}

const initialState = {
  // 학생별 주간 통계 캐시: { [email]: { data, fetchedDate } }
  studentsWeeklyStats: {},
};

const tutorStatsSlice = createSlice({
  name: 'tutorStats',
  initialState,
  reducers: {
    // 학생별 주간 통계 저장
    setStudentWeeklyStats: (state, action) => {
      const { email, data } = action.payload;
      state.studentsWeeklyStats[email] = {
        data,
        fetchedDate: getTodayKey(),
      };
    },

    // 전체 캐시 초기화
    clearStudentsWeeklyStats: (state) => {
      state.studentsWeeklyStats = {};
    },

    // 특정 학생 캐시 제거
    removeStudentWeeklyStats: (state, action) => {
      const email = action.payload;
      delete state.studentsWeeklyStats[email];
    },
  },
});

export const {
  setStudentWeeklyStats,
  clearStudentsWeeklyStats,
  removeStudentWeeklyStats,
} = tutorStatsSlice.actions;

export default tutorStatsSlice.reducer;
