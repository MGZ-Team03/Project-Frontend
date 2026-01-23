import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { getStorageKey, migrateOldStatsKey } from '../../utils/storageKeys';

const STORAGE_KEY = 'speaktracker_daily_stats';

// 오늘 날짜 키 생성
function getTodayKey() {
  return new Date().toISOString().split('T')[0]; // 'YYYY-MM-DD'
}

// 초기 세션 상태
const initialSessionState = {
  sessionId: null,
  sessionType: null, // 'chat' | 'practice'
  startedAt: null,

  // 시간 측정 (ms)
  totalRecordingTime: 0, // 녹음 버튼 누른 총 시간
  userSpeakingTime: 0,   // 실제 발화 시간

  // 문장 연습 (Pace Ratio 계산용)
  currentPractice: {
    sentenceId: null,
    referenceAudioDuration: 0,
    userSpeakingDuration: 0,
  },

  // 세션 내 기록
  practiceRecords: [], // [{sentenceId, paceRatio, userTime, refTime, timestamp}]
  responseQualities: [], // [{durationMs, wordCount, wordsPerMinute, fluencyScore, overallScore, timestamp}]
};

// 초기 일별 통계 상태
const initialDailyStats = {
  date: null,

  // 기본 통계
  totalRecordingTime: 0, // 일별 총 녹음 시간 (ms)
  totalSpeakingTime: 0,  // 일별 총 발화 시간 (ms)
  sessionsCount: 0,
  practiceCount: 0,

  // 4대 지표 (일별 평균)
  avgPaceRatio: 0,
  avgNetSpeakingDensity: 0,
  avgResponseQuality: 0,

  // 상세 기록 (분석용)
  paceRatios: [],
  responseQualities: [],
};

const initialState = {
  currentSession: { ...initialSessionState },
  dailyStats: { ...initialDailyStats },
  userEmail: null,  // User context for localStorage key
  isLoading: false,
  error: null,
};

// localStorage에서 일별 통계 로드
export const loadStatsFromStorage = createAsyncThunk(
  'speakingStats/loadFromStorage',
  async ({ userEmail }, { rejectWithValue }) => {
    if (!userEmail) {
      return rejectWithValue('No user email provided');
    }

    const todayKey = getTodayKey();

    // Migrate old static key to user-specific key (one-time migration)
    migrateOldStatsKey(userEmail);

    // Use user-specific storage key
    const storageKey = getStorageKey(userEmail);
    const stored = localStorage.getItem(storageKey);

    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        if (parsed.date === todayKey) {
          // 스키마 마이그레이션: 누락 필드 보강 + 불필요 필드 제거
          const merged = {
            ...initialDailyStats,
            ...parsed,
            date: todayKey,
          };
          merged.paceRatios = Array.isArray(parsed?.paceRatios) ? parsed.paceRatios : [];
          merged.responseQualities = Array.isArray(parsed?.responseQualities) ? parsed.responseQualities : [];

          // 평균이 없거나 0으로만 저장된 경우에도 배열 기반으로 재계산
          if (merged.responseQualities.length > 0) {
            merged.avgResponseQuality =
              merged.responseQualities.reduce((a, b) => a + (b?.overallScore || 0), 0) / merged.responseQualities.length;
          }

          console.log(`✓ Loaded stats for ${userEmail}:`, merged);
          return { stats: merged, userEmail };
        }
      } catch (e) {
        console.error('Failed to parse stored stats:', e);
      }
    }

    // 날짜가 다르거나 데이터 없으면 새로 시작
    const freshStats = { ...initialDailyStats, date: todayKey };
    console.log(`✓ Fresh stats for ${userEmail}`);
    return { stats: freshStats, userEmail };
  }
);

const speakingStatsSlice = createSlice({
  name: 'speakingStats',
  initialState,
  reducers: {
    // ===== 사용자 컨텍스트 =====
    setUserContext: (state, action) => {
      state.userEmail = action.payload.userEmail;
    },

    // ===== 세션 관리 =====
    startSession: (state, action) => {
      const now = Date.now();
      state.currentSession = {
        ...initialSessionState,
        sessionId: `session_${now}`,
        sessionType: action.payload.sessionType,
        startedAt: new Date(now).toISOString(),
      };
    },

    endSession: (state) => {
      const session = state.currentSession;
      if (!session.sessionId) return;

      // dailyStats에 누적
      state.dailyStats.totalRecordingTime += session.totalRecordingTime;
      state.dailyStats.totalSpeakingTime += session.userSpeakingTime;
      state.dailyStats.sessionsCount += 1;

      // Pace Ratio 누적
      if (session.practiceRecords.length > 0) {
        state.dailyStats.practiceCount += session.practiceRecords.length;
        session.practiceRecords.forEach((record) => {
          state.dailyStats.paceRatios.push(record.paceRatio);
        });
        // 평균 재계산
        const allRatios = state.dailyStats.paceRatios;
        state.dailyStats.avgPaceRatio =
          allRatios.reduce((a, b) => a + b, 0) / allRatios.length;
      }
      // Response Quality는 addResponseQuality에서 일별 통계를 실시간 누적하므로 여기서는 누적하지 않음

      // Net Speaking Density 평균 재계산
      if (state.dailyStats.totalRecordingTime > 0) {
        state.dailyStats.avgNetSpeakingDensity =
          (state.dailyStats.totalSpeakingTime / state.dailyStats.totalRecordingTime) * 100;
      }

      // 날짜 설정
      if (!state.dailyStats.date) {
        state.dailyStats.date = getTodayKey();
      }

      // localStorage에 저장 (사용자별)
      if (state.userEmail) {
        const storageKey = getStorageKey(state.userEmail);
        localStorage.setItem(storageKey, JSON.stringify(state.dailyStats));
      }

      // 세션 초기화
      state.currentSession = { ...initialSessionState };
    },

    // ===== 시간 업데이트 =====
    updateRecordingTime: (state, action) => {
      state.currentSession.totalRecordingTime += action.payload.deltaTime;
    },

    updateSpeakingTime: (state, action) => {
      const { deltaTime, isSpeaking } = action.payload;
      if (isSpeaking) {
        state.currentSession.userSpeakingTime += deltaTime;
      }
    },

    // ===== 응답 품질 기록 (ChatPage용) =====
    addResponseQuality: (state, action) => {
      const { durationMs, wordCount, wordsPerMinute, fluencyScore, overallScore } = action.payload;

      if (state.currentSession.sessionType === 'chat') {
        const record = {
          durationMs,
          wordCount,
          wordsPerMinute,
          fluencyScore,
          overallScore,
          timestamp: Date.now(),
        };
        state.currentSession.responseQualities.push(record);

        // 일별 통계도 실시간 누적 + 평균 재계산 + localStorage 저장
        if (!state.dailyStats.date) state.dailyStats.date = getTodayKey();
        if (!Array.isArray(state.dailyStats.responseQualities)) state.dailyStats.responseQualities = [];
        state.dailyStats.responseQualities.push(record);

        const allQualities = state.dailyStats.responseQualities;
        state.dailyStats.avgResponseQuality =
          allQualities.length > 0
            ? (allQualities.reduce((a, b) => a + (b?.overallScore || 0), 0) / allQualities.length)
            : 0;

        // localStorage에 저장 (사용자별)
        if (state.userEmail) {
          const storageKey = getStorageKey(state.userEmail);
          localStorage.setItem(storageKey, JSON.stringify(state.dailyStats));
        }
      }
    },

    // ===== 문장 연습 (Pace Ratio) =====
    startPractice: (state, action) => {
      state.currentSession.currentPractice = {
        sentenceId: action.payload.sentenceId,
        referenceAudioDuration: 0,
        userSpeakingDuration: 0,
      };
    },

    setReferenceAudioDuration: (state, action) => {
      state.currentSession.currentPractice.referenceAudioDuration =
        action.payload.duration;
    },

    updatePracticeSpeakingTime: (state, action) => {
      state.currentSession.currentPractice.userSpeakingDuration +=
        action.payload.deltaTime;
    },

    resetCurrentPractice: (state) => {
      const { sentenceId, referenceAudioDuration } = state.currentSession.currentPractice;
      state.currentSession.currentPractice = {
        sentenceId,  // 유지
        referenceAudioDuration,  // 유지
        userSpeakingDuration: 0,  // 초기화
      };
    },

    completePractice: (state, action) => {
      const { currentPractice } = state.currentSession;
      const userTime = action.payload?.userSpeakingTime ?? currentPractice.userSpeakingDuration;

      if (
        currentPractice.sentenceId &&
        currentPractice.referenceAudioDuration > 0 &&
        userTime > 0
      ) {
        const paceRatio = userTime / currentPractice.referenceAudioDuration;
        state.currentSession.practiceRecords.push({
          sentenceId: currentPractice.sentenceId,
          paceRatio,
          userTime,
          refTime: currentPractice.referenceAudioDuration,
          timestamp: Date.now(),
        });
      }
      // 리셋
      state.currentSession.currentPractice = {
        sentenceId: null,
        referenceAudioDuration: 0,
        userSpeakingDuration: 0,
      };
    },

    // ===== 일별 통계 =====
    resetDailyStats: (state) => {
      state.dailyStats = {
        ...initialDailyStats,
        date: getTodayKey(),
      };
      // localStorage에 저장 (사용자별)
      if (state.userEmail) {
        const storageKey = getStorageKey(state.userEmail);
        localStorage.setItem(storageKey, JSON.stringify(state.dailyStats));
      }
    },

    // 수동 저장 (필요시)
    saveDailyStats: (state) => {
      if (!state.dailyStats.date) {
        state.dailyStats.date = getTodayKey();
      }
      // localStorage에 저장 (사용자별)
      if (state.userEmail) {
        const storageKey = getStorageKey(state.userEmail);
        localStorage.setItem(storageKey, JSON.stringify(state.dailyStats));
      }
    },
  },

  extraReducers: (builder) => {
    builder
      .addCase(loadStatsFromStorage.pending, (state) => {
        state.isLoading = true;
      })
      .addCase(loadStatsFromStorage.fulfilled, (state, action) => {
        state.isLoading = false;
        state.dailyStats = action.payload.stats;
        state.userEmail = action.payload.userEmail;  // Set user context
      })
      .addCase(loadStatsFromStorage.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.error.message;
      });
  },
});

export const {
  setUserContext,
  startSession,
  endSession,
  updateRecordingTime,
  updateSpeakingTime,
  addResponseQuality,
  startPractice,
  setReferenceAudioDuration,
  updatePracticeSpeakingTime,
  resetCurrentPractice,
  completePractice,
  resetDailyStats,
  saveDailyStats,
} = speakingStatsSlice.actions;

export default speakingStatsSlice.reducer;
