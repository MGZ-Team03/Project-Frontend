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

  // 마이크 초기화는 컴포넌트 마운트 시 한 번만 실행
  useEffect(() => {
    let isMounted = true;

    async function initialize() {
      // 이미 초기화 중이거나 완료된 경우 스킵
      if (isInitializingRef.current || audioContextRef.current) {
        return;
      }

      isInitializingRef.current = true;

      try {
        // 마이크 권한 요청 + WebRTC 잡음 제거
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,     // 에코 제거
            noiseSuppression: true,     // 잡음 제거 (배경 소음 감소)
            autoGainControl: true       // 자동 볼륨 조절
          }
        });

        if (!isMounted) {
          stream.getTracks().forEach(track => track.stop());
          isInitializingRef.current = false;
          audioContextRef.current = null;
          analyserRef.current = null;
          streamRef.current = null;
          return;
        }

        streamRef.current = stream;

        // AudioContext 생성
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const analyser = audioContext.createAnalyser();
        const source = audioContext.createMediaStreamSource(stream);

        // AnalyserNode 설정
        analyser.fftSize = 2048;
        analyser.smoothingTimeConstant = 0.3; // 부드러운 전환
        source.connect(analyser);

        audioContextRef.current = audioContext;
        analyserRef.current = analyser;

        console.log('[AudioDetection] Microphone initialized successfully');
        setIsInitialized(true);
        isInitializingRef.current = false;
      } catch (err) {
        console.error('[AudioDetection] Initialization error:', err);
        if (isMounted) {
          setError(err.message);
        }
        isInitializingRef.current = false;
      }
    }

    // 컴포넌트 마운트 시 초기화
    initialize();

    return () => {
      isMounted = false;

      // 애니메이션 중지
      if (animationIdRef.current) {
        cancelAnimationFrame(animationIdRef.current);
      }

      // AudioContext 종료
      if (audioContextRef.current) {
        audioContextRef.current.close();
        audioContextRef.current = null;
      }

      // 스트림 정리
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }

      // 초기화 플래그 리셋 (재마운트 시 다시 초기화 가능하도록)
      analyserRef.current = null;
      isInitializingRef.current = false;
    };
  }, []); // 빈 의존성 배열 - 마운트 시 한 번만 실행

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

  // 녹음 상태에 따라 감지 루프 시작/중지
  useEffect(() => {
    // 초기화가 아직이면 대기
    if (!isInitialized) return;

    if (!isRecording) {
      if (animationIdRef.current) {
        cancelAnimationFrame(animationIdRef.current);
        animationIdRef.current = null;
      }
      // 녹음 중지 시 볼륨도 리셋
      setAudioVolume(0);
      return;
    }

    // 이미 루프가 돌고 있으면 중복 시작 방지
    if (animationIdRef.current) return;

    lastUpdateAtRef.current = 0;
    animationIdRef.current = requestAnimationFrame(detectVolume);
  }, [isRecording, isInitialized, detectVolume]);

  return { audioVolume, error, isInitialized };
}
