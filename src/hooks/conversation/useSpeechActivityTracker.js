import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CONFIG } from '../../config/speakingConfig';
import { createSpeakingDetector } from '../../utils/conversation/speakingDetector';

function computeVoiceBandVolume(analyser, sampleRate) {
  const dataArray = new Uint8Array(analyser.frequencyBinCount);
  analyser.getByteFrequencyData(dataArray);

  const binSize = sampleRate / analyser.fftSize;
  const startBin = Math.floor(CONFIG.VOICE_FREQ_MIN / binSize);
  const endBin = Math.min(Math.floor(CONFIG.VOICE_FREQ_MAX / binSize), dataArray.length - 1);

  let sum = 0;
  for (let i = startBin; i <= endBin; i += 1) sum += dataArray[i];
  return sum / (endBin - startBin + 1); // 0~255 근사
}

/**
 * Whisper 녹음 스트림을 재사용해 “실제 발화”를 추적하는 훅
 * - voice onset(발화 시작 시점) 제공
 * - speakingMs 제공: Pace Ratio(문장 연습)용
 * - TTS 재생 중에는 게이팅하여 오탐 방지
 */
export function useSpeechActivityTracker({
  enabled,
  stream,
  landmarksRef,
  isTtsPlaying,
  onVoiceOnset,
  onTick,
  updateIntervalMs = CONFIG.TIMER_UPDATE_INTERVAL,
  mouthHoldMs = 700,  // 300ms → 700ms (긴 문장 자음 구간 포함)
}) {
  const [currentlySpeaking, setCurrentlySpeaking] = useState(false);
  const [uiSpeakingMs, setUiSpeakingMs] = useState(0);
  const [debugState, setDebugState] = useState(null);

  const speakingMsRef = useRef(0);
  const recordingMsRef = useRef(0);
  const cameraDetectedMsRef = useRef(0);  // 카메라가 감지한 총 시간
  const lastAudioAtRef = useRef(0);  // 마지막 오디오 감지 시각
  const vadSegmentsRef = useRef([]);  // VAD 구간 타임스탬프 [{start: ms, end: ms}, ...]
  const lastTickAtRef = useRef(0);
  const lastMouthOpenAtRef = useRef(0);
  const lastUiUpdateAtRef = useRef(0);
  const voiceOnsetAtRef = useRef(null);
  const hasEmittedOnsetRef = useRef(false);
  const vadActiveRef = useRef(false);  // 현재 VAD 활성 상태
  const vadSegmentStartRef = useRef(null);  // 현재 VAD 구간 시작 시간

  const audioCtxRef = useRef(null);
  const analyserRef = useRef(null);
  const sourceRef = useRef(null);
  const timerRef = useRef(null);

  const detector = useMemo(() => createSpeakingDetector(), []);

  // onTick과 onVoiceOnset을 ref로 관리 (메모리 누수 방지)
  const onTickRef = useRef(onTick);
  const onVoiceOnsetRef = useRef(onVoiceOnset);

  // 콜백이 바뀔 때마다 ref 업데이트 (useEffect 재실행 방지)
  useEffect(() => {
    onTickRef.current = onTick;
  }, [onTick]);

  useEffect(() => {
    onVoiceOnsetRef.current = onVoiceOnset;
  }, [onVoiceOnset]);

  const finalizeVadSegments = useCallback(() => {
    const nowMs = recordingMsRef.current || 0;
    if (vadActiveRef.current && vadSegmentStartRef.current !== null) {
      vadSegmentsRef.current.push({
        start: vadSegmentStartRef.current,
        end: nowMs,
      });
      vadActiveRef.current = false;
      vadSegmentStartRef.current = null;
    }
    return (vadSegmentsRef.current || []).slice();
  }, []);

  useEffect(() => {
    const cleanup = async () => {
      // 녹음 종료 시, 마지막 VAD 구간이 열려있으면 닫아둔다
      finalizeVadSegments();
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      if (sourceRef.current) {
        try {
          sourceRef.current.disconnect();
        } catch (_) {}
        sourceRef.current = null;
      }
      analyserRef.current = null;
      if (audioCtxRef.current) {
        try {
          await audioCtxRef.current.close();
        } catch (_) {}
        audioCtxRef.current = null;
      }
    };

    // disabled or no stream
    if (!enabled || !stream) {
      setCurrentlySpeaking(false);
      return () => {
        cleanup();
      };
    }

    // reset for new recording session
    detector.reset();
    speakingMsRef.current = 0;
    recordingMsRef.current = 0;
    cameraDetectedMsRef.current = 0;
    lastAudioAtRef.current = 0;
    vadSegmentsRef.current = [];
    vadActiveRef.current = false;
    vadSegmentStartRef.current = null;
    voiceOnsetAtRef.current = null;
    hasEmittedOnsetRef.current = false;
    lastTickAtRef.current = Date.now();
    lastMouthOpenAtRef.current = 0;
    lastUiUpdateAtRef.current = 0;
    setUiSpeakingMs(0);
    setCurrentlySpeaking(false);

    const init = async () => {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      const ctx = new AudioCtx();
      audioCtxRef.current = ctx;
      try {
        if (ctx.state === 'suspended') await ctx.resume();
      } catch (_) {}

      const analyser = ctx.createAnalyser();
      analyser.fftSize = 2048;
      analyser.smoothingTimeConstant = 0.3;
      analyserRef.current = analyser;

      const source = ctx.createMediaStreamSource(stream);
      source.connect(analyser);
      sourceRef.current = source;

      timerRef.current = setInterval(() => {
        const now = Date.now();
        const delta = now - (lastTickAtRef.current || now);
        lastTickAtRef.current = now;
        recordingMsRef.current += delta;

        // TTS 재생 중에는 감지/누적/이벤트 모두 게이팅
        if (isTtsPlaying) {
          // TTS 구간이 VAD 세그먼트에 섞이지 않도록, 열려있는 세그먼트는 즉시 닫는다
          finalizeVadSegments();
          if (currentlySpeaking) setCurrentlySpeaking(false);
          if (typeof onTickRef.current === 'function') {
            onTickRef.current({ deltaMs: delta, isSpeaking: false, speakingMs: speakingMsRef.current, recordingMs: recordingMsRef.current });
          }
          return;
        }

        const currentLandmarks = landmarksRef?.current || null;
        const analyserNode = analyserRef.current;
        const sampleRate = audioCtxRef.current?.sampleRate || 48000;
        if (!analyserNode) return;

        const volume = computeVoiceBandVolume(analyserNode, sampleRate);
        const state = detector.getSpeakingState(currentLandmarks, volume, { gated: false });

        // 오디오가 감지되면 시각 기록
        if (state.hasAudio) {
          lastAudioAtRef.current = now;
        }

        // 카메라 기반 발화시간: 입 움직임 + (현재 오디오 OR 최근 500ms 이내 오디오)
        const AUDIO_GRACE_PERIOD = 500; // ms
        const hasRecentAudio = (now - lastAudioAtRef.current) < AUDIO_GRACE_PERIOD;
        if (state.mouthActive && (state.hasAudio || hasRecentAudio)) {
          cameraDetectedMsRef.current += delta;
        }

        // VAD 구간 타임스탬프 기록
        const relativeTime = recordingMsRef.current;
        if (state.hasAudio && !vadActiveRef.current) {
          // VAD 구간 시작
          vadActiveRef.current = true;
          vadSegmentStartRef.current = relativeTime;
        } else if (!state.hasAudio && vadActiveRef.current) {
          // VAD 구간 종료
          vadActiveRef.current = false;
          if (vadSegmentStartRef.current !== null) {
            vadSegmentsRef.current.push({
              start: vadSegmentStartRef.current,
              end: relativeTime,
            });
            vadSegmentStartRef.current = null;
          }
        }

        if (state.mouthOpen) lastMouthOpenAtRef.current = now;
        const isSpeakingExtended =
          state.isSpeaking || (state.hasAudio && now - (lastMouthOpenAtRef.current || 0) < mouthHoldMs);

        if (isSpeakingExtended) {
          speakingMsRef.current += delta;
          if (!hasEmittedOnsetRef.current) {
            hasEmittedOnsetRef.current = true;
            voiceOnsetAtRef.current = now;
            if (typeof onVoiceOnsetRef.current === 'function') onVoiceOnsetRef.current(now);
          }
        }

        setCurrentlySpeaking(isSpeakingExtended);

        // UI state는 너무 자주 업데이트하지 않도록 200ms 쓰로틀
        if (now - (lastUiUpdateAtRef.current || 0) >= 200) {
          lastUiUpdateAtRef.current = now;
          setUiSpeakingMs(speakingMsRef.current);
          // Debug state 업데이트 (200ms 쓰로틀)
          setDebugState({
            // VAD
            volume: state.volume,
            noiseFloor: detector.getNoiseFloor(),
            threshold: state.threshold,
            hasAudio: state.hasAudio,
            // Camera
            mar: state.mar,
            marStd: state.marStd,
            mouthOpen: state.mouthOpen,
            mouthMoving: state.mouthMoving,
            mouthActive: state.mouthActive,
            hasLandmarks: currentLandmarks && currentLandmarks.length > 0,
            cameraDetectedMs: cameraDetectedMsRef.current,
            // Combined
            isSpeaking: state.isSpeaking,
            isSpeakingExtended,
            speakingMs: speakingMsRef.current,
            recordingMs: recordingMsRef.current,
          });
        }

        if (typeof onTickRef.current === 'function') {
          onTickRef.current({ deltaMs: delta, isSpeaking: isSpeakingExtended, speakingMs: speakingMsRef.current, recordingMs: recordingMsRef.current });
        }
      }, updateIntervalMs);
    };

    init();
    return () => {
      cleanup();
    };
  }, [enabled, stream, isTtsPlaying, updateIntervalMs, mouthHoldMs, finalizeVadSegments]); // onTick, onVoiceOnset은 ref로 처리

  return {
    currentlySpeaking,
    speakingMs: uiSpeakingMs,
    speakingMsRef,
    recordingMsRef,
    cameraDetectedMsRef,
    voiceOnsetAtRef,
    debugState,
    vadSegmentsRef,  // VAD 구간 타임스탬프
    finalizeVadSegments, // VAD 마지막 구간 확정 + 스냅샷
  };
}

