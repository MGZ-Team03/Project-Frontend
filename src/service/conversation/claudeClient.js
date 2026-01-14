import Anthropic from '@anthropic-ai/sdk';

/**
 * Claude API 클라이언트 설정
 *
 * 주의: dangerouslyAllowBrowser: true 는 로컬 개발 전용입니다.
 * 프로덕션 환경에서는 반드시 백엔드 프록시를 통해 API 키를 보호해야 합니다.
 */

const apiKey = import.meta.env.VITE_CLAUDE_API_KEY;

if (!apiKey || apiKey === 'your_api_key_here') {
  console.warn('[ClaudeClient] API key not configured. Please set VITE_CLAUDE_API_KEY in .env file');
}

export const anthropic = new Anthropic({
  apiKey: apiKey || '',
  dangerouslyAllowBrowser: true // ⚠️ 로컬 개발 전용
});

/**
 * API 키가 설정되었는지 확인
 */
export function isApiKeyConfigured() {
  return apiKey && apiKey !== 'your_api_key_here';
}
