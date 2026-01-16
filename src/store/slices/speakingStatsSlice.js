import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';

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
  totalSessionTime: 0,
  userSpeakingTime: 0,
  ttsPlaybackTime: 0,
  systemLoadingTime: 0,

  // TTS 추적 (Response Latency 계산용)
  lastTtsEndTime: null,
  _ttsStartTime: null,

  // 시스템 로딩 추적
  _loadingStartTime: null,

  // 문장 연습 (Pace Ratio 계산용)
  currentPractice: {
    sentenceId: null,
    referenceAudioDuration: 0,
    userSpeakingDuration: 0,
  },

  // 세션 내 기록
  practiceRecords: [], // [{sentenceId, paceRatio, userTime, refTime, timestamp}]
  responseLatencies: [], // [latency in ms]
};

// 초기 일별 통계 상태
const initialDailyStats = {
  date: null,

  // 누적 시간
  totalSpeakingTime: 0,
  totalSessionTime: 0,
  totalTtsPlaybackTime: 0,
  totalSystemLoadingTime: 0,

  // 집계
  sessionsCount: 0,
  practiceCount: 0,
  chatTurnsCount: 0,

  // 평균 지표
  avgPaceRatio: 0,
  avgResponseLatency: 0,
  avgNetSpeakingDensity: 0,

  // 상세 기록
  paceRatios: [],
  responseLatencies: [],
};

const initialState = {
  currentSession: { ...initialSessionState },
  dailyStats: { ...initialDailyStats },
  isLoading: false,
  error: null,
};

// localStorage에서 일별 통계 로드
export const loadStatsFromStorage = createAsyncThunk(
  'speakingStats/loadFromStorage',
  async () => {
    const todayKey = getTodayKey();
    const stored = localStorage.getItem(STORAGE_KEY);

    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        if (parsed.date === todayKey) {
          return parsed;
        }
      } catch (e) {
        console.error('Failed to parse stored stats:', e);
      }
    }

    // 날짜가 다르거나 데이터 없으면 새로 시작
    return { ...initialDailyStats, date: todayKey };
  }
);

const speakingStatsSlice = createSlice({
  name: 'speakingStats',
  initialState,
  reducers: {
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
      state.dailyStats.totalSpeakingTime += session.userSpeakingTime;
      state.dailyStats.totalSessionTime += session.totalSessionTime;
      state.dailyStats.totalTtsPlaybackTime += session.ttsPlaybackTime;
      state.dailyStats.totalSystemLoadingTime += session.systemLoadingTime;
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

      // Response Latency 누적
      if (session.responseLatencies.length > 0) {
        state.dailyStats.chatTurnsCount += session.responseLatencies.length;
        session.responseLatencies.forEach((latency) => {
          state.dailyStats.responseLatencies.push(latency);
        });
        // 평균 재계산
        const allLatencies = state.dailyStats.responseLatencies;
        state.dailyStats.avgResponseLatency =
          allLatencies.reduce((a, b) => a + b, 0) / allLatencies.length;
      }

      // Net Speaking Density 평균 재계산
      const availableTime =
        state.dailyStats.totalSessionTime -
        state.dailyStats.totalTtsPlaybackTime -
        state.dailyStats.totalSystemLoadingTime;
      if (availableTime > 0) {
        state.dailyStats.avgNetSpeakingDensity =
          (state.dailyStats.totalSpeakingTime / availableTime) * 100;
      }

      // 날짜 설정
      if (!state.dailyStats.date) {
        state.dailyStats.date = getTodayKey();
      }

      // localStorage에 저장
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state.dailyStats));

      // 세션 초기화
      state.currentSession = { ...initialSessionState };
    },

    // ===== 시간 업데이트 =====
    updateSessionTime: (state, action) => {
      state.currentSession.totalSessionTime += action.payload.deltaTime;
    },

    updateSpeakingTime: (state, action) => {
      const { deltaTime, isSpeaking } = action.payload;
      if (isSpeaking) {
        state.currentSession.userSpeakingTime += deltaTime;
      }
    },

    // ===== TTS 재생 추적 =====
    ttsPlaybackStarted: (state, action) => {
      state.currentSession._ttsStartTime = action.payload.startTime;
    },

    ttsPlaybackEnded: (state, action) => {
      const { duration, endTime } = action.payload;
      state.currentSession.ttsPlaybackTime += duration;
      state.currentSession.lastTtsEndTime = endTime;
      state.currentSession._ttsStartTime = null;
    },

    // ===== 시스템 로딩 추적 =====
    systemLoadingStarted: (state) => {
      state.currentSession._loadingStartTime = Date.now();
    },

    systemLoadingEnded: (state) => {
      if (state.currentSession._loadingStartTime) {
        const duration = Date.now() - state.currentSession._loadingStartTime;
        state.currentSession.systemLoadingTime += duration;
        state.currentSession._loadingStartTime = null;
      }
    },

    // ===== 발화 감지 이벤트 =====
    userSpeakingStarted: (state, action) => {
      const { startTime } = action.payload;

      // Response Latency 계산 (ChatPage용)
      if (
        state.currentSession.sessionType === 'chat' &&
        state.currentSession.lastTtsEndTime
      ) {
        const latency = startTime - state.currentSession.lastTtsEndTime;
        // 유효한 범위만 기록 (0.1초 ~ 30초)
        if (latency > 100 && latency < 30000) {
          state.currentSession.responseLatencies.push(latency);
        }
        // 한 번 기록 후 초기화 (중복 방지)
        state.currentSession.lastTtsEndTime = null;
      }
    },

    userSpeakingEnded: () => {
      // 현재는 특별한 처리 없음
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
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state.dailyStats));
    },

    // 수동 저장 (필요시)
    saveDailyStats: (state) => {
      if (!state.dailyStats.date) {
        state.dailyStats.date = getTodayKey();
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state.dailyStats));
    },
  },

  extraReducers: (builder) => {
    builder
      .addCase(loadStatsFromStorage.pending, (state) => {
        state.isLoading = true;
      })
      .addCase(loadStatsFromStorage.fulfilled, (state, action) => {
        state.isLoading = false;
        state.dailyStats = action.payload;
      })
      .addCase(loadStatsFromStorage.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.error.message;
      });
  },
});

export const {
  startSession,
  endSession,
  updateSessionTime,
  updateSpeakingTime,
  ttsPlaybackStarted,
  ttsPlaybackEnded,
  systemLoadingStarted,
  systemLoadingEnded,
  userSpeakingStarted,
  userSpeakingEnded,
  startPractice,
  setReferenceAudioDuration,
  updatePracticeSpeakingTime,
  completePractice,
  resetDailyStats,
  saveDailyStats,
} = speakingStatsSlice.actions;

export default speakingStatsSlice.reducer;
