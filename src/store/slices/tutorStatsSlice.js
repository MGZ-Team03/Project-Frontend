import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import { getStudentsLearningLevels } from '../../api/auth';

// 오늘 날짜 키 생성
function getTodayKey() {
  return new Date().toISOString().split('T')[0]; // 'YYYY-MM-DD'
}

const initialState = {
  // 학생별 주간 통계 캐시: { [email]: { data, fetchedDate } }
  studentsWeeklyStats: {},
  // 학생별 학습 레벨 캐시: { [email]: '상'|'중'|'하' }
  learningLevelsByEmail: {},
  // 세션 1회 로딩 플래그
  learningLevelsLoaded: false,
  learningLevelsLoading: false,
  learningLevelsError: null,
};

export const loadLearningLevelsOnce = createAsyncThunk(
  'tutorStats/loadLearningLevelsOnce',
  async (_, { getState, rejectWithValue }) => {
    const state = getState();
    const loaded = Boolean(state?.tutorStats?.learningLevelsLoaded);
    if (loaded) {
      return { skipped: true, levels: state?.tutorStats?.learningLevelsByEmail || {} };
    }

    try {
      const levels = await getStudentsLearningLevels();
      return { skipped: false, levels };
    } catch (e) {
      return rejectWithValue(e?.message || '학습 레벨 조회 실패');
    }
  },
  {
    condition: (_, { getState }) => {
      const state = getState();
      const loaded = Boolean(state?.tutorStats?.learningLevelsLoaded);
      const loading = Boolean(state?.tutorStats?.learningLevelsLoading);
      // 이미 로딩 완료거나 로딩 중이면 thunk 실행 자체를 막음(중복 호출 방지)
      return !loaded && !loading;
    },
  }
);

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

    // 학습 레벨 수동 설정/병합(필요 시)
    setLearningLevelsByEmail: (state, action) => {
      state.learningLevelsByEmail = {
        ...(state.learningLevelsByEmail || {}),
        ...(action.payload || {}),
      };
      state.learningLevelsLoaded = true;
      state.learningLevelsError = null;
    },
    clearLearningLevels: (state) => {
      state.learningLevelsByEmail = {};
      state.learningLevelsLoaded = false;
      state.learningLevelsError = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(loadLearningLevelsOnce.pending, (state) => {
        state.learningLevelsLoading = true;
        state.learningLevelsError = null;
      })
      .addCase(loadLearningLevelsOnce.fulfilled, (state, action) => {
        if (!action.payload?.skipped) {
          state.learningLevelsByEmail = action.payload?.levels || {};
          state.learningLevelsLoaded = true;
        }
        state.learningLevelsLoading = false;
        state.learningLevelsError = null;
      })
      .addCase(loadLearningLevelsOnce.rejected, (state, action) => {
        state.learningLevelsLoading = false;
        state.learningLevelsError =
          action.payload || action.error?.message || '학습 레벨 조회 실패';
      });
  },
});

export const {
  setStudentWeeklyStats,
  clearStudentsWeeklyStats,
  removeStudentWeeklyStats,
  setLearningLevelsByEmail,
  clearLearningLevels,
} = tutorStatsSlice.actions;

export default tutorStatsSlice.reducer;
