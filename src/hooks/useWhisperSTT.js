import { useCallback, useEffect, useRef, useState } from 'react';
import { useDispatch } from 'react-redux';
import {
  setWhisperStatus,
  setWhisperProgress,
  setWhisperError,
} from '../store/slices/whisperPreloadSlice';
import { enqueueDecode } from '../utils/postRecordingPipeline';

// Whisper 모델: 기본은 small, 메모리 이슈 등 발생 시 base로 폴백
// 필요 시 .env에 VITE_WHISPER_MODEL_ID로 오버라이드 가능
const DEFAULT_MODEL_ID = import.meta.env.VITE_WHISPER_MODEL_ID || 'Xenova/whisper-small.en';
const FALLBACK_MODEL_ID = 'Xenova/whisper-base.en';

let sharedWorker = null;
let sharedWorkerReady = false;
let sharedWorkerModelId = null;
let sharedWorkerBackend = null;
let sharedWorkerInitPromise = null;
let sharedWorkerLastError = null;
let msgIdSeq = 1;

// Safari에서 반복 decodeAudioData 시 메모리 회수 이슈 완화:
// - old_ui 방식 복원: 매번 독립 AudioContext 생성 + 즉시 close()
// - 동시 decode는 postRecordingPipeline의 큐로 직렬화하여 피크를 낮춤

function getWorker() {
  if (sharedWorker) return sharedWorker;
  sharedWorker = new Worker(new URL('../workers/whisperWorker.js', import.meta.url), {
    type: 'module',
  });
  return sharedWorker;
}

function resetWorker(reason = 'reset') {
  try {
    sharedWorker?.terminate?.();
  } catch (_) {}
  sharedWorker = null;
  sharedWorkerReady = false;
  sharedWorkerModelId = null;
  sharedWorkerBackend = null;
  sharedWorkerInitPromise = null;
  sharedWorkerLastError = `worker reset: ${reason}`;
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

function removeDcOffset(input) {
  if (!input?.length) return input;
  let sum = 0;
  for (let i = 0; i < input.length; i++) sum += input[i];
  const mean = sum / input.length;
  if (!Number.isFinite(mean) || Math.abs(mean) < 1e-6) return input;
  const out = new Float32Array(input.length);
  for (let i = 0; i < input.length; i++) out[i] = input[i] - mean;
  return out;
}

function normalizePeak(input, targetPeak = 0.9) {
  if (!input?.length) return input;
  let peak = 0;
  for (let i = 0; i < input.length; i++) {
    const a = Math.abs(input[i]);
    if (a > peak) peak = a;
  }
  // Don't amplify near-silence/noise too aggressively
  if (!Number.isFinite(peak) || peak <= 0) return input;
  if (peak >= targetPeak) return input;
  const gain = Math.min(targetPeak / peak, 10); // cap amplification
  if (gain <= 1.05) return input; // avoid tiny changes
  const out = new Float32Array(input.length);
  for (let i = 0; i < input.length; i++) out[i] = input[i] * gain;
  return out;
}

function computeRmsPeak(input, start = 0, end = input?.length || 0) {
  if (!input?.length) return { rms: 0, peak: 0 };
  const s = Math.max(0, start | 0);
  const e = Math.max(s, Math.min(input.length, end | 0));
  if (e <= s) return { rms: 0, peak: 0 };

  let sumSq = 0;
  let peak = 0;
  const n = e - s;
  for (let i = s; i < e; i++) {
    const v = input[i];
    sumSq += v * v;
    const av = Math.abs(v);
    if (av > peak) peak = av;
  }
  return { rms: Math.sqrt(sumSq / n), peak };
}

function clamp(x, min, max) {
  return Math.max(min, Math.min(max, x));
}

function autoTrimThresholdByNoiseFloor(input, sampleRate) {
  // Estimate noise floor from head/tail windows and set threshold relative to it.
  // Goal: in quiet rooms, keep threshold low to avoid chopping consonants;
  // in noisy rooms, raise threshold to trim more background noise.
  const sr = sampleRate || 16000;
  const win = Math.min(input.length, Math.floor(0.25 * sr)); // 250ms
  if (win <= 0) return 0.015;

  const head = computeRmsPeak(input, 0, win);
  const tail = computeRmsPeak(input, Math.max(0, input.length - win), input.length);
  const noiseRms = Math.max(head.rms, tail.rms);

  // Heuristic: threshold = noiseRms * 5, clamped (완화됨).
  // - Lower clamp prevents "no trimming at all" in quiet rooms (still trims true silence).
  // - Upper clamp prevents over-trimming in noisy rooms.
  // 수정: noiseRms * 3 → noiseRms * 5 (더 보수적), 범위 0.002~0.015로 조정
  return clamp(noiseRms * 5, 0.002, 0.015);
}

function trimSilence(input, sampleRate, threshold = 0.015, paddingSec = 0.08) {
  if (!input?.length) return input;
  const len = input.length;
  let start = 0;
  let end = len - 1;

  while (start < len && Math.abs(input[start]) < threshold) start++;
  while (end > start && Math.abs(input[end]) < threshold) end--;

  // If everything is below threshold, keep original (let caller decide "too quiet")
  if (start >= end) return input;

  const pad = Math.max(0, Math.floor((paddingSec || 0) * (sampleRate || 16000)));
  start = Math.max(0, start - pad);
  end = Math.min(len - 1, end + pad);

  // avoid returning extremely short clips
  // 수정: 0.25초 → 0.5초 (더 긴 최소 길이)
  const minLen = Math.floor(0.5 * (sampleRate || 16000));
  if (end - start + 1 < minLen) return input;

  return input.slice(start, end + 1);
}

async function decodeBlobToFloat32(
  blob,
  { trimThreshold = 'auto', trimPaddingSec = 0.08 } = {}
) {
  let arrayBuffer = await blob.arrayBuffer();

  // old_ui 방식: 매번 새 AudioContext 생성 + 즉시 close()
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  const ctx = new AudioCtx();

  const decodeOnce = async () => {
    const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
    arrayBuffer = null; // 메모리 해제: arrayBuffer 더 이상 불필요
    return audioBuffer;
  };

  try {
    let audioBuffer = await enqueueDecode(decodeOnce);
    // mono mixdown (average all channels) — 일부 장치에서 ch0이 거의 무음인 케이스 방지
    const channels = Math.max(1, audioBuffer.numberOfChannels || 1);
    const length = audioBuffer.length || 0;
    const sampleRate = audioBuffer.sampleRate;

    let mono = new Float32Array(length);
    for (let ch = 0; ch < channels; ch++) {
      const data = audioBuffer.getChannelData(ch);
      for (let i = 0; i < length; i++) mono[i] += data[i];
    }
    for (let i = 0; i < length; i++) mono[i] /= channels;

    // 메모리 해제 #0: audioBuffer 더 이상 불필요 (가장 큰 메모리 사용)
    audioBuffer = null;

    let processed = removeDcOffset(mono);
    mono = null; // 메모리 해제 #1: mono 버퍼 더 이상 불필요

    // replay용: 녹음 타임라인과 정렬된 16k PCM(무트림)
    const replay16k = resampleTo16k(processed, sampleRate);
    processed = null; // 메모리 해제 #2: 첫 번째 processed 버퍼 해제

    // Decide trim threshold BEFORE normalization, so it tracks actual recording level/noise floor.
    const threshold =
      typeof trimThreshold === 'number'
        ? trimThreshold
        : autoTrimThresholdByNoiseFloor(replay16k, 16000);

    let normalized = normalizePeak(replay16k, 0.9);

    const final = trimSilence(normalized, 16000, threshold, trimPaddingSec);
    normalized = null; // 메모리 해제 #3: normalized 버퍼 해제

    return { audio: final, sampleRate: 16000, replayPcm: replay16k, replaySampleRate: 16000 };
  } finally {
    // ✅ old_ui 패턴: audioBuffer 사용 완료 후 close (메모리 누적 방지)
    try {
      await ctx.close();
    } catch (_) {}
  }
}

export function useWhisperSTT() {
  const [status, setStatus] = useState(sharedWorkerReady ? 'ready' : 'idle'); // idle|loading|ready|error
  const [error, setError] = useState(null);
  const [progress, setProgress] = useState(null); // { stage, percent, file, modelId, message }
  const pendingRef = useRef(new Map()); // id -> {resolve,reject}
  const modelIdRef = useRef(DEFAULT_MODEL_ID);
  const backendRef = useRef('webgpu'); // 'wasm' | 'webgpu' (기본: webgpu)

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

  const preload = useCallback(async (targetModelId = modelIdRef.current, backend = backendRef.current) => {
    const targetBackend = backend === 'webgpu' ? 'webgpu' : 'wasm';
    // already ready for this exact (model, backend)
    if (sharedWorkerReady && sharedWorkerModelId === targetModelId && sharedWorkerBackend === targetBackend) return true;
    if (sharedWorkerInitPromise) return sharedWorkerInitPromise;

    setStatus('loading');
    setError(null);
    setProgress({ stage: 'init', percent: null, file: null, modelId: targetModelId, message: `모델 준비 중... (${targetBackend})` });
    sharedWorkerLastError = null;

    const worker = getWorker();
    const id = msgIdSeq++;

    sharedWorkerInitPromise = new Promise((resolve, reject) => {
      pendingRef.current.set(id, { resolve, reject });
      worker.postMessage({ id, type: 'init', modelId: targetModelId, backend: targetBackend });
    })
      .then(() => {
        sharedWorkerReady = true;
        sharedWorkerModelId = targetModelId;
        sharedWorkerBackend = targetBackend;
        modelIdRef.current = targetModelId;
        backendRef.current = targetBackend;
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

  function isLikelyMemoryError(message) {
    const msg = String(message || '');
    return (
      /out of memory/i.test(msg) ||
      /\boom\b/i.test(msg) ||
      /OrtRun\(\)\. error code\s*=\s*6/i.test(msg) ||
      /error code\s*=\s*6/i.test(msg)
    );
  }

  // trimThreshold 기본값: 0.003, trimPaddingSec: 0.1
  const transcribe = useCallback(async (
    blob,
    {
      prompt,
      trimThreshold = 0.003,
      trimPaddingSec = 0.1,
      backend = 'webgpu', // 'wasm' | 'webgpu' (기본: webgpu)
      vad = true,
    } = {}
  ) => {
    setError(null);

    const runOnce = async (targetModelId, targetBackend, promptOverride) => {
      const ok = await preload(targetModelId, targetBackend);
      if (!ok) {
        throw new Error(sharedWorkerLastError || 'STT 모델 로드 실패 (모델/wasm 다운로드 실패 가능)');
      }

      setStatus('loading');
      const { audio, sampleRate, replayPcm, replaySampleRate } = await decodeBlobToFloat32(blob, { trimThreshold, trimPaddingSec });

      // 전처리 로그 추가
      const vadDuration = (audio.length/16000).toFixed(2);
      console.log(`[STT] 전처리 완료: samples=${audio.length}, VAD 시간=${vadDuration}s`);
      if (audio.length < 8000) {  // 0.5초 미만
        console.warn(`[STT] ⚠️ 경고: 오디오가 매우 짧음 (VAD 시간: ${vadDuration}s) - 빈 결과 가능성 높음`);
      }

      const worker = getWorker();
      const id = msgIdSeq++;

      // Transfer 전에 VAD duration 계산 (transfer 후에는 audio.length가 0이 됨)
      const vadDurationMs = Math.round((audio.length / 16000) * 1000);

      const text = await new Promise((resolve, reject) => {
        pendingRef.current.set(id, { resolve, reject });
        // Transfer audio buffer for performance
        const effectivePrompt =
          typeof promptOverride === 'string'
            ? promptOverride
            : typeof prompt === 'string'
              ? prompt
              : null;
        worker.postMessage(
          { id, type: 'transcribe', modelId: targetModelId, audio, sampleRate, prompt: effectivePrompt, backend: targetBackend, vad },
          [audio.buffer]
        );
      });

      setStatus('ready');
      return {
        text,
        vadDurationMs,
        replayPcm,
        replaySampleRate,
      };
    };

    function isSuspiciousText(text, vadDurationMs) {
      const t = String(text || '').trim();
      if (!t) return true;
      const lower = t.toLowerCase();
      if (lower === 'you') return true;
      // 오디오가 충분히 긴데 결과가 비정상적으로 짧으면 의심
      if (t.length <= 3 && (vadDurationMs || 0) >= 2000) return true;
      return false;
    }

    const desiredBackend = backend === 'webgpu' ? 'webgpu' : 'wasm';
    const primaryModelId = modelIdRef.current;

    // 1) desired backend + small
    try {
      const r1 = await runOnce(primaryModelId, desiredBackend, prompt);
      if (!isSuspiciousText(r1?.text, r1?.vadDurationMs)) return r1;

      // 1-1) suspicious -> retry once WITHOUT prompt (same backend)
      const r2 = await runOnce(primaryModelId, desiredBackend, null);
      if (!isSuspiciousText(r2?.text, r2?.vadDurationMs)) return r2;

      // 1-2) still suspicious -> reset worker and retry once WITHOUT prompt
      resetWorker('suspicious_text');
      const r3 = await runOnce(primaryModelId, desiredBackend, null);
      return r3;
    } catch (e1) {
      const msg1 = e1?.message || String(e1);

      // 2) webgpu -> wasm fallback (same model)
      if (desiredBackend === 'webgpu') {
        try {
          return await runOnce(primaryModelId, 'wasm', prompt);
        } catch (e2) {
          const msg2 = e2?.message || String(e2);
          // fall through to model fallback if memory-ish
          if (!isLikelyMemoryError(msg1) && !isLikelyMemoryError(msg2)) {
            throw e2;
          }
        }
      }

      // 3) memory-ish -> base fallback (smaller)
      if (isLikelyMemoryError(msg1) && primaryModelId !== FALLBACK_MODEL_ID) {
        try {
          return await runOnce(FALLBACK_MODEL_ID, desiredBackend, prompt);
        } catch (e3) {
          const msg3 = e3?.message || String(e3);
          if (desiredBackend === 'webgpu') {
            return await runOnce(FALLBACK_MODEL_ID, 'wasm', prompt);
          }
          throw new Error(msg3);
        }
      }

      throw e1;
    }
  }, [preload]);

  return { preload, transcribe, status, error, progress };
}

/**
 * 전역 Whisper 모델 preload 훅 (Redux 연동)
 * StudentLayout 등에서 사용하여 앱 전역에서 한 번만 로드
 */
export function useWhisperGlobalPreload() {
  const dispatch = useDispatch();

  const preloadGlobal = useCallback(async (backend = 'webgpu') => {
    const targetBackend = backend === 'webgpu' ? 'webgpu' : 'wasm';
    // 이미 준비되었으면 스킵
    if (sharedWorkerReady && sharedWorkerModelId === DEFAULT_MODEL_ID && sharedWorkerBackend === targetBackend) {
      dispatch(setWhisperStatus('ready'));
      return true;
    }

    // 이미 로딩 중이면 기다림
    if (sharedWorkerInitPromise) {
      return sharedWorkerInitPromise;
    }

    dispatch(setWhisperStatus('loading'));
    dispatch(setWhisperProgress({ stage: 'init', percent: null, modelId: DEFAULT_MODEL_ID, message: `모델 준비 중... (${targetBackend})` }));

    const worker = getWorker();
    const id = msgIdSeq++;

    // Redux로 진행 상태 전달하는 메시지 핸들러
    const handleMessage = (event) => {
      const msg = event.data || {};
      if (msg.id !== id) return;

      if (msg.type === 'progress') {
        dispatch(setWhisperProgress({
          stage: msg.stage || null,
          percent: typeof msg.percent === 'number' ? msg.percent : null,
          file: msg.file || null,
          modelId: msg.modelId || null,
          message: msg.message || null,
        }));
      } else if (msg.type === 'ready') {
        sharedWorkerReady = true;
        sharedWorkerModelId = DEFAULT_MODEL_ID;
        sharedWorkerBackend = targetBackend;
        dispatch(setWhisperStatus('ready'));
        dispatch(setWhisperProgress(null));
        worker.removeEventListener('message', handleMessage);
      } else if (msg.type === 'error') {
        const errorMsg = msg.message || 'Whisper worker error';
        sharedWorkerLastError = errorMsg;
        dispatch(setWhisperStatus('error'));
        dispatch(setWhisperError(errorMsg));
        dispatch(setWhisperProgress(null));
        worker.removeEventListener('message', handleMessage);
      }
    };

    worker.addEventListener('message', handleMessage);

    sharedWorkerInitPromise = new Promise((resolve, reject) => {
      const cleanup = () => {
        worker.removeEventListener('message', handleMessage);
        sharedWorkerInitPromise = null;
      };

      const timeoutId = setTimeout(() => {
        cleanup();
        const err = 'Whisper preload timeout';
        dispatch(setWhisperStatus('error'));
        dispatch(setWhisperError(err));
        reject(new Error(err));
      }, 300000); // 5분 타임아웃

      const wrappedHandler = (event) => {
        const msg = event.data || {};
        if (msg.id !== id) return;

        if (msg.type === 'ready') {
          clearTimeout(timeoutId);
          cleanup();
          resolve(true);
        } else if (msg.type === 'error') {
          clearTimeout(timeoutId);
          cleanup();
          reject(new Error(msg.message || 'Whisper worker error'));
        }
      };

      worker.addEventListener('message', wrappedHandler);
      worker.postMessage({ id, type: 'init', modelId: DEFAULT_MODEL_ID, backend: targetBackend });
    });

    return sharedWorkerInitPromise;
  }, [dispatch]);

  return { preloadGlobal };
}

