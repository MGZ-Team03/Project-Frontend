/**
 * 대화 난이도 레벨 정의
 * 각 난이도는 응답 길이, 어휘 수준, 문장 복잡도를 결정합니다
 */

export const DIFFICULTY_LEVELS = {
  하: {
    id: '하',
    label: '초급 (Beginner)',
    icon: 'SentimentSatisfied',
    maxWords: 8,
    maxTokens: 30,
    vocabulary: 'basic',
    sentenceComplexity: 'simple',
    topicDepth: 'surface',
    description: '짧고 간단한 대화, 기본 단어만 사용',
    color: '#4caf50' // green
  },
  중: {
    id: '중',
    label: '중급 (Intermediate)',
    icon: 'SentimentNeutral',
    maxWords: 15,
    maxTokens: 50,
    vocabulary: 'everyday',
    sentenceComplexity: 'moderate',
    topicDepth: 'moderate',
    description: '자연스러운 대화, 일상 어휘 사용',
    color: '#ff9800' // orange
  },
  상: {
    id: '상',
    label: '고급 (Advanced)',
    icon: 'SentimentVerySatisfied',
    maxWords: 25,
    maxTokens: 80,
    vocabulary: 'advanced',
    sentenceComplexity: 'complex',
    topicDepth: 'detailed',
    description: '복잡한 대화, 관용구와 세부사항 포함',
    color: '#f44336' // red
  }
};

/**
 * 난이도 ID로 난이도 객체 찾기
 */
export function getDifficultyById(id) {
  return DIFFICULTY_LEVELS[id] || DIFFICULTY_LEVELS['중'];
}

/**
 * 기본 난이도 반환
 */
export function getDefaultDifficulty() {
  return DIFFICULTY_LEVELS['중'];
}

/**
 * 모든 난이도 배열로 반환 (UI용)
 */
export function getAllDifficulties() {
  return Object.values(DIFFICULTY_LEVELS);
}
