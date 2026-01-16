/**
 * UI에서 쓰는 값 -> 백엔드 API가 기대하는 값으로 변환
 */

// UI(한글) -> API(영문)
const DIFFICULTY_MAP = {
  하: 'easy',
  중: 'medium',
  상: 'hard',
  easy: 'easy',
  medium: 'medium',
  hard: 'hard',
};

// 시나리오 id -> API topic
// (현재 scenarios.js의 id 기준)
const TOPIC_MAP = {
  restaurant: 'restaurant',
  airport: 'airport',
  shopping: 'shopping',
  hotel: 'hotel',
  doctor: 'hospital',
  job_interview: 'interview',
  small_talk: 'daily',
  directions: 'directions',
  // 이미 API topic으로 들어오는 경우
  hospital: 'hospital',
  interview: 'interview',
  daily: 'daily',
};

export function toApiDifficulty(difficulty) {
  return DIFFICULTY_MAP[difficulty] || 'medium';
}

export function toApiTopic(topic) {
  return TOPIC_MAP[topic] || 'restaurant';
}

