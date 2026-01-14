/**
 * 유연한 프롬프트 빌더
 * 난이도와 시나리오 메타데이터를 기반으로 자연스러운 시스템 프롬프트를 생성합니다
 */

import { DIFFICULTY_LEVELS } from '../../data/conversation/difficultyLevels';

/**
 * 난이도별 대화 스타일 가이드라인 생성
 */
function getDifficultyGuidance(difficulty) {
  switch (difficulty) {
    case '하':
      return `- Use very simple, common words
- Keep sentences short and clear
- Speak slowly and patiently
- Focus on one topic at a time`;

    case '중':
      return `- Use everyday conversational English
- Mix simple and moderate complexity
- Natural pace and rhythm
- Can introduce new topics smoothly`;

    case '상':
      return `- Use natural, fluent English with varied vocabulary
- Include idiomatic expressions where appropriate
- Discuss topics in detail
- Challenge with nuanced questions`;

    default:
      return getDifficultyGuidance('중');
  }
}

/**
 * 시나리오, 난이도, 사용자 이름을 기반으로 시스템 프롬프트 생성
 *
 * @param {Object} scenario - 시나리오 객체 (role, persona, conversationGoal 등 포함)
 * @param {string} difficulty - 난이도 ('하', '중', '상')
 * @param {string} userName - 사용자 이름
 * @returns {string} 생성된 시스템 프롬프트
 */
export function buildSystemPrompt(scenario, difficulty, userName) {
  const level = DIFFICULTY_LEVELS[difficulty] || DIFFICULTY_LEVELS['중'];
  const difficultyGuidance = getDifficultyGuidance(difficulty);

  // 기본 프롬프트 구조
  let prompt = `You are ${scenario.role}. You're having a conversation with ${userName}.

CONVERSATION STYLE:
${difficultyGuidance}

YOUR CHARACTER:
${scenario.persona.join(', ')}

APPROACH:
- Be natural and conversational
- ${scenario.conversationGoal}
- Adapt to how ${userName} responds
- Keep responses around ${level.maxWords} words (flexible, not strict)`;

  // 컨텍스트 노트가 있으면 추가
  if (scenario.contextNotes) {
    prompt += `\n\n${scenario.contextNotes}`;
  }

  // 대화 시작 스타일
  prompt += `\n\nStart the conversation: ${scenario.openingStyle}`;

  return prompt;
}
