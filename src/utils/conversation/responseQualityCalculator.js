/**
 * Response Quality Calculator
 *
 * 다차원 응답 품질 평가 시스템
 * - Duration (발화 시간): 응답 길이
 * - Speech Rate (말 속도): 분당 단어 수 (wpm)
 * - Fluency Score (유창성): VAD 구간 기반 침묵 비율 분석
 *
 * @module responseQualityCalculator
 */

/**
 * 응답 품질을 다차원으로 평가
 *
 * @param {Object} params
 * @param {number} params.durationMs - 발화 지속 시간 (ms)
 * @param {string} params.transcript - STT 텍스트 (단어 수 계산용)
 * @param {Array<{start: number, end: number}>} params.vadSegments - VAD 구간 배열
 * @returns {Object} 응답 품질 평가 결과
 * @returns {number} return.durationMs - 발화 시간 (ms)
 * @returns {number} return.wordCount - 단어 수
 * @returns {number} return.wordsPerMinute - 분당 단어 수 (wpm)
 * @returns {number} return.fluencyScore - 유창성 점수 (0-100)
 * @returns {number} return.overallScore - 종합 점수 (0-100)
 */
export function calculateResponseQuality({ durationMs, transcript, vadSegments }) {
  // 기본값 처리
  if (!transcript || !vadSegments || vadSegments.length === 0 || durationMs <= 0) {
    return {
      durationMs: durationMs || 0,
      wordCount: 0,
      wordsPerMinute: 0,
      fluencyScore: 0,
      overallScore: 0,
    };
  }

  const durationSec = durationMs / 1000;

  // 1. Word Count 계산
  const words = transcript.trim().split(/\s+/).filter(w => w.length > 0);
  const wordCount = words.length;

  // 2. Speech Rate 계산 (wpm - words per minute)
  const wordsPerMinute = durationSec > 0 ? (wordCount / durationSec) * 60 : 0;

  // 3. Fluency Score 계산 (침묵 비율 기반)
  const fluencyScore = calculateFluencyScore(vadSegments, durationMs);

  // 4. Overall Score 계산 (0-100점 척도)
  const overallScore = calculateOverallScore(durationMs, wordsPerMinute, fluencyScore);

  return {
    durationMs,
    wordCount,
    wordsPerMinute: Math.round(wordsPerMinute * 10) / 10, // 소수점 1자리
    fluencyScore: Math.round(fluencyScore * 10) / 10, // 소수점 1자리
    overallScore: Math.round(overallScore),
  };
}

/**
 * VAD 구간 기반 유창성 점수 계산
 *
 * VAD 구간 사이의 침묵 시간을 분석하여 유창성을 평가
 * - 침묵이 적을수록 높은 점수
 * - "um... uh... well..." 패턴 감지
 *
 * @param {Array<{start: number, end: number}>} vadSegments - VAD 구간 배열
 * @param {number} totalDurationMs - 전체 발화 시간 (ms)
 * @returns {number} 유창성 점수 (0-100)
 */
function calculateFluencyScore(vadSegments, totalDurationMs) {
  if (!vadSegments || vadSegments.length === 0) {
    return 0;
  }

  // 단일 VAD 구간인 경우 (완전히 끊김 없는 발화)
  if (vadSegments.length === 1) {
    return 100;
  }

  // VAD 구간 사이의 침묵 시간 합산
  let totalSilence = 0;
  for (let i = 0; i < vadSegments.length - 1; i++) {
    const silenceDuration = vadSegments[i + 1].start - vadSegments[i].end;
    if (silenceDuration > 0) {
      totalSilence += silenceDuration;
    }
  }

  // 전체 지속 시간 계산 (첫 VAD 시작 ~ 마지막 VAD 끝)
  const totalDuration = vadSegments[vadSegments.length - 1].end - vadSegments[0].start;

  if (totalDuration <= 0) {
    return 0;
  }

  // 유창성 점수: (1 - 침묵 비율) * 100
  const fluencyScore = Math.max(0, (1 - (totalSilence / totalDuration)) * 100);

  return fluencyScore;
}

/**
 * 종합 점수 계산
 *
 * 3가지 차원을 가중치 합산하여 0-100점 척도로 평가:
 * - Duration: 30점 (1초~10초가 적정)
 * - Speech Rate: 35점 (80~180 wpm이 적정)
 * - Fluency: 35점 (침묵 비율이 낮을수록 높음)
 *
 * @param {number} durationMs - 발화 시간 (ms)
 * @param {number} wordsPerMinute - 분당 단어 수
 * @param {number} fluencyScore - 유창성 점수 (0-100)
 * @returns {number} 종합 점수 (0-100)
 */
function calculateOverallScore(durationMs, wordsPerMinute, fluencyScore) {
  let score = 0;

  // 1. Duration 평가 (0-30점)
  // 적정 범위: 1초~10초 (너무 짧거나 길면 감점)
  if (durationMs >= 1000 && durationMs <= 10000) {
    score += 30; // 완벽
  } else if (durationMs >= 500 && durationMs <= 15000) {
    score += 15; // 보통
  } else if (durationMs >= 300 && durationMs <= 20000) {
    score += 5; // 낮음
  }
  // 300ms 미만 또는 20초 초과: 0점

  // 2. Speech Rate 평가 (0-35점)
  // 적정 범위: 80~180 wpm
  // - 80 미만: 너무 느림 (말더듬, 긴 침묵)
  // - 180 초과: 너무 빠름 (긴장, 불안)
  if (wordsPerMinute >= 80 && wordsPerMinute <= 180) {
    score += 35; // 완벽
  } else if (wordsPerMinute >= 60 && wordsPerMinute <= 200) {
    score += 20; // 보통
  } else if (wordsPerMinute >= 40 && wordsPerMinute <= 220) {
    score += 10; // 낮음
  }
  // 40 미만 또는 220 초과: 0점

  // 3. Fluency 평가 (0-35점)
  // fluencyScore는 이미 0-100 스케일이므로 0.35를 곱해 35점 만점으로 변환
  score += Math.floor(fluencyScore * 0.35);

  return Math.min(100, Math.max(0, score)); // 0-100 범위 보장
}

/**
 * 응답 품질 피드백 메시지 생성
 *
 * @param {number} overallScore - 종합 점수 (0-100)
 * @returns {Object} 피드백 정보
 * @returns {string} return.level - 레벨 (excellent/good/ok/poor)
 * @returns {string} return.message - 피드백 메시지
 * @returns {string} return.color - UI 색상 힌트
 */
export function getResponseQualityFeedback(overallScore) {
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
}
