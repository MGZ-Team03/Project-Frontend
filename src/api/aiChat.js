import axios from './axios';
import { pollWithBackoff } from '../utils/polling';

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
 * AI 대화 상태 확인 (폴링용)
 * @param {string} requestId - AI 대화 요청 ID
 * @returns {Promise<{status: string, aiResponse?: string, error?: string}>}
 */
async function checkChatStatus(requestId) {
  const res = await axios.get(`/api/ai/chat/status/${requestId}`);
  return res.data;
}

/**
 * AI 대화 메시지 전송 - SQS 비동기 처리 지원
 * POST /api/ai/chat/message
 * @param {Object} params
 * @param {string} params.conversationId - 대화 ID
 * @param {string} params.userMessage - 사용자 메시지
 * @param {Object=} params.pollingOptions - 폴링 옵션 (선택)
 * @returns {Promise<{assistantMessage?:string, message?:string, content?:string, aiResponse?:string}>}
 */
export async function sendAiChatMessage({ conversationId, userMessage, pollingOptions = {} }) {
  const res = await axios.post('/api/ai/chat/message', { conversationId, userMessage });

  // 동기 응답 (200) - 즉시 반환
  if (res.status === 200) {
    return res.data;
  }

  // 비동기 처리 (202) - 폴링 필요
  if (res.status === 202) {
    const { requestId } = res.data;

    // 폴링으로 AI 응답 대기
    const result = await pollWithBackoff(checkChatStatus, requestId, {
      maxAttempts: 60,
      initialInterval: 1000,
      maxInterval: 3000,
      ...pollingOptions,
    });

    return {
      conversationId: result.conversationId,
      assistantMessage: result.aiResponse,
      aiMessage: result.aiResponse,
      message: result.aiResponse,
      content: result.aiResponse,
      turnCount: result.turnCount,
    };
  }

  // 기타 응답은 그대로 반환
  return res.data;
}

