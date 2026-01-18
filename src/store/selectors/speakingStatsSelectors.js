// ===== 현재 세션 데이터 =====
export const selectCurrentSession = (state) => state.speakingStats.currentSession;

// ===== Pace Ratio 관련 =====

// 현재 연습 중인 Pace Ratio
export const selectCurrentPaceRatio = (state) => {
  const { currentPractice } = state.speakingStats.currentSession;
  if (!currentPractice.referenceAudioDuration || currentPractice.referenceAudioDuration === 0) {
    return null;
  }
  return currentPractice.userSpeakingDuration / currentPractice.referenceAudioDuration;
};

// 세션 내 평균 Pace Ratio
export const selectSessionAvgPaceRatio = (state) => {
  const { practiceRecords } = state.speakingStats.currentSession;
  if (practiceRecords.length === 0) return null;
  const sum = practiceRecords.reduce((acc, r) => acc + r.paceRatio, 0);
  return sum / practiceRecords.length;
};

// 세션 내 모든 Pace Ratio 기록
export const selectPracticeRecords = (state) => {
  return state.speakingStats.currentSession.practiceRecords;
};

// ===== Response Latency 관련 =====

// 마지막 Response Latency
export const selectLastResponseLatency = (state) => {
  const { responseLatencies } = state.speakingStats.currentSession;
  if (responseLatencies.length === 0) return null;
  return responseLatencies[responseLatencies.length - 1];
};

// 세션 내 평균 Response Latency
export const selectSessionAvgResponseLatency = (state) => {
  const { responseLatencies } = state.speakingStats.currentSession;
  if (responseLatencies.length === 0) return null;
  const sum = responseLatencies.reduce((acc, l) => acc + l, 0);
  return sum / responseLatencies.length;
};

// 세션 내 모든 Response Latency 기록
export const selectResponseLatencies = (state) => {
  return state.speakingStats.currentSession.responseLatencies;
};

// ===== Net Speaking Density 관련 =====

// 실시간 Net Speaking Density (%)
export const selectNetSpeakingDensity = (state) => {
  const { totalSessionTime, userSpeakingTime, ttsPlaybackTime, systemLoadingTime } =
    state.speakingStats.currentSession;

  const availableTime = totalSessionTime - ttsPlaybackTime - systemLoadingTime;
  if (availableTime <= 0) return 0;

  return (userSpeakingTime / availableTime) * 100;
};

// 기본 발화 비율 (전체 시간 대비)
export const selectBasicSpeakingRatio = (state) => {
  const { totalSessionTime, userSpeakingTime } = state.speakingStats.currentSession;
  if (totalSessionTime === 0) return 0;
  return (userSpeakingTime / totalSessionTime) * 100;
};

// ===== 일별 통계 =====

export const selectDailyStats = (state) => state.speakingStats.dailyStats;

export const selectDailyAvgPaceRatio = (state) => state.speakingStats.dailyStats.avgPaceRatio;

export const selectDailyAvgResponseLatency = (state) =>
  state.speakingStats.dailyStats.avgResponseLatency;

export const selectDailyAvgNetSpeakingDensity = (state) =>
  state.speakingStats.dailyStats.avgNetSpeakingDensity;

// ===== 피드백 함수 =====

// Pace Ratio 평가
export const getPaceRatioFeedback = (ratio) => {
  if (ratio === null || ratio === undefined) {
    return { level: 'unknown', message: '데이터 없음', color: 'gray' };
  }
  if (ratio >= 0.85 && ratio <= 1.15) {
    return { level: 'good', message: '적절한 속도입니다', color: 'green' };
  }
  if (ratio > 1.5) {
    return { level: 'slow', message: '너무 느립니다', color: 'orange' };
  }
  if (ratio < 0.8) {
    return { level: 'fast', message: '너무 빠릅니다', color: 'orange' };
  }
  return { level: 'ok', message: '조금 조절이 필요합니다', color: 'yellow' };
};

// Response Latency 평가 (ms 단위)
export const getResponseLatencyFeedback = (latency) => {
  if (latency === null || latency === undefined) {
    return { level: 'unknown', message: '데이터 없음', color: 'gray' };
  }
  if (latency < 1000) {
    return { level: 'excellent', message: '매우 빠른 반응!', color: 'green' };
  }
  if (latency < 2000) {
    return { level: 'good', message: '좋은 반응 속도', color: 'lightgreen' };
  }
  if (latency < 3000) {
    return { level: 'ok', message: '보통', color: 'yellow' };
  }
  return { level: 'slow', message: '반응이 느립니다', color: 'orange' };
};

// Net Speaking Density 평가 (% 단위)
export const getNetSpeakingDensityFeedback = (density) => {
  if (density === null || density === undefined || density === 0) {
    return { level: 'unknown', message: '데이터 없음', color: 'gray' };
  }
  if (density >= 60) {
    return { level: 'excellent', message: '매우 적극적!', color: 'green' };
  }
  if (density >= 40) {
    return { level: 'good', message: '좋습니다', color: 'lightgreen' };
  }
  if (density >= 20) {
    return { level: 'ok', message: '보통', color: 'yellow' };
  }
  return { level: 'low', message: '더 많이 말해보세요', color: 'orange' };
};
