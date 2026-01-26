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
  const currentlySpeakingRef = useRef(false);

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
  const isTtsPlayingRef = useRef(isTtsPlaying);

  // 콜백이 바뀔 때마다 ref 업데이트 (useEffect 재실행 방지)
  useEffect(() => {
    onTickRef.current = onTick;
  }, [onTick]);

  useEffect(() => {
    onVoiceOnsetRef.current = onVoiceOnset;
  }, [onVoiceOnset]);

  useEffect(() => {
    isTtsPlayingRef.current = isTtsPlaying;
  }, [isTtsPlaying]);

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
    const segments = (vadSegmentsRef.current || []).slice();
    // 메모리 누수 방지: 내부 버퍼 정리
    vadSegmentsRef.current = [];
    return segments;
  }, []);

  const stopTracking = useCallback(() => {
    // close any open VAD segment
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

    // Safari 안정성: ctx는 재사용하고, 녹음 종료 시 suspend로 정리
    const ctx = audioCtxRef.current;
    if (ctx && typeof ctx.suspend === 'function') {
      try {
        ctx.suspend();
      } catch (_) {}
    }

    if (currentlySpeakingRef.current) {
      currentlySpeakingRef.current = false;
      setCurrentlySpeaking(false);
    } else {
      // ensure state is false even if ref was stale
      setCurrentlySpeaking(false);
    }
  }, [finalizeVadSegments]);

  // Unmount cleanup: truly close AudioContext once
  useEffect(() => {
    return () => {
      stopTracking();
      if (analyserRef.current) {
        try {
          analyserRef.current = null;
        } catch (_) {}
      }
      if (audioCtxRef.current) {
        try {
          audioCtxRef.current.close();
        } catch (_) {}
        audioCtxRef.current = null;
      }
    };
  }, [stopTracking]);

  useEffect(() => {
    // disabled or no stream
    if (!enabled || !stream) {
      stopTracking();
      return () => {
        stopTracking();
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
    currentlySpeakingRef.current = false;
    setCurrentlySpeaking(false);

    // AudioContext/Analyser는 훅 lifetime 동안 재사용
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!audioCtxRef.current) {
      try {
        audioCtxRef.current = new AudioCtx();
      } catch (_) {
        audioCtxRef.current = null;
      }
    }
    const ctx = audioCtxRef.current;

    try {
      if (ctx && ctx.state === 'suspended') ctx.resume();
    } catch (_) {}

    if (!analyserRef.current) {
      try {
        if (ctx) {
          const analyser = ctx.createAnalyser();
          analyser.fftSize = 2048;
          analyser.smoothingTimeConstant = 0.3;
          analyserRef.current = analyser;
        }
      } catch (_) {
        analyserRef.current = null;
      }
    }

    // disconnect previous stream source if any
    if (sourceRef.current) {
      try {
        sourceRef.current.disconnect();
      } catch (_) {}
      sourceRef.current = null;
    }

    if (ctx && analyserRef.current) {
      try {
        const source = ctx.createMediaStreamSource(stream);
        source.connect(analyserRef.current);
        sourceRef.current = source;
      } catch (_) {
        sourceRef.current = null;
      }
    }

    // timer singleton
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    timerRef.current = setInterval(() => {
      const now = Date.now();
      const delta = now - (lastTickAtRef.current || now);
      lastTickAtRef.current = now;
      recordingMsRef.current += delta;

      // TTS 재생 중에는 감지/누적/이벤트 모두 게이팅
      if (isTtsPlayingRef.current) {
        finalizeVadSegments();
        if (currentlySpeakingRef.current) {
          currentlySpeakingRef.current = false;
          setCurrentlySpeaking(false);
        }
        if (typeof onTickRef.current === 'function') {
          onTickRef.current({ deltaMs: delta, isSpeaking: false, speakingMs: speakingMsRef.current, recordingMs: recordingMsRef.current });
        }
        return;
      }

      const currentLandmarks = landmarksRef?.current || null;
      const analyserNode = analyserRef.current;
      // old_ui 방식: audioCtxRef에서 sampleRate 가져오기
      const sampleRate = audioCtxRef.current?.sampleRate || 48000;
      if (!analyserNode) return;

      const vol = computeVoiceBandVolume(analyserNode, sampleRate);
      const state = detector.getSpeakingState(currentLandmarks, vol, { gated: false });

      // 오디오가 감지되면 시각 기록
      if (state.hasAudio) lastAudioAtRef.current = now;

      // 카메라 기반 발화시간: 입 움직임 + (현재 오디오 OR 최근 500ms 이내 오디오)
      const AUDIO_GRACE_PERIOD = 500; // ms
      const hasRecentAudio = (now - lastAudioAtRef.current) < AUDIO_GRACE_PERIOD;
      if (state.mouthActive && (state.hasAudio || hasRecentAudio)) {
        cameraDetectedMsRef.current += delta;
      }

      // VAD 구간 타임스탬프 기록
      const relativeTime = recordingMsRef.current;
      if (state.hasAudio && !vadActiveRef.current) {
        vadActiveRef.current = true;
        vadSegmentStartRef.current = relativeTime;
      } else if (!state.hasAudio && vadActiveRef.current) {
        vadActiveRef.current = false;
        if (vadSegmentStartRef.current !== null) {
          vadSegmentsRef.current.push({ start: vadSegmentStartRef.current, end: relativeTime });
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

      if (currentlySpeakingRef.current !== isSpeakingExtended) {
        currentlySpeakingRef.current = isSpeakingExtended;
        setCurrentlySpeaking(isSpeakingExtended);
      }

      // UI state는 너무 자주 업데이트하지 않도록 200ms 쓰로틀
      if (now - (lastUiUpdateAtRef.current || 0) >= 200) {
        lastUiUpdateAtRef.current = now;
        setUiSpeakingMs(speakingMsRef.current);
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
        onTickRef.current({
          deltaMs: delta,
          isSpeaking: isSpeakingExtended,
          speakingMs: speakingMsRef.current,
          recordingMs: recordingMsRef.current,
        });
      }
    }, updateIntervalMs);

    return () => {
      stopTracking();
    };
  }, [enabled, stream, updateIntervalMs, mouthHoldMs, finalizeVadSegments, detector, stopTracking]); // onTick/onVoiceOnset/isTtsPlaying은 ref로 처리

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

