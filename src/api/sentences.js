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

