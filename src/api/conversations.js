import axios from './axios';

/**
 * AI 대화 목록 조회
 * GET /api/ai/conversations
 * @param {number} limit - 조회할 최대 개수 (선택)
 * @returns {Promise<Object>} { success: boolean, data: Array }
 */
export async function getConversationList(limit = 20) {
  const res = await axios.get('/api/ai/conversations', {
    params: { limit }
  });
  return res.data;
}

/**
 * AI 대화 상세 조회 (메시지 포함)
 * GET /api/ai/conversations/{conversationId}
 * @param {string} conversationId - 대화 ID
 * @returns {Promise<Object>} { success: boolean, data: Object }
 */
export async function getConversationDetail(conversationId) {
  const res = await axios.get(`/api/ai/conversations/${conversationId}`);
  return res.data;
}
