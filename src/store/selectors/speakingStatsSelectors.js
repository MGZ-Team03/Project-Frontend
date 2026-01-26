// ===== 현재 세션 데이터 =====
export const selectCurrentSession = (state) => state.speakingStats.currentSession;

// ===== Pace Ratio 관련 =====

// 현재 연습 중인 Pace Ratio
export const selectCurrentPaceRatio = (state) => {
  const { currentPractice, lastPaceRatio } = state.speakingStats.currentSession;

  // 진행 중인 연습이 있으면 실시간 계산
  if (currentPractice.referenceAudioDuration > 0 &&
      currentPractice.userSpeakingDuration > 0) {
    return currentPractice.userSpeakingDuration / currentPractice.referenceAudioDuration;
  }

  // 완료된 연습이면 마지막 값 반환
  return lastPaceRatio ?? null;
};

// 세션 내 평균 Pace Ratio
export const selectSessionAvgPaceRatio = (state) => {
  const { paceRatioAvg, paceRatioCount } = state.speakingStats.currentSession;
  if (!paceRatioCount) return null;
  return paceRatioAvg;
};

// (호환용) 세션 내 모든 Pace Ratio 기록 - 배열 제거됨
export const selectPracticeRecords = (state) => {
  return [];
};

// ===== Response Quality 관련 =====

// 마지막 Response Quality
export const selectLastResponseQuality = (state) => {
  return state.speakingStats.currentSession.lastResponseQuality || null;
};

// 세션 내 평균 Response Quality
export const selectSessionAvgResponseQuality = (state) => {
  const { responseQualityAvg, responseQualityCount } = state.speakingStats.currentSession;
  if (!responseQualityCount) return null;
  return responseQualityAvg;
};

// (호환용) 세션 내 모든 Response Quality 기록 - 배열 제거됨
export const selectResponseQualities = (state) => {
  return [];
};

// ===== Net Speaking Density 관련 =====

// 실시간 Net Speaking Density (%)
// 녹음 시간 대비 실제 발화 시간 비율
export const selectNetSpeakingDensity = (state) => {
  const { totalRecordingTime, userSpeakingTime } = state.speakingStats.currentSession;

  if (totalRecordingTime <= 0) return 0;

  return (userSpeakingTime / totalRecordingTime) * 100;
};

// ===== 일별 통계 =====

export const selectDailyStats = (state) => state.speakingStats.dailyStats;

export const selectDailyAvgPaceRatio = (state) => state.speakingStats.dailyStats.avgPaceRatio;

export const selectDailyAvgNetSpeakingDensity = (state) =>
  state.speakingStats.dailyStats.avgNetSpeakingDensity;

export const selectDailyAvgResponseQuality = (state) =>
  state.speakingStats.dailyStats.avgResponseQuality;

// ===== 피드백 함수 =====

// Pace Ratio 평가
export const getPaceRatioFeedback = (ratio) => {
  if (ratio === null || ratio === undefined) {
    return { level: 'unknown', message: '데이터 없음', color: 'gray' };
  }
  if (ratio >= 0.8 && ratio <= 1.8) {
    return { level: 'good', message: '적절한 속도입니다', color: 'green' };
  }
  if (ratio > 1.8) {
    return { level: 'slow', message: '너무 느립니다', color: 'orange' };
  }
  if (ratio < 0.8) {
    return { level: 'fast', message: '너무 빠릅니다', color: 'orange' };
  }
  return { level: 'ok', message: '조금 조절이 필요합니다', color: 'yellow' };
};

// Net Speaking Density 평가 (% 단위)
export const getNetSpeakingDensityFeedback = (density) => {
  if (density === null || density === undefined) {
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

// Response Quality 평가 (0-100점 척도)
export const getResponseQualityFeedback = (overallScore) => {
  if (overallScore === null || overallScore === undefined) {
    return { level: 'unknown', message: '데이터 없음', color: 'gray' };
  }
  if (overallScore >= 80) {
    return { level: 'excellent', message: '훌륭한 응답!', color: 'green' };
  }
  if (overallScore >= 60) {
    return { level: 'good', message: '좋은 응답', color: 'lightgreen' };
  }
  if (overallScore >= 40) {
    return { level: 'ok', message: '보통', color: 'yellow' };
  }
  return { level: 'poor', message: '개선 필요', color: 'orange' };
};
