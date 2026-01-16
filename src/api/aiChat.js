import axios from './axios';

/**
 * AI 대화 시작
 * POST /api/ai/chat/start
 * @returns {Promise<{conversationId:string, assistantMessage?:string, message?:string}>}
 */
export async function startAiChat({ topic, difficulty }) {
  const res = await axios.post('/api/ai/chat/start', { topic, difficulty });
  return res.data;
}

/**
 * AI 대화 메시지 전송
 * POST /api/ai/chat/message
 * @returns {Promise<{assistantMessage?:string, message?:string, content?:string}>}
 */
export async function sendAiChatMessage({ conversationId, userMessage }) {
  const res = await axios.post('/api/ai/chat/message', { conversationId, userMessage });
  return res.data;
}

