import axios from './axios';

function normalizeSentences(data) {
  // Accept: ["a","b"] OR {sentences:["a","b"]} OR {sentences:[{text:""}]}
  const raw = Array.isArray(data) ? data : (data?.sentences ?? data?.items ?? []);
  return (raw || [])
    .map((s) => (typeof s === 'string' ? s : s?.text))
    .filter((t) => typeof t === 'string' && t.trim().length > 0)
    .map((t) => t.trim());
}

/**
 * 문장 생성 API
 * POST /api/sentences/generate
 * @param {Object} params
 * @param {string} params.topic
 * @param {string} params.difficulty
 * @returns {Promise<string[]>}
 */
export async function generatePracticeSentences({ topic, difficulty }) {
  // 문장 생성은 서버 작업이 길 수 있어 timeout을 넉넉히 둠
  const res = await axios.post(
    '/api/sentences/generate',
    { topic, difficulty },
    { timeout: 60000 }
  );
  return normalizeSentences(res.data);
}

/**
 * 추천 문장 API
 * POST /api/sentences/recommend
 * @param {Object} params
 * @param {string} params.topic - restaurant, airport, shopping, hotel, hospital, interview, daily, directions
 * @param {string} params.difficulty - easy, medium, hard
 * @param {number=} params.count - 1~10 (기본값: 5)
 * @param {string=} params.conversationId - 선택: 대화 중이면 턴 차감
 * @returns {Promise<{sentences: Array<{id: number, text: string}>, topic: string, difficulty: string, count: number}>}
 */
export async function getRecommendedSentences({ topic, difficulty, count = 3, conversationId }) {
  const payload = { topic, difficulty, count };
  if (conversationId) {
    payload.conversationId = conversationId;
  }

  const res = await axios.post(
    '/api/sentences/recommend',
    payload,
    { timeout: 30000 }
  );
  return res.data;
}

/**
 * 문장 피드백 API
 * POST /api/sentences/feedback
 * @param {Object} params
 * @param {string} params.originalText - 원본 문장 (정답)
 * @param {string} params.userText - 사용자가 말한 문장 (STT 결과)
 * @param {string=} params.difficulty - easy, medium, hard (기본값: medium)
 * @returns {Promise<{correctedUserText: string, feedback: string[], suggestions: string[], encouragement: string}>}
 */
export async function getSentenceFeedback({ originalText, userText, difficulty = 'medium' }) {
  const res = await axios.post(
    '/api/sentences/feedback',
    { originalText, userText, difficulty },
    { timeout: 30000 }
  );
  return res.data;
}

