/**
 * PostRecordingPipeline
 * - 녹음 종료 후 무거운 작업(STT/VAD trim/업로드)을 "항상 1개씩" 직렬 실행
 * - key 단위로 latest-only 토큰을 관리해서, 새 녹음이 오면 이전 작업 결과를 무시
 */
const tokenByKey = new Map(); // key -> number
const stateByKey = new Map(); // key -> { running: boolean, queue: Array<...> }
const DEFAULT_TASK_TIMEOUT_MS = 300_000; // 5분: 큐 전체가 멈추는 현상 방지

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

function getState(key) {
  const existing = stateByKey.get(key);
  if (existing) return existing;
  const init = { running: false, queue: [] };
  stateByKey.set(key, init);
  return init;
}

function withTimeout(promise, timeoutMs, label) {
  const ms = Math.max(0, Number(timeoutMs) || 0) || DEFAULT_TASK_TIMEOUT_MS;
  let timeoutId = null;
  const timeoutPromise = new Promise((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(`timeout:${label || 'task'}:${ms}ms`)), ms);
  });
  return Promise.race([promise, timeoutPromise]).finally(() => {
    if (timeoutId) clearTimeout(timeoutId);
  });
}

/**
 * @param {string} key - pipeline group key (e.g. 'practice', 'chat')
 * @param {(ctx:{key:string, token:number, isCurrent:()=>boolean})=>Promise<any>} taskFn
 * @param {{label?:string, timeoutMs?:number}} [opts]
 */
export function enqueue(key, taskFn, opts = {}) {
  const token = currentToken(key);
  const label = opts?.label || key;
  const timeoutMs = opts?.timeoutMs;
  const state = getState(key);

  const completion = new Promise((resolve) => {
    state.queue.push({ token, taskFn, label, timeoutMs, resolve });
  });

  if (state.running) return completion;

  state.running = true;
  (async () => {
    while (state.queue.length > 0) {
      const item = state.queue.shift();
      if (!item) continue;
      const isCurrent = () => currentToken(key) === item.token;
      if (!isCurrent()) {
        item.resolve();
        continue;
      }
      try {
        await withTimeout(
          Promise.resolve(item.taskFn({ key, token: item.token, isCurrent })),
          item.timeoutMs,
          item.label
        );
      } catch (e) {
        // keep the pipeline alive even if one task fails/hangs
        // eslint-disable-next-line no-console
        console.warn(`[PostRecordingPipeline] ${item.label} failed:`, e);
      } finally {
        item.resolve();
      }
    }
    state.running = false;
  })().catch(() => {
    state.running = false;
  });

  return completion;
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

