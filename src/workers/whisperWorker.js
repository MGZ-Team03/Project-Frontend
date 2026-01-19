import { pipeline, env } from '@xenova/transformers';

// Prefer browser cache for model files
env.useBrowserCache = true;
env.allowRemoteModels = true;
env.remoteHost = 'https://huggingface.co/';
// IMPORTANT: disable local model loading (Vite SPA fallback can return index.html -> JSON parse error)
env.allowLocalModels = false;
// Ensure onnxruntime-web WASM files can be resolved in Vite/Worker env
// (This project uses onnxruntime-web via @xenova/transformers)
env.backends.onnx.wasm.wasmPaths = 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.14.0/dist/';
// Avoid SharedArrayBuffer/COOP issues by keeping single-threaded by default
env.backends.onnx.wasm.numThreads = 1;

// Cache pipelines per (modelId, quantized). Keep this SMALL to avoid memory blow-ups in browser.
// We intentionally evict old pipelines when loading a new one.
const asrCache = new Map(); // key -> pipeline
const loadingCache = new Map(); // key -> Promise<pipeline>
let currentModelId = null;
let activeRequestId = null;
let lastProgressSentAt = 0;
let currentBackend = 'wasm'; // 'wasm' | 'webgpu'

function postProgress(payload) {
  // throttle to avoid flooding main thread
  const now = Date.now();
  if (now - lastProgressSentAt < 200) return;
  lastProgressSentAt = now;
  self.postMessage({ id: activeRequestId, type: 'progress', ...payload });
}

function modelKey(modelId, quantized, backend) {
  return `${backend || 'wasm'}::${modelId}::${quantized ? 'q' : 'f'}`;
}

function evictAllExcept(keepKey) {
  for (const k of asrCache.keys()) {
    if (k !== keepKey) asrCache.delete(k);
  }
  for (const k of loadingCache.keys()) {
    if (k !== keepKey) loadingCache.delete(k);
  }
}

function configureBackend(backend) {
  const b = backend === 'webgpu' ? 'webgpu' : 'wasm';
  currentBackend = b;

  // Best-effort: transformers.js / xenova backend selection differs by version.
  // We try to steer ONNX Runtime to WebGPU when requested, otherwise default to WASM.
  try {
    env.backends.onnx.backend = b; // some versions honor this
  } catch (_) {
    // ignore
  }
  try {
    env.backends.onnx.preferredBackend = b; // some versions honor this
  } catch (_) {
    // ignore
  }
}

function progressCallbackFactory(modelId) {
  return (info) => {
    const percent =
      typeof info?.progress === 'number'
        ? Math.round(info.progress)
        : typeof info?.loaded === 'number' && typeof info?.total === 'number' && info.total > 0
          ? Math.round((info.loaded / info.total) * 100)
          : null;
    postProgress({
      stage: info?.status || 'download',
      modelId,
      file: info?.file || null,
      percent,
    });
  };
}

async function loadModel({ modelId = 'Xenova/whisper-base.en', quantized = true, backend = 'wasm' } = {}) {
  configureBackend(backend);
  const key = modelKey(modelId, quantized, currentBackend);
  if (asrCache.has(key)) return asrCache.get(key);
  if (loadingCache.has(key)) return loadingCache.get(key);

  currentModelId = modelId;
  postProgress({ stage: 'init', modelId, message: `모델 준비 중... (${currentBackend})` });

  const p = (async () => {
    // Prevent multiple pipelines from piling up in memory.
    evictAllExcept(key);
    const asr = await pipeline('automatic-speech-recognition', modelId, {
      quantized,
      progress_callback: progressCallbackFactory(modelId),
    });
    asrCache.set(key, asr);
    loadingCache.delete(key);
    return asr;
  })().catch((e) => {
    loadingCache.delete(key);
    throw e;
  });

  loadingCache.set(key, p);
  return p;
}

function extractText(result) {
  if (!result) return '';
  if (typeof result === 'string') return result.trim();
  if (typeof result?.text === 'string') return result.text.trim();
  // Some variants return { chunks: [{ text }] } or array-like structures
  const chunks = result?.chunks || result?.segments || result?.items;
  if (Array.isArray(chunks)) {
    const joined = chunks
      .map((c) => (typeof c === 'string' ? c : c?.text))
      .filter((t) => typeof t === 'string' && t.trim().length > 0)
      .join(' ')
      .trim();
    if (joined) return joined;
  }
  return '';
}

self.onmessage = async (event) => {
  const msg = event.data || {};
  const { id, type } = msg;

  try {
    if (type === 'init') {
      activeRequestId = id;
      const backend = msg?.backend === 'webgpu' ? 'webgpu' : 'wasm';
      // IMPORTANT: do NOT preload multiple pipelines (memory blow-up in browser).
      // Load quantized first; we'll lazily try full only if needed at transcribe time.
      try {
        await loadModel({ modelId: msg.modelId, quantized: true, backend });
      } catch (e) {
        await loadModel({ modelId: msg.modelId, quantized: false, backend });
      }
      self.postMessage({ id, type: 'ready' });
      return;
    }

    if (type === 'transcribe') {
      activeRequestId = id;

      // audio: Float32Array (mono), sampleRate: number
      const { audio, sampleRate } = msg;
      if (!audio || !sampleRate) {
        throw new Error('Invalid transcribe payload');
      }
      const backend = msg?.backend === 'webgpu' ? 'webgpu' : 'wasm';

      // transformers.js ASR pipeline expects the *audio array itself* (Float32Array/Float64Array),
      // and sampling rate should be passed via options.
      const audioArray =
        audio instanceof Float32Array || audio instanceof Float64Array ? audio : new Float32Array(audio);

      const prompt =
        typeof msg?.prompt === 'string' && msg.prompt.trim().length > 0 ? msg.prompt.trim() : null;

      // B안: prompt 힌트만 추가(후처리/재시도 없음)
      const baseOptions = {
        sampling_rate: sampleRate,
        task: 'transcribe',
        language: 'en',
        ...(prompt ? { prompt, initial_prompt: prompt } : {}),
      };

      const useVad = msg?.vad !== false; // default true

      // Whisper 디코딩 기반 VAD/필터 옵션 (지원되는 경우에만 의미 있음)
      const tunedOptions = {
        ...baseOptions,
        // existing tuning (kept): decoding/chunking만 적용, 실행은 1회
        num_beams: 3,
        temperature: 0.0,
        chunk_length_s: 20,
        stride_length_s: 5,
        ...(useVad
          ? {
              no_speech_threshold: 0.4,
              compression_ratio_threshold: 2.4,
              logprob_threshold: -1.0,
            }
          : {}),
      };

      const model = await loadModel({ modelId: msg.modelId, quantized: true, backend });
      const result = await model(audioArray, tunedOptions);
      const text = extractText(result);

      // 결과 로그 추가
      console.log('[Whisper Worker] 추론 완료:', {
        textLength: text.length,
        text: text.substring(0, 100) + (text.length > 100 ? '...' : ''),
        resultType: typeof result,
        hasChunks: Array.isArray(result?.chunks),
      });

      if (!text || text.trim().length === 0) {
        console.warn('[Whisper Worker] ⚠️ 빈 결과 반환됨. 원본 result:', result);
      }

      self.postMessage({ id, type: 'result', text });
      return;
    }

    throw new Error(`Unknown worker message type: ${type}`);
  } catch (err) {
    self.postMessage({
      id,
      type: 'error',
      message: `${err?.message || String(err)}${err?.stack ? `\n${err.stack}` : ''}`,
    });
  }
};

