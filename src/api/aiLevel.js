import api from './axios';

/**
 * 학생 AI 학습 레벨 조회
 * GET /api/ai/level
 * @returns {Promise<{success: boolean, level: string}>}
 */
export async function getAiLevel() {
  const res = await api.get('/api/ai/level');

  const payload = res?.data;
  const success = payload?.success === true;
  const rawLevel = payload?.data?.level;
  const level = typeof rawLevel === 'string' ? rawLevel.trim() : '';

  return { success, level };
}

