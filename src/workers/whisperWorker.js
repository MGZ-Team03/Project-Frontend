import { pipeline, env } from '@xenova/transformers';

// Prefer browser cache for model files
env.useBrowserCache = true;
env.allowRemoteModels = true;
env.remoteHost = 'https://huggingface.co/';
// IMPORTANT: disable local model loading (Vite SPA fallback can return index.html -> JSON parse error)
env.allowLocalModels = false;
// Ensure onnxruntime-web WASM files can be resolved in Vite/Worker env
// (This project uses onnxruntime-web@1.14.0 via @xenova/transformers)
env.backends.onnx.wasm.wasmPaths = 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.14.0/dist/';
// Avoid SharedArrayBuffer/COOP issues by keeping single-threaded by default
env.backends.onnx.wasm.numThreads = 1;

let asr = null;
let loadingPromise = null;
let currentModelId = null;
let activeRequestId = null;
let lastProgressSentAt = 0;

function postProgress(payload) {
  // throttle to avoid flooding main thread
  const now = Date.now();
  if (now - lastProgressSentAt < 200) return;
  lastProgressSentAt = now;
  self.postMessage({ id: activeRequestId, type: 'progress', ...payload });
}

async function loadModel({ modelId = 'Xenova/whisper-base.en' } = {}) {
  if (asr && currentModelId === modelId) return asr;

  // model changed or we want to retry fresh
  if (currentModelId && currentModelId !== modelId) {
    asr = null;
    loadingPromise = null;
  }

  if (!loadingPromise) {
    currentModelId = modelId;
    loadingPromise = (async () => {
      // Try quantized first to reduce memory; fallback to default if not available
      try {
        postProgress({ stage: 'init', modelId, message: '모델 준비 중...' });
        const p = await pipeline('automatic-speech-recognition', modelId, {
          quantized: true,
          progress_callback: (info) => {
            // info shape varies by version; keep it defensive
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
          },
        });
        asr = p;
        return asr;
      } catch (e) {
        postProgress({ stage: 'init', modelId, message: '모델 준비 중...' });
        const p = await pipeline('automatic-speech-recognition', modelId, {
          progress_callback: (info) => {
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
          },
        });
        asr = p;
        return asr;
      }
    })();
  }
  return loadingPromise;
}

self.onmessage = async (event) => {
  const msg = event.data || {};
  const { id, type } = msg;

  try {
    if (type === 'init') {
      activeRequestId = id;
      await loadModel({ modelId: msg.modelId });
      self.postMessage({ id, type: 'ready' });
      return;
    }

    if (type === 'transcribe') {
      activeRequestId = id;
      const model = await loadModel({ modelId: msg.modelId });

      // audio: Float32Array (mono), sampleRate: number
      const { audio, sampleRate } = msg;
      if (!audio || !sampleRate) {
        throw new Error('Invalid transcribe payload');
      }

      // transformers.js ASR pipeline expects the *audio array itself* (Float32Array/Float64Array),
      // and sampling rate should be passed via options.
      const audioArray =
        audio instanceof Float32Array || audio instanceof Float64Array ? audio : new Float32Array(audio);

      const result = await model(audioArray, {
        sampling_rate: sampleRate,
        language: 'english',
        task: 'transcribe',
      });

      const text = (result?.text || '').trim();
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

