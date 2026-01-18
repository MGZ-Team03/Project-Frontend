import { useEffect, useRef, useState, useCallback } from 'react';
import { CONFIG } from '../../config/speakingConfig';

/**
 * 오디오 볼륨 감지 훅
 * Web Audio API를 사용하여 마이크 입력의 볼륨을 실시간 감지
 *
 * @param {boolean} isRecording - 녹음 중 여부
 * @returns {Object} { audioVolume, error }
 */
export function useAudioDetection(isRecording) {
  const [audioVolume, setAudioVolume] = useState(0);
  const [error, setError] = useState(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const streamRef = useRef(null);
  const animationIdRef = useRef(null);
  const isInitializingRef = useRef(false);
  const isRecordingRef = useRef(isRecording);
  const lastUpdateAtRef = useRef(0);

  // 최신 isRecording 유지 (detect loop가 stale closure를 갖지 않도록)
  useEffect(() => {
    isRecordingRef.current = isRecording;
  }, [isRecording]);

  const detectVolume = useCallback(() => {
    // 녹음 중이 아니면 루프를 유지하지 않음
    if (!isRecordingRef.current) {
      animationIdRef.current = null;
      return;
    }

    const analyser = analyserRef.current;
    const audioContext = audioContextRef.current;

    if (!analyser || !audioContext) {
      animationIdRef.current = requestAnimationFrame(detectVolume);
      return;
    }

    const now = Date.now();
    // 너무 잦은 리렌더 방지(raf -> 50ms 쓰로틀)
    if (now - lastUpdateAtRef.current >= CONFIG.TIMER_UPDATE_INTERVAL) {
      lastUpdateAtRef.current = now;

      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      analyser.getByteFrequencyData(dataArray);

      // 음성 주파수 대역(300Hz~3400Hz)만 분석하여 배경 소음 필터링
      const sampleRate = audioContext.sampleRate;
      const binSize = sampleRate / analyser.fftSize;
      const startBin = Math.floor(CONFIG.VOICE_FREQ_MIN / binSize);
      const endBin = Math.min(
        Math.floor(CONFIG.VOICE_FREQ_MAX / binSize),
        dataArray.length - 1
      );

      // 음성 대역의 평균 볼륨 계산
      let sum = 0;
      for (let i = startBin; i <= endBin; i++) {
        sum += dataArray[i];
      }
      const volume = sum / (endBin - startBin + 1);
      setAudioVolume(volume);
    }

    animationIdRef.current = requestAnimationFrame(detectVolume);
  }, []);

  // 녹음 시작할 때만 마이크를 켜고, 녹음 종료/언마운트 시 완전히 끔
  useEffect(() => {
    let cancelled = false;

    const cleanup = async () => {
      if (animationIdRef.current) {
        cancelAnimationFrame(animationIdRef.current);
        animationIdRef.current = null;
      }

      if (audioContextRef.current) {
        try {
          await audioContextRef.current.close();
        } catch (_) {
          // ignore
        }
        audioContextRef.current = null;
      }

      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }

      analyserRef.current = null;
      isInitializingRef.current = false;
      if (!cancelled) {
        setIsInitialized(false);
        setAudioVolume(0);
      }
    };

    const initialize = async () => {
      if (isInitializingRef.current || audioContextRef.current) return;
      isInitializingRef.current = true;
      setError(null);

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
        });

        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        streamRef.current = stream;

        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const analyser = audioContext.createAnalyser();
        const source = audioContext.createMediaStreamSource(stream);

        analyser.fftSize = 2048;
        analyser.smoothingTimeConstant = 0.3;
        source.connect(analyser);

        audioContextRef.current = audioContext;
        analyserRef.current = analyser;

        if (!cancelled) {
          console.log('[AudioDetection] Microphone initialized successfully');
          setIsInitialized(true);
        }
      } catch (err) {
        console.error('[AudioDetection] Initialization error:', err);
        if (!cancelled) setError(err.message);
        await cleanup();
      } finally {
        isInitializingRef.current = false;
      }
    };

    if (isRecording) {
      initialize().then(() => {
        if (cancelled) return;
        if (!analyserRef.current || !audioContextRef.current) return;
        if (animationIdRef.current) return;
        lastUpdateAtRef.current = 0;
        animationIdRef.current = requestAnimationFrame(detectVolume);
      });
    } else {
      cleanup();
    }

    return () => {
      cancelled = true;
      cleanup();
    };
  }, [isRecording, detectVolume]);

  return { audioVolume, error, isInitialized };
}
