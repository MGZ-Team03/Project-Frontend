import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { getDailyStats } from '../../api/stats';
import { mapBackendToReduxStats } from '../../utils/statsSync';
import { getStorageKey, migrateOldStatsKey } from '../../utils/storageKeys';

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
  chatTurnsCount: 0,     // AI 대화 턴 수

  // 4대 지표 (일별 평균)
  avgPaceRatio: 0,
  avgNetSpeakingDensity: 0,
  avgResponseQuality: 0,
  avgResponseLatency: 0, // AI 응답 평균 지연 시간 (ms)

  // 누적 평균 계산용 카운터 (메모리 누수 방지)
  paceRatioCount: 0,
  responseQualityCount: 0,
  responseLatencyCount: 0
};

const initialState = {
  currentSession: { ...initialSessionState },
  dailyStats: { ...initialDailyStats },
  userEmail: null,  // User context for localStorage key
  isLoading: false,
  error: null,
};

// localStorage에서 일일 통계 로드 (백엔드 fallback)
export const loadStatsFromStorage = createAsyncThunk(
  'speakingStats/loadFromStorage',
  async ({ userEmail }, { rejectWithValue }) => {
    if (!userEmail) {
      return rejectWithValue('No user email provided');
    }

    migrateOldStatsKey(userEmail);
    const storageKey = getStorageKey(userEmail);
    const todayKey = getTodayKey();

    // 1. localStorage 먼저 확인
    const stored = localStorage.getItem(storageKey);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        // 날짜가 오늘과 일치하는지 확인
        if (parsed.date === todayKey) {
          console.log(`✓ Loaded stats from localStorage for ${userEmail}`);
          return { stats: parsed, userEmail };
        } else {
          // 날짜 불일치 → localStorage 클리어
          console.log(`⚠ Date mismatch in localStorage (${parsed.date} vs ${todayKey}), clearing...`);
          localStorage.removeItem(storageKey);
        }
      } catch (e) {
        console.error('Failed to parse localStorage stats:', e);
        localStorage.removeItem(storageKey);
      }
    }

    // 2. localStorage 없거나 날짜 불일치 → 백엔드 시도
    try {
      const response = await getDailyStats(userEmail);
      const backendStats = response.data; // API 응답에서 data 필드 추출
      const reduxStats = mapBackendToReduxStats(backendStats);
      // 백엔드 데이터를 localStorage에 저장
      localStorage.setItem(storageKey, JSON.stringify(reduxStats));
      console.log(`✓ Loaded stats from backend and saved to localStorage for ${userEmail}`);
      return { stats: reduxStats, userEmail };
    } catch (error) {
      // 404 = 백엔드에도 없음 → 새로 시작
      if (error.response?.status === 404) {
        const freshStats = { ...initialDailyStats, date: todayKey };
        localStorage.setItem(storageKey, JSON.stringify(freshStats));
        console.log(`✓ No backend stats found, starting fresh for ${userEmail}`);
        return { stats: freshStats, userEmail };
      }

      console.error('Failed to load stats from backend:', error);
      return rejectWithValue(error.message);
    }
  }
);

// 백엔드 저장(현재는 localStorage 우선) - 호출부 호환용
export const saveStatsToBackend = createAsyncThunk(
  'speakingStats/saveToBackend',
  async ({ dailyStats, userEmail }, { rejectWithValue }) => {
    try {
      if (!userEmail) return rejectWithValue('No user email provided');
      if (!dailyStats) return rejectWithValue('No dailyStats provided');

      // localStorage에 먼저 저장(최소 보장)
      const storageKey = getStorageKey(userEmail);
      localStorage.setItem(storageKey, JSON.stringify(dailyStats));

      // TODO: 백엔드 업로드 API가 확정되면 여기서 호출
      return { success: true };
    } catch (e) {
      return rejectWithValue(e?.message || 'Failed to save stats');
    }
  }
);

// 백엔드 저장은 세션 종료 시 POST /api/sessions/end를 통해 자동으로 이루어집니다.
// 프론트엔드는 localStorage를 통한 로컬 캐싱만 수행합니다.

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

      // Pace Ratio 누적 평균 계산 (메모리 누수 방지)
      if (session.practiceRecords.length > 0) {
        state.dailyStats.practiceCount += session.practiceRecords.length;

        // 누적 평균 방식으로 계산
        session.practiceRecords.forEach((record) => {
          const currentCount = state.dailyStats.paceRatioCount;
          const currentAvg = state.dailyStats.avgPaceRatio;

          // 새로운 평균 = (이전평균 × 이전개수 + 새값) / (이전개수 + 1)
          state.dailyStats.avgPaceRatio =
            (currentAvg * currentCount + record.paceRatio) / (currentCount + 1);
          state.dailyStats.paceRatioCount = currentCount + 1;
        });
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

      // localStorage 저장
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

        // 일별 통계 누적 평균 계산 (메모리 누수 방지)
        if (!state.dailyStats.date) state.dailyStats.date = getTodayKey();

        const currentCount = state.dailyStats.responseQualityCount;
        const currentAvg = state.dailyStats.avgResponseQuality;

        // 새로운 평균 = (이전평균 × 이전개수 + 새값) / (이전개수 + 1)
        state.dailyStats.avgResponseQuality =
          (currentAvg * currentCount + overallScore) / (currentCount + 1);
        state.dailyStats.responseQualityCount = currentCount + 1;
      }
    },

    // ===== AI 대화 턴 증가 (ChatPage용) =====
    incrementChatTurn: (state) => {
      if (state.currentSession.sessionType === 'chat') {
        if (!state.dailyStats.date) state.dailyStats.date = getTodayKey();
        state.dailyStats.chatTurnsCount += 1;
      }
    },

    // ===== AI 응답 지연 시간 기록 (ChatPage용) =====
    addResponseLatency: (state, action) => {
      const { latencyMs } = action.payload;

      if (state.currentSession.sessionType === 'chat' && latencyMs > 0) {
        if (!state.dailyStats.date) state.dailyStats.date = getTodayKey();

        // 누적 평균 계산 (메모리 누수 방지)
        const currentCount = state.dailyStats.responseLatencyCount;
        const currentAvg = state.dailyStats.avgResponseLatency;

        // 새로운 평균 = (이전평균 × 이전개수 + 새값) / (이전개수 + 1)
        state.dailyStats.avgResponseLatency =
          (currentAvg * currentCount + latencyMs) / (currentCount + 1);
        state.dailyStats.responseLatencyCount = currentCount + 1;
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

      // localStorage 저장
      if (state.userEmail) {
        const storageKey = getStorageKey(state.userEmail);
        localStorage.setItem(storageKey, JSON.stringify(state.dailyStats));
      }
    },

    // localStorage에 현재 일별 통계 수동 저장
    saveDailyStats: (state) => {
      if (!state.dailyStats.date) {
        state.dailyStats.date = getTodayKey();
      }
      if (state.userEmail) {
        const storageKey = getStorageKey(state.userEmail);
        localStorage.setItem(storageKey, JSON.stringify(state.dailyStats));
      }
    },
  },

  extraReducers: (builder) => {
    builder
      // loadStatsFromStorage thunk
      .addCase(loadStatsFromStorage.pending, (state) => {
        state.isLoading = true;
      })
      .addCase(loadStatsFromStorage.fulfilled, (state, action) => {
        state.isLoading = false;
        state.dailyStats = action.payload.stats;
        state.userEmail = action.payload.userEmail;
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
  incrementChatTurn,
  addResponseLatency,
  startPractice,
  setReferenceAudioDuration,
  updatePracticeSpeakingTime,
  resetCurrentPractice,
  completePractice,
  resetDailyStats,
  saveDailyStats,
} = speakingStatsSlice.actions;

export default speakingStatsSlice.reducer;
