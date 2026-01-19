import axios from './axios';
import { pollWithBackoff } from '../utils/polling';

/**
 * TTS 상태 확인 (폴링용)
 * @param {string} jobId - TTS 작업 ID
 * @returns {Promise<{status: string, audioUrl?: string, error?: string}>}
 */
async function checkTTSStatus(jobId) {
  const res = await axios.get(`/api/tts/status/${jobId}`);
  return res.data;
}

/**
 * 서버 TTS 생성 (Polly) 요청 - SQS 비동기 처리 지원
 * @param {Object} params
 * @param {string} params.text
 * @param {string=} params.voiceId
 * @param {Object=} params.pollingOptions - 폴링 옵션 (선택)
 * @returns {Promise<{success:boolean,audioUrl:string,expiresIn?:number,cached?:boolean}>}
 */
export async function requestTTS({ text, voiceId, pollingOptions = {} }) {
  const payload = { text };
  if (voiceId) payload.voiceId = voiceId;

  const res = await axios.post('/api/tts', payload);

  // 캐시 히트 (200) - 즉시 반환
  if (res.status === 200) {
    return res.data;
  }

  // 캐시 미스 (202) - 비동기 처리 중, 폴링 필요
  if (res.status === 202) {
    const { jobId } = res.data;

    // 폴링으로 TTS 완료 대기
    const result = await pollWithBackoff(checkTTSStatus, jobId, {
      maxAttempts: 30,
      initialInterval: 1000,
      maxInterval: 3000,
      ...pollingOptions,
    });

    return {
      success: true,
      audioUrl: result.audioUrl,
      expiresIn: result.expiresIn,
      cached: false,
    };
  }

  // 기타 응답은 그대로 반환
  return res.data;
}

