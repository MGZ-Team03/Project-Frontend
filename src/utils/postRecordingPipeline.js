/**
 * PostRecordingPipeline
 * - 녹음 종료 후 무거운 작업(STT/VAD trim/업로드)을 "항상 1개씩" 직렬 실행
 * - key 단위로 latest-only 토큰을 관리해서, 새 녹음이 오면 이전 작업 결과를 무시
 */
let tail = Promise.resolve();
const tokenByKey = new Map(); // key -> number

function nextToken(key) {
  const prev = tokenByKey.get(key) || 0;
  const next = prev + 1;
  tokenByKey.set(key, next);
  return next;
}

function currentToken(key) {
  return tokenByKey.get(key) || 0;
}

export function cancelPrevious(key) {
  nextToken(key);
}

/**
 * @param {string} key - pipeline group key (e.g. 'practice', 'chat')
 * @param {(ctx:{key:string, token:number, isCurrent:()=>boolean})=>Promise<any>} taskFn
 * @param {{label?:string}} [opts]
 */
export function enqueue(key, taskFn, opts = {}) {
  const token = currentToken(key);
  const label = opts?.label || key;

  const run = async () => {
    const isCurrent = () => currentToken(key) === token;
    if (!isCurrent()) return;
    try {
      await taskFn({ key, token, isCurrent });
    } catch (e) {
      // keep the pipeline alive even if one task fails
      // eslint-disable-next-line no-console
      console.warn(`[PostRecordingPipeline] ${label} failed:`, e);
    }
  };

  tail = tail.then(run).catch(() => {});
  return tail;
}

/**
 * decodeAudioData를 직렬화(메모리 피크 완화)하기 위한 공용 큐.
 * - Safari에서 특히 유용
 */
let decodeQueue = Promise.resolve();

export function enqueueDecode(fn) {
  const next = decodeQueue.then(fn);
  decodeQueue = next.catch(() => {}).finally(() => Promise.resolve());
  return next;
}

/**
 * old_ui 방식: 매번 새 AudioContext 생성 + 즉시 close()
 * - 싱글톤 제거로 메모리 누적 방지
 */
export async function decodeAudioBlob(blob) {
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  const ctx = new AudioCtx();

  try {
    const arrayBuffer = await blob.arrayBuffer();
    const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
    return audioBuffer;
  } finally {
    try {
      await ctx.close();
    } catch (_) {}
  }
}

