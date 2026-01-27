/**
 * 일별 통계 동기화 유틸리티
 * - 중복 업로드 방지 (해시 기반)
 * - Redux 데이터를 백엔드 형식으로 변환
 */

/**
 * 간단한 해시 함수 (djb2 알고리즘)
 * @param {string} str - 해시할 문자열
 * @returns {string} 해시 문자열
 */
function simpleHash(str) {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) + str.charCodeAt(i); // hash * 33 + c
  }
  return hash.toString(36);
}

/**
 * 객체를 안정적으로 직렬화 (키 정렬)
 * @param {Object} obj - 직렬화할 객체
 * @returns {string} JSON 문자열
 */
function stableStringify(obj) {
  if (obj === null || obj === undefined) return '';
  if (typeof obj !== 'object') return String(obj);
  if (Array.isArray(obj)) {
    return '[' + obj.map(stableStringify).join(',') + ']';
  }

  const keys = Object.keys(obj).sort();
  const pairs = keys.map(key => `"${key}":${stableStringify(obj[key])}`);
  return '{' + pairs.join(',') + '}';
}

/**
 * payload의 해시 계산
 * @param {Object} payload - 전송할 데이터
 * @returns {string} 해시 문자열
 */
export function calculatePayloadHash(payload) {
  const str = stableStringify(payload);
  return simpleHash(str);
}

/**
 * 마지막 전송 정보 조회
 * @param {string} userEmail - 사용자 이메일
 * @param {string} date - YYYY-MM-DD
 * @returns {Object|null} { digest, sentAt } 또는 null
 */
export function getLastSyncInfo(userEmail, date) {
  const key = `speaktracker_daily_stats_last_sync_${userEmail}_${date}`;
  const stored = localStorage.getItem(key);
  if (!stored) return null;

  try {
    return JSON.parse(stored);
  } catch {
    return null;
  }
}

/**
 * 마지막 전송 정보 저장
 * @param {string} userEmail - 사용자 이메일
 * @param {string} date - YYYY-MM-DD
 * @param {string} digest - payload 해시
 */
export function saveLastSyncInfo(userEmail, date, digest) {
  const key = `speaktracker_daily_stats_last_sync_${userEmail}_${date}`;
  const value = {
    digest,
    sentAt: Date.now(),
  };
  localStorage.setItem(key, JSON.stringify(value));
}

/**
 * 백엔드 형식을 Redux 형식으로 변환
 * @param {Object} backendStats - 백엔드 응답 데이터 (camelCase)
 * @returns {Object} Redux dailyStats 형식
 */
export function mapBackendToReduxStats(backendStats) {
  // snake_case와 camelCase 모두 지원 (백엔드 응답 형식에 따라)
  return {
    date: backendStats.date,
    totalRecordingTime: backendStats.totalRecordingTime ?? backendStats.total_recording_time ?? 0,
    totalSpeakingTime: backendStats.totalSpeakingTime ?? backendStats.total_speaking_time ?? 0,
    chatSpeakingTime: backendStats.chatSpeakingTime ?? backendStats.chat_speaking_time ?? 0,
    practiceSpeakingTime: backendStats.practiceSpeakingTime ?? backendStats.practice_speaking_time ?? 0,
    sessionsCount: backendStats.sessionsCount ?? backendStats.sessions_count ?? 0,
    practiceCount: backendStats.practiceCount ?? backendStats.practice_count ?? 0,
    chatTurnsCount: backendStats.chatTurnsCount ?? backendStats.chat_turns_count ?? 0,
    avgPaceRatio: backendStats.avgPaceRatio ?? backendStats.avg_pace_ratio ?? 0,
    avgNetSpeakingDensity: backendStats.avgNetSpeakingDensity ?? backendStats.avg_net_speaking_density ?? 0,
    avgResponseQuality: backendStats.avgResponseQuality ?? backendStats.avg_response_quality ?? 0,
    avgResponseLatency: backendStats.avgResponseLatency ?? backendStats.avg_response_latency ?? 0,
    // 누적 평균 계산용 카운터 (메모리 누수 방지)
    paceRatioCount: backendStats.paceRatioCount ?? backendStats.pace_ratio_count ?? 0,
    responseQualityCount: backendStats.responseQualityCount ?? backendStats.response_quality_count ?? 0,
    responseLatencyCount: backendStats.responseLatencyCount ?? backendStats.response_latency_count ?? 0,
  };
}

/**
 * Redux 일별 통계를 백엔드 형식으로 변환
 * @param {Object} dailyStats - Redux dailyStats
 * @param {string} userEmail - 사용자 이메일
 * @returns {Object} 백엔드 형식 payload
 */
export function mapDailyStatsToBackend(dailyStats, userEmail) {
  return {
    student_email: userEmail,
    date: dailyStats.date || new Date().toISOString().split('T')[0],

    total_recording_time: dailyStats.totalRecordingTime || 0,
    total_speaking_time: dailyStats.totalSpeakingTime || 0,
    sessions_count: dailyStats.sessionsCount || 0,
    practice_count: dailyStats.practiceCount || 0,
    chat_turns_count: dailyStats.chatTurnsCount || 0,

    avg_pace_ratio: dailyStats.avgPaceRatio || 0,
    avg_response_latency: dailyStats.avgResponseLatency || 0,
    avg_net_speaking_density: dailyStats.avgNetSpeakingDensity || 0,
    avg_response_quality: dailyStats.avgResponseQuality || 0,

    // 누적 평균 계산용 카운터 (배열 대신 사용)
    pace_ratio_count: dailyStats.paceRatioCount || 0,
    response_quality_count: dailyStats.responseQualityCount || 0,
    response_latency_count: dailyStats.responseLatencyCount || 0,
  };
}

/**
 * 통계 업로드 여부 확인 (중복 방지)
 * @param {Object} payload - 전송할 데이터
 * @param {string} userEmail - 사용자 이메일
 * @param {string} date - YYYY-MM-DD
 * @returns {boolean} true: 전송 필요, false: skip
 */
export function shouldUploadStats(payload, userEmail, date) {
  const newDigest = calculatePayloadHash(payload);
  const lastSync = getLastSyncInfo(userEmail, date);

  if (!lastSync) return true; // 처음 전송
  if (lastSync.digest !== newDigest) return true; // 데이터 변경됨

  return false; // 동일 데이터 - skip
}
