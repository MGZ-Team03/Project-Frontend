import axios from './axios';

/**
 * 서버 TTS 생성 (Polly) 요청
 * @param {Object} params
 * @param {string} params.text
 * @param {string=} params.voiceId
 * @returns {Promise<{success:boolean,audioUrl:string,expiresIn?:number,cached?:boolean}>}
 */
export async function requestTTS({ text, voiceId }) {
  const payload = { text };
  if (voiceId) payload.voiceId = voiceId;
  const res = await axios.post('/api/tts', payload);
  return res.data;
}

