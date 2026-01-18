import { useCallback, useEffect, useRef, useState } from 'react';

// 브라우저에서 medium 계열이 OrtRun(6)로 터지는 경우가 있어, 기본은 안정적인 영어 전용 base.en을 사용한다.
// 그래도 OrtRun(6)이면 tiny.en으로 1회 폴백해서 "결과는 나오게" 한다.
// 필요 시 .env에 VITE_WHISPER_MODEL_ID로 오버라이드 가능
const DEFAULT_MODEL_ID = import.meta.env.VITE_WHISPER_MODEL_ID || 'Xenova/whisper-base.en';
const FALLBACK_MODEL_ID = 'Xenova/whisper-tiny.en';

let sharedWorker = null;
let sharedWorkerReady = false;
let sharedWorkerModelId = null;
let sharedWorkerInitPromise = null;
let sharedWorkerLastError = null;
let msgIdSeq = 1;

function getWorker() {
  if (sharedWorker) return sharedWorker;
  sharedWorker = new Worker(new URL('../workers/whisperWorker.js', import.meta.url), {
    type: 'module',
  });
  return sharedWorker;
}

function resampleTo16k(input, inputSampleRate) {
  const targetSampleRate = 16000;
  if (inputSampleRate === targetSampleRate) return input;

  const ratio = inputSampleRate / targetSampleRate;
  const newLength = Math.round(input.length / ratio);
  const output = new Float32Array(newLength);

  for (let i = 0; i < newLength; i++) {
    const srcIndex = i * ratio;
    const i0 = Math.floor(srcIndex);
    const i1 = Math.min(i0 + 1, input.length - 1);
    const t = srcIndex - i0;
    output[i] = input[i0] * (1 - t) + input[i1] * t;
  }
  return output;
}

async function decodeBlobToFloat32(blob) {
  const arrayBuffer = await blob.arrayBuffer();
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  const ctx = new AudioCtx();
  try {
    const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
    // mono mixdown (use first channel for now)
    const channel = audioBuffer.getChannelData(0);
    const mono = new Float32Array(channel); // copy
    const resampled = resampleTo16k(mono, audioBuffer.sampleRate);
    return { audio: resampled, sampleRate: 16000 };
  } finally {
    await ctx.close();
  }
}

export function useWhisperSTT() {
  const [status, setStatus] = useState(sharedWorkerReady ? 'ready' : 'idle'); // idle|loading|ready|error
  const [error, setError] = useState(null);
  const [progress, setProgress] = useState(null); // { stage, percent, file, modelId, message }
  const pendingRef = useRef(new Map()); // id -> {resolve,reject}
  const modelIdRef = useRef(DEFAULT_MODEL_ID);

  useEffect(() => {
    const worker = getWorker();
    const onMessage = (event) => {
      const msg = event.data || {};
      const handler = pendingRef.current.get(msg.id);
      if (!handler) return;

      if (msg.type === 'ready') {
        pendingRef.current.delete(msg.id);
        setProgress(null);
        handler.resolve(true);
        return;
      }
      if (msg.type === 'result') {
        pendingRef.current.delete(msg.id);
        setProgress(null);
        handler.resolve(msg.text || '');
        return;
      }
      if (msg.type === 'progress') {
        // progress messages may come frequently; store latest
        setProgress({
          stage: msg.stage || null,
          percent: typeof msg.percent === 'number' ? msg.percent : null,
          file: msg.file || null,
          modelId: msg.modelId || null,
          message: msg.message || null,
        });
        return;
      }
      if (msg.type === 'error') {
        pendingRef.current.delete(msg.id);
        const message = msg.message || 'Whisper worker error';
        sharedWorkerLastError = message;
        setProgress(null);
        handler.reject(new Error(message));
      }
    };

    worker.addEventListener('message', onMessage);
    return () => worker.removeEventListener('message', onMessage);
  }, []);

  const preload = useCallback(async (targetModelId = modelIdRef.current) => {
    // already ready for this exact model
    if (sharedWorkerReady && sharedWorkerModelId === targetModelId) return true;
    if (sharedWorkerInitPromise) return sharedWorkerInitPromise;

    setStatus('loading');
    setError(null);
    setProgress({ stage: 'init', percent: null, file: null, modelId: targetModelId, message: '모델 준비 중...' });
    sharedWorkerLastError = null;

    const worker = getWorker();
    const id = msgIdSeq++;

    sharedWorkerInitPromise = new Promise((resolve, reject) => {
      pendingRef.current.set(id, { resolve, reject });
      worker.postMessage({ id, type: 'init', modelId: targetModelId });
    })
      .then(() => {
        sharedWorkerReady = true;
        sharedWorkerModelId = targetModelId;
        modelIdRef.current = targetModelId;
        sharedWorkerLastError = null;
        setStatus('ready');
        setProgress(null);
        return true;
      })
      .catch((e) => {
        setStatus('error');
        const msg = e?.message || String(e);
        sharedWorkerLastError = msg;
        setError(msg);
        setProgress(null);
        sharedWorkerInitPromise = null;
        return false;
      });

    return sharedWorkerInitPromise;
  }, []);

  const transcribe = useCallback(async (blob) => {
    setError(null);

    const runOnce = async (targetModelId) => {
      const ok = await preload(targetModelId);
      if (!ok) {
        throw new Error(sharedWorkerLastError || 'STT 모델 로드 실패 (모델/wasm 다운로드 실패 가능)');
      }

      setStatus('loading');
      const { audio, sampleRate } = await decodeBlobToFloat32(blob);

      const worker = getWorker();
      const id = msgIdSeq++;

      const text = await new Promise((resolve, reject) => {
        pendingRef.current.set(id, { resolve, reject });
        // Transfer audio buffer for performance
        worker.postMessage(
          { id, type: 'transcribe', modelId: targetModelId, audio, sampleRate },
          [audio.buffer]
        );
      });

      setStatus('ready');
      return text;
    };

    try {
      return await runOnce(modelIdRef.current);
    } catch (e) {
      const msg = e?.message || String(e);
      // OrtRun error code=6 is commonly OOM/invalid run in browser for larger models
      const isOrtRun6 = /OrtRun\(\)\. error code\s*=\s*6/i.test(msg) || /error code\s*=\s*6/i.test(msg);
      const isUsingMedium =
        (modelIdRef.current || '').includes('whisper-medium');

      if (isOrtRun6 && isUsingMedium) {
        console.warn('[WhisperSTT] OrtRun(6) -> fallback to', FALLBACK_MODEL_ID);
        try {
          const text = await runOnce(FALLBACK_MODEL_ID);
          return text;
        } catch (e2) {
          throw e2;
        }
      }
      throw e;
    }
  }, [preload]);

  return { preload, transcribe, status, error, progress };
}

