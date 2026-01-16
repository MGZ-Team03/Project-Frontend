import axios from './axios';

/**
 * STT 임시 자격 증명 요청
 * POST /api/stt/credentials
 * @param {Object} options - 옵션
 * @param {string} options.languageCode - 언어 코드 (기본값: 'en-US')
 * @param {number} options.sampleRate - 샘플레이트 (기본값: 16000)
 * @returns {Promise<{credentials: Object, config: Object}>}
 */
export async function getSTTCredentials({ languageCode = 'en-US', sampleRate = 16000 } = {}) {
  const res = await axios.post('/api/stt/credentials', {
    languageCode,
    sampleRate,
  });
  return res.data;
}

/**
 * 발음 평가 요청
 * POST /api/stt/evaluate
 * @param {Object} params
 * @param {string} params.originalText - 원본 텍스트
 * @param {string} params.transcribedText - STT로 인식된 텍스트
 * @param {string} [params.sentenceId] - 문장 ID (선택)
 * @param {string} [params.sessionId] - 세션 ID (선택)
 * @param {number} [params.audioDurationMs] - 오디오 길이 (선택)
 * @returns {Promise<{success: boolean, evaluation: Object}>}
 */
export async function evaluatePronunciation({
  originalText,
  transcribedText,
  sentenceId,
  sessionId,
  audioDurationMs,
}) {
  const res = await axios.post('/api/stt/evaluate', {
    originalText,
    transcribedText,
    sentenceId,
    sessionId,
    audioDurationMs,
  });
  return res.data;
}
