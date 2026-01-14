import { useState, useCallback } from 'react';
import { anthropic, isApiKeyConfigured } from '../../service/conversation/claudeClient';
import { DIFFICULTY_LEVELS } from '../../data/conversation/difficultyLevels';

/**
 * Claude API hook for generating practice sentences
 *
 * @returns {Object} { generateSentence, generateBatchSentences, isLoading, error }
 */
export function useClaudeSentenceGenerator() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  /**
   * Generate a single practice sentence from Claude
   *
   * @param {string} systemPrompt - System prompt for sentence generation
   * @param {string} difficulty - Difficulty level (하/중/상)
   * @returns {Promise<string>} Generated sentence text
   */
  const generateSentence = useCallback(async (systemPrompt, difficulty = '중') => {
    // API key check
    if (!isApiKeyConfigured()) {
      const errorMsg = 'Claude API key is not configured. Please add VITE_CLAUDE_API_KEY to your .env file';
      console.error('[SentenceGenerator]', errorMsg);
      setError(errorMsg);
      throw new Error(errorMsg);
    }

    setIsLoading(true);
    setError(null);

    try {
      // Get max_tokens from difficulty configuration
      const difficultyConfig = DIFFICULTY_LEVELS[difficulty] || DIFFICULTY_LEVELS['중'];
      const maxTokens = 100; // Fixed for sentence generation (short response)

      console.log('[SentenceGenerator] Generating sentence:', {
        difficulty,
        maxTokens,
        systemPrompt: systemPrompt.substring(0, 80) + '...'
      });

      // Call Claude API (non-streaming)
      const response = await anthropic.messages.create({
        model: 'claude-sonnet-4-5-20250929',
        max_tokens: maxTokens,
        system: systemPrompt,
        messages: [
          {
            role: 'user',
            content: 'Generate a practice sentence'
          }
        ]
      });

      // Extract sentence text from response
      const sentenceText = response.content[0].text.trim();

      console.log('[SentenceGenerator] Generated sentence:', sentenceText);

      setIsLoading(false);
      return sentenceText;

    } catch (err) {
      console.error('[SentenceGenerator] Error:', err);
      const errorMessage = err.message || 'Failed to generate sentence';
      setError(errorMessage);
      setIsLoading(false);
      throw err;
    }
  }, []);

  /**
   * Generate multiple practice sentences from Claude (Batch)
   *
   * @param {string} systemPrompt - System prompt for batch generation
   * @param {string} difficulty - Difficulty level (하/중/상)
   * @returns {Promise<string[]>} Array of generated sentence strings
   */
  const generateBatchSentences = useCallback(async (systemPrompt, difficulty = '중') => {
    // API key check
    if (!isApiKeyConfigured()) {
      const errorMsg = 'Claude API key is not configured. Please add VITE_CLAUDE_API_KEY to your .env file';
      console.error('[SentenceGenerator]', errorMsg);
      setError(errorMsg);
      throw new Error(errorMsg);
    }

    setIsLoading(true);
    setError(null);

    try {
      const maxTokens = 600; // Keep responses short; helps avoid unnecessary token usage

      console.log('[SentenceGenerator] Generating batch sentences:', {
        difficulty,
        maxTokens,
        systemPrompt: systemPrompt.substring(0, 80) + '...'
      });

      // Call Claude API (non-streaming)
      const response = await anthropic.messages.create({
        model: 'claude-sonnet-4-5-20250929',
        max_tokens: maxTokens,
        system: systemPrompt,
        messages: [
          {
            role: 'user',
            content: 'Generate the JSON array only. Do not add any other text.' // Align with system prompt
          }
        ]
      });

      // Extract JSON array from response
      const responseText = response.content[0].text.trim();
      console.log('[SentenceGenerator] Raw batch response:', responseText);

      let sentences = [];
      try {
        // Find JSON array in text (handling potential extra text)
        const jsonMatch = responseText.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          sentences = JSON.parse(jsonMatch[0]);
        } else {
          throw new Error('No JSON array found in response');
        }
      } catch (parseError) {
        console.error('[SentenceGenerator] JSON Parse Error:', parseError);
        console.error('Response text was:', responseText);
        throw new Error('Failed to parse generated sentences');
      }

      console.log(`[SentenceGenerator] Successfully generated ${sentences.length} sentences`);

      setIsLoading(false);
      return sentences;

    } catch (err) {
      console.error('[SentenceGenerator] Error:', err);
      const errorMessage = err.message || 'Failed to generate batch sentences';
      setError(errorMessage);
      setIsLoading(false);
      throw err;
    }
  }, []);

  return {
    generateSentence,
    generateBatchSentences,
    isLoading,
    error
  };
}
