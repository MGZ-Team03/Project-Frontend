import { useState, useCallback } from 'react';
import { anthropic, isApiKeyConfigured } from '../../service/conversation/claudeClient';
import { DIFFICULTY_LEVELS } from '../../data/conversation/difficultyLevels';

/**
 * Claude API 대화 훅
 * 스트리밍 응답을 지원하는 Claude Messages API 통합
 *
 * @returns {Object} { sendMessage, isLoading, error }
 */
export function useClaudeConversation() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  /**
   * Claude에게 메시지 전송 (스트리밍)
   *
   * @param {string} userMessage - 사용자 메시지
   * @param {Array} conversationHistory - 대화 기록 [{ role, content }, ...]
   * @param {string} systemPrompt - 시스템 프롬프트
   * @param {string} difficulty - 난이도 ('하', '중', '상')
   * @param {Function} onStream - 스트리밍 텍스트를 받을 콜백 (텍스트 델타)
   * @param {Function} onComplete - 완료 시 콜백 (전체 응답 텍스트)
   */
  const sendMessage = useCallback(async (
    userMessage,
    conversationHistory,
    systemPrompt,
    difficulty,
    onStream,
    onComplete
  ) => {
    // API 키 확인
    if (!isApiKeyConfigured()) {
      const errorMsg = 'Claude API key is not configured. Please add VITE_CLAUDE_API_KEY to your .env file';
      console.error('[ClaudeConversation]', errorMsg);
      setError(errorMsg);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // 대화 히스토리 준비 (시스템 메시지 제외, user/assistant만)
      const messages = [
        ...conversationHistory,
        { role: 'user', content: userMessage }
      ];

      // 난이도에 따른 max_tokens 설정
      const difficultyConfig = DIFFICULTY_LEVELS[difficulty] || DIFFICULTY_LEVELS['중'];
      const maxTokens = difficultyConfig.maxTokens;

      console.log('[ClaudeConversation] Sending message:', {
        userMessage,
        historyLength: conversationHistory.length,
        difficulty,
        maxTokens,
        systemPrompt: systemPrompt.substring(0, 50) + '...'
      });

      // Claude API 호출 (스트리밍)
      const stream = await anthropic.messages.stream({
        model: 'claude-sonnet-4-5-20250929',
        max_tokens: maxTokens,
        system: systemPrompt,
        messages: messages
      });

      let fullResponse = '';

      // 스트리밍 이벤트 처리
      stream.on('text', (textDelta) => {
        fullResponse += textDelta;
        if (onStream) {
          onStream(textDelta, fullResponse);
        }
      });

      stream.on('error', (err) => {
        console.error('[ClaudeConversation] Stream error:', err);
        setError(err.message || 'Failed to get response from Claude');
        setIsLoading(false);
      });

      stream.on('end', () => {
        console.log('[ClaudeConversation] Stream completed:', fullResponse.substring(0, 100));
        if (onComplete) {
          onComplete(fullResponse);
        }
        setIsLoading(false);
      });

    } catch (err) {
      console.error('[ClaudeConversation] Error:', err);
      setError(err.message || 'Failed to send message');
      setIsLoading(false);
    }
  }, []);

  return {
    sendMessage,
    isLoading,
    error
  };
}
