import {useState, useRef, useEffect, useMemo, useCallback} from 'react';
import {redirect, useLocation, useNavigate} from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import {
  Box,
  Typography,
  Button,
  Card,
  CardContent,
  Stack,
  Chip,
  Alert,
  CircularProgress,
  IconButton,
} from '@mui/material';
import {
  VolumeUp,
  Mic,
  MicOff,
  SkipNext,
  SkipPrevious,
  Visibility,
  VisibilityOff,
  GridOn,
  GraphicEq,
  HomeRounded,
} from '@mui/icons-material';
import StudentLayout from '../../components/common/StudentLayout';
import { getFeedbackHistory } from '../../api/tutorFeedback';

// Hooks
import { useMediaPipe } from '../../hooks/conversation/useMediaPipe';
import { useSpeechActivityTracker } from '../../hooks/conversation/useSpeechActivityTracker';
import { useTTSAudio } from '../../hooks/useTTSAudio';
import { useWhisperSTT } from '../../hooks/useWhisperSTT';
import { selectWhisperPreloadStatus } from '../../store/slices/whisperPreloadSlice';
import useWebSocket from "../../hooks/webSocket/useWebSocket.js";

// API
import { generatePracticeSession } from '../../api/sentences';
import { toApiDifficulty, toApiTopic } from '../../utils/apiMappers';
import { evaluatePronunciation } from '../../api/stt';

// Data & Utils
import { validateSentence } from '../../utils/conversation/sentenceValidator';
import { getScenarioById } from '../../data/conversation/scenarios';
import { useSentenceAudioSession } from '../../hooks/useSentenceAudioSession';
import { extractVADSegments } from '../../utils/audioTrimmer';
import { createPcmRecorder } from '../../utils/pcmRecorder';

import ws from "../../config/webSocketConfig.js";

// Redux
import {
  startSession,
  endSession,
  startPractice,
  setReferenceAudioDuration,
  resetCurrentPractice,
  completePractice,
  updateRecordingTime,
  updateSpeakingTime,
  updatePracticeSpeakingTime,
} from '../../store/slices/speakingStatsSlice';
import {
  selectCurrentPaceRatio,
  selectDailyAvgPaceRatio,
  selectNetSpeakingDensity,
  selectDailyAvgNetSpeakingDensity,
  getPaceRatioFeedback,
  getNetSpeakingDensityFeedback,
} from '../../store/selectors/speakingStatsSelectors';
import TutorFeedbackOverlay from '../../components/student/TutorFeedbackOverlay';

// Prevent duplicate calls (StrictMode mount/unmount) + add simple cache
const sentenceBatchInFlight = new Map(); // key -> Promise<{sessionId:string|null, sentences:string[]}>
const sentenceBatchCache = new Map(); // key -> { sessionId: string|null, sentences: {id,text}[], savedAt: number }
const sentenceBatchFailAt = new Map(); // key -> lastFailedAt(ms)
const AUDIO_POLL_SCHEDULE_MS = [0, 500, 1000, 2000, 3000, 5000];

export default function PracticePage() {
  const user = useSelector(state => state.auth.user);

  const getData = useCallback(() => {
    console.log("PracticePage: sentence room 상태 전송");

    if(!user?.email) {
      console.log("❌ 사용자 정보 없음");
      return null;
    }

    return {
      action: "status",
      data:{
        tutorEmail: user.tutorEmail,
        studentEmail: user.email,
        status: "active",
        room: "sentence",
        assignedAt: new Date().toISOString().split("T")[0],
      }
    };
  }, [user?.email]); // ← tutorEmail도 추가!

  // 페이지 진입 시 즉시 전송 + 5초마다 전송
  const socket = useWebSocket(getData, {
    sendImmediately: true,   // 즉시 전송 활성화
    enableInterval: true,     // 주기 전송 활성화
    interval: 5000            // 5초 간격
  });

  const location = useLocation();
  const navigate = useNavigate();
  const dispatch = useDispatch();

  // Redux selectors
  const currentPaceRatio = useSelector(selectCurrentPaceRatio);
  const avgPaceRatio = useSelector(selectDailyAvgPaceRatio);
  const netDensity = useSelector(selectNetSpeakingDensity);
  const avgNetDensity = useSelector(selectDailyAvgNetSpeakingDensity);

  // Refs
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const cameraStreamRef = useRef(null);

  // Get difficulty from navigation state, default to '중'
  const difficulty = location.state?.difficulty || '중';
  const topicId = location.state?.topicId || 'small_talk';
  const topic = useMemo(() => getScenarioById(topicId) || getScenarioById('small_talk'), [topicId]);

  // State
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showMouthLandmarks, setShowMouthLandmarks] = useState(false);
  const [showGrid, setShowGrid] = useState(false);
  const [validationResult, setValidationResult] = useState(null);
  const [transcript, setTranscript] = useState('');
  const [canGoNext, setCanGoNext] = useState(false);
  // 문장별 통과 상태(한 번 통과하면 유지)
  const [passedBySentenceId, setPassedBySentenceId] = useState({});
  const [hasCameraPermission, setHasCameraPermission] = useState(null);
  const [permissionError, setPermissionError] = useState(null);
  const [practiceSentences, setPracticeSentences] = useState([]); // { id, text }[]
  const [isSentenceLoading, setIsSentenceLoading] = useState(false);
  const [sentenceError, setSentenceError] = useState(null);
  const [practiceSessionId, setPracticeSessionId] = useState(null);
  const lastLoadKeyRef = useRef(null);

  // Hooks
  const { landmarksRef, isModelLoaded, error: mediaPipeError } = useMediaPipe(
    videoRef,
    canvasRef,
    { showGrid, showMouthLandmarks }
  );

  // Whisper STT (WebGPU 전용)
  const {
    transcribe: whisperTranscribe,
    error: whisperError,
  } = useWhisperSTT();

  // Redux에서 전역 Whisper 상태 가져오기
  const whisperStatus = useSelector(selectWhisperPreloadStatus);

  // Debug: record microphone in parallel so we can replay what was spoken

  // Whisper recording (no parallel debug recording)
  const [isWhisperRecording, setIsWhisperRecording] = useState(false);
  const whisperStreamRef = useRef(null);
  const whisperRecorderRef = useRef(null);
  const whisperChunksRef = useRef([]);
  const [micStream, setMicStream] = useState(null);
  const pcmRecorderRef = useRef(null);
  // 문장별 VAD 오디오(말한 구간) - 마지막 1개만 유지(덮어쓰기)
  const [vadAudioUrlBySentenceId, setVadAudioUrlBySentenceId] = useState({});
  const vadAudioUrlBySentenceIdRef = useRef({});
  const [vadDurationMsBySentenceId, setVadDurationMsBySentenceId] = useState({});
  const [isVadTrimming, setIsVadTrimming] = useState(false);
  const [vadTrimError, setVadTrimError] = useState(null);
  const [replayError, setReplayError] = useState(null);
  const replayAudioRef = useRef(null);
  const recordingSentenceIdRef = useRef(null);

  // 세션 시간(통계용): 버튼 시작~끝 기준
  const [totalTimeMs, setTotalTimeMs] = useState(0);
  const [lastTotalDurationMs, setLastTotalDurationMs] = useState(0);
  const [lastSpeechDurationMs, setLastSpeechDurationMs] = useState(0);

  // 다음 버튼 네비게이션 상태
  const [isNavigating, setIsNavigating] = useState(false);

  const resetTimers = useCallback(() => {
    setLastTotalDurationMs(0);
    setLastSpeechDurationMs(0);
  }, []);

  const { playUrl, stop, isPlaying: isSpeaking, error: ttsError, getAudioDuration } = useTTSAudio();

  // 실제 발화시간(VAD/MAR) 트래킹: Whisper 스트림 재사용
  const { speakingMsRef, cameraDetectedMsRef, debugState, finalizeVadSegments } = useSpeechActivityTracker({
    enabled: isWhisperRecording,
    stream: micStream,
    landmarksRef,
    isTtsPlaying: isSpeaking,
    onTick: ({ deltaMs, isSpeaking: speaking }) => {
      // 녹음 시간 누적
      dispatch(updateRecordingTime({ deltaTime: deltaMs }));
      // 발화 시간 누적
      dispatch(updateSpeakingTime({ deltaTime: deltaMs, isSpeaking: speaking }));
      // 문장 연습 발화 시간 누적
      if (speaking) dispatch(updatePracticeSpeakingTime({ deltaTime: deltaMs }));
    },
  });

  const setVadAudioUrlForSentenceId = useCallback((sentenceId, nextUrlOrNull) => {
    if (!sentenceId) return;
    setVadAudioUrlBySentenceId((prev) => {
      const oldUrl = prev?.[sentenceId];
      if (oldUrl) {
        try {
          URL.revokeObjectURL(oldUrl);
        } catch (_) {}
      }
      const next = { ...(prev || {}) };
      if (nextUrlOrNull) next[sentenceId] = nextUrlOrNull;
      else delete next[sentenceId];
      vadAudioUrlBySentenceIdRef.current = next;
      return next;
    });
  }, []);

  const clearReplayUrls = useCallback((sentenceId) => {
    setVadAudioUrlForSentenceId(sentenceId, null);
    // vadDurationMs는 초기화하지 않음 (STT 완료 시 새 값으로 업데이트됨)
  }, [setVadAudioUrlForSentenceId]);

  const playLocalUrl = useCallback((url) => {
    if (!url) return;
    setReplayError(null);
    try {
      replayAudioRef.current?.pause?.();
    } catch (_) {}
    const audio = new Audio(url);
    replayAudioRef.current = audio;
    audio.play().catch((e) => {
      setReplayError(e?.message || '오디오 재생에 실패했습니다. (브라우저 포맷/코덱 미지원 가능)');
    });
  }, []);


  // topic/난이도 변경 등으로 문장 세션이 바뀌면 이전 VAD URL들을 정리
  useEffect(() => {
    try {
      const map = vadAudioUrlBySentenceIdRef.current || {};
      Object.values(map).forEach((url) => {
        if (!url) return;
        try {
          URL.revokeObjectURL(url);
        } catch (_) {}
      });
    } catch (_) {}
    vadAudioUrlBySentenceIdRef.current = {};
    setVadAudioUrlBySentenceId({});
    setVadDurationMsBySentenceId({});
  }, [topicId, difficulty]);

  // unmount 시에도 남은 URL 정리
  useEffect(() => {
    return () => {
      try {
        replayAudioRef.current?.pause?.();
      } catch (_) {}
      try {
        const map = vadAudioUrlBySentenceIdRef.current || {};
        Object.values(map).forEach((url) => {
          if (!url) return;
          try {
            URL.revokeObjectURL(url);
          } catch (_) {}
        });
      } catch (_) {}
    };
  }, []);

  // State - 발음 평가 및 STT
  const [evaluationResult, setEvaluationResult] = useState(null);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const recordingStartTimeRef = useRef(null);
  const recordingTimerRef = useRef(null);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [sttWarning, setSttWarning] = useState(null);
  const stopDebounceTimerRef = useRef(null);

  // buildSrgsFromSentence 제거됨 (WebSpeech 미사용)
  function buildSrgsFromSentence_REMOVED(sentence) {
    const s = String(sentence || '').trim();
    if (!s) return null;
    const sentenceItem = s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const wordItems = uniq
      .map((w) => w.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'))
      .map((w) => `<item>${w}</item>`)
      .join('');

    return `<?xml version="1.0" encoding="utf-8"?>\n` +
      `<grammar xmlns="http://www.w3.org/2001/06/grammar" xml:lang="en-US" version="1.0" root="root">\n` +
      `  <rule id="root" scope="public">\n` +
      `    <one-of>\n` +
      `      <item>${sentenceItem}</item>\n` +
      `      ${wordItems}\n` +
      `    </one-of>\n` +
      `  </rule>\n` +
      `</grammar>`;
  }

  // 컴포넌트 unmount 시 타이머 정리
  useEffect(() => {
    return () => {
      // 타이머 정리
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
        recordingTimerRef.current = null;
      }
      if (stopDebounceTimerRef.current) {
        clearTimeout(stopDebounceTimerRef.current);
        stopDebounceTimerRef.current = null;
      }

      // Whisper recorder/stream cleanup
      if (whisperRecorderRef.current && whisperRecorderRef.current.state === 'recording') {
        try {
          whisperRecorderRef.current.stop();
        } catch (_) {
          // ignore
        }
      }
      try {
        pcmRecorderRef.current?.stop?.();
      } catch (_) {}
      pcmRecorderRef.current = null;
      whisperRecorderRef.current = null;
      whisperChunksRef.current = [];
      if (whisperStreamRef.current) {
        whisperStreamRef.current.getTracks().forEach((t) => {
          try {
            t.enabled = false;
          } catch (_) {
            // ignore
          }
          try {
            t.stop();
          } catch (_) {
            // ignore
          }
        });
        whisperStreamRef.current = null;
      }
    };
  }, []);

  // 녹음 제한 설정 (30초)
  const MAX_RECORDING_DURATION = 30 * 1000; // 30초

  // Load/generate sentences by topic + difficulty
  useEffect(() => {
    let cancelled = false;
    const loadKey = `${topicId}:${difficulty}`;

    // 실패 직후(예: StrictMode 재마운트) 중복 재요청 방지
    const lastFailedAt = sentenceBatchFailAt.get(loadKey);
    if (lastFailedAt && Date.now() - lastFailedAt < 15000) {
      setSentenceError('서버 응답이 지연되어 잠시 후 다시 시도해주세요.');
      return () => { cancelled = true; };
    }

    // Avoid re-loading the exact same key repeatedly (e.g., due to unrelated rerenders)
    if (lastLoadKeyRef.current === loadKey && practiceSentences.length > 0) return;
    lastLoadKeyRef.current = loadKey;

    const load = async () => {
      setIsSentenceLoading(true);
      setSentenceError(null);
      setPracticeSessionId(null);

      try {
        // Cache hit (memory)
        const cached = sentenceBatchCache.get(loadKey);
        if (cached?.sentences?.length) {
          if (!cancelled) {
            setPracticeSentences(cached.sentences);
            setPracticeSessionId(cached.sessionId || null);
            setCurrentIndex(0);
            setValidationResult(null);
            setTranscript('');
            setCanGoNext(false);
            setPassedBySentenceId({});
            resetTimers();
          }
          return;
        }

        // In-flight dedupe
        let promise = sentenceBatchInFlight.get(loadKey);
        if (!promise) {
          promise = generatePracticeSession({
            topic: toApiTopic(topicId),
            difficulty: toApiDifficulty(difficulty),
          });
          sentenceBatchInFlight.set(loadKey, promise);
        }

        const generated = await promise;
        const finalList = (generated?.sentences || [])
          .slice(0, 10)
          .map((text, idx) => ({ id: `${topicId}-${difficulty}-${idx}`, text }));

        // IMPORTANT: cache should be written even if this component instance was unmounted (StrictMode)
        sentenceBatchCache.set(loadKey, { sessionId: generated?.sessionId || null, sentences: finalList, savedAt: Date.now() });

        if (!cancelled) {
          setPracticeSentences(finalList);
          setPracticeSessionId(generated?.sessionId || null);
          setCurrentIndex(0);
          setValidationResult(null);
          setTranscript('');
          setCanGoNext(false);
          setPassedBySentenceId({});
          resetTimers();
        }
      } catch (err) {
        sentenceBatchInFlight.delete(loadKey);
        console.error('[PracticePage] sentence generation error:', err);
        sentenceBatchFailAt.set(loadKey, Date.now());
        if (!cancelled) {
          const isRateLimit =
            err?.status === 429 ||
            err?.response?.status === 429 ||
            String(err?.message || '').includes('rate_limit') ||
            String(err?.message || '').includes('429');

          setSentenceError(
            isRateLimit
              ? '문장 생성 요청이 너무 많아(429) 잠시 후 다시 시도해주세요.'
              : (err?.code === 'ECONNABORTED'
                  ? '서버 응답이 느립니다(타임아웃). 잠시 후 다시 시도해주세요.'
                  : (err?.message || '문장 생성에 실패했습니다.'))
          );
          setPracticeSentences([]);
          setPracticeSessionId(null);
        }
      } finally {
        sentenceBatchInFlight.delete(loadKey);
        if (!cancelled) setIsSentenceLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [topicId, difficulty, resetTimers]);

  // Current sentence
  // API 호출 전에는 기본 문장(목업) 노출하지 않음. (에러/키없음 시에는 practiceSentences에 fallback이 들어감)
  const sentenceList = practiceSentences;
  const currentSentence = sentenceList[currentIndex];

  // sessionId 기반 오디오 상태 폴링 (문장별 SQS 처리: out-of-order 완료 가능)
  const {
    summary: audioSummary,
    byIndex: audioByIndex,
    isPolling: isAudioPolling,
    error: audioSessionError,
  } = useSentenceAudioSession(practiceSessionId, {
    enabled: !!practiceSessionId,
    maxWaitMs: 60000,
    // NOTE: 배열 리터럴을 그대로 넘기면 렌더마다 참조가 바뀌어 폴링이 재시작됨
    scheduleMs: AUDIO_POLL_SCHEDULE_MS,
  });

  const currentAudio = audioByIndex.get(currentIndex) || null;
  const isCurrentAudioReady = currentAudio?.status === 'COMPLETED' && !!currentAudio?.audioUrl;

  // 오디오 준비 대기 시간은 Net Speaking Density에서 제외될 수 있도록 systemLoading으로 계측
  // 로딩 추적 제거 (더 이상 필요 없음)

  // 백엔드 durationMs가 있으면 Pace Ratio 기준값으로 선반영
  useEffect(() => {
    const d = currentAudio?.durationMs;
    if (typeof d === 'number' && d > 0) {
      dispatch(setReferenceAudioDuration({ duration: d }));
    }
  }, [currentIndex, currentAudio?.durationMs, dispatch]);

  // Redux: 세션 시작/종료 + 백엔드 API 연동
  useEffect(() => {
    // Redux 세션 시작
    dispatch(startSession({ sessionType: 'practice' }));

    return () => {
      // Redux 세션 종료
      dispatch(endSession());
    };
  }, [dispatch]);

  // 세션 시간 추적 제거 (녹음 시간만 추적)

  // Redux: 문장 변경 시 연습 시작
  useEffect(() => {
    if (currentSentence) {
      dispatch(startPractice({ sentenceId: currentSentence.id }));
    }
  }, [currentSentence, dispatch]);

  // Request camera permission
  useEffect(() => {
    let cancelled = false;
    const requestCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        cameraStreamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
        setHasCameraPermission(true);
      } catch (err) {
        console.error('Camera permission error:', err);
        setPermissionError(err.message);
        setHasCameraPermission(false);
      }
    };

    requestCamera();

    return () => {
      cancelled = true;
      // 녹음 타이머 정리
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
        recordingTimerRef.current = null;
      }
      // videoRef가 이미 null이어도 streamRef로 안전하게 정리
      if (cameraStreamRef.current) {
        cameraStreamRef.current.getTracks().forEach((track) => track.stop());
        cameraStreamRef.current = null;
      }
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
    };
  }, []);



  // Validate when transcript changes
  useEffect(() => {
    if (transcript && currentSentence) {
      const result = validateSentence(currentSentence.text, transcript);
      setValidationResult(result);

      // 정확도 통과 시 '다음' 버튼만 활성화 (자동 이동 X)
      if (result.passed) {
        setPassedBySentenceId((prev) => {
          if (prev?.[currentSentence.id]) return prev;
          return { ...(prev || {}), [currentSentence.id]: true };
        });
        setCanGoNext(true);
      }
    }
  }, [transcript, currentSentence, currentIndex, sentenceList.length]);

  // 문장 이동 시: 이미 통과한 문장은 바로 다음 활성화
  useEffect(() => {
    if (!currentSentence?.id) return;
    setCanGoNext(!!passedBySentenceId?.[currentSentence.id]);
  }, [currentSentence?.id, passedBySentenceId]);

  // Handlers
  const handleNext = async () => {
    // 중복 클릭 방지
    if (isNavigating) {
      console.warn('[handleNext] Already navigating, ignoring click');
      return;
    }

    try {
      setIsNavigating(true);

      if (sentenceList.length > 0 && currentIndex < sentenceList.length - 1) {
        const nextIndex = currentIndex + 1;
        const nextId = sentenceList[nextIndex]?.id;

        // 오디오 세션 준비 확인
        if (!practiceSessionId) {
          console.error('[handleNext] Audio session not ready');
          alert('오디오 세션이 준비되지 않았습니다. 잠시 후 다시 시도해주세요.');
          return;
        }

        // 다음 문장이 유효한지 확인
        if (!sentenceList[nextIndex]) {
          console.error('[handleNext] Next sentence not found');
          return;
        }

        console.log(`[handleNext] Moving to sentence ${nextIndex}`);

        setCurrentIndex(nextIndex);
        setValidationResult(null);
        setTranscript('');
        setCanGoNext(!!(nextId && passedBySentenceId?.[nextId]));
        resetTimers();
      }
    } catch (error) {
      console.error('[handleNext] Error:', error);
      alert('다음 문장으로 이동하는 중 오류가 발생했습니다.');
    } finally {
      setIsNavigating(false);
    }
  };

  const handlePrev = () => {
    if (sentenceList.length > 0 && currentIndex > 0) {
      const prevIndex = currentIndex - 1;
      const prevId = sentenceList[prevIndex]?.id;
      setCurrentIndex(prevIndex);
      setValidationResult(null);
      setTranscript('');
      setCanGoNext(!!(prevId && passedBySentenceId?.[prevId]));
      resetTimers();
    }
  };

  const handlePlaySentence = async () => {
    if (currentSentence) {
      if (!isCurrentAudioReady) return;
      const playedDuration = await playUrl(currentAudio.audioUrl);
      const d = (typeof currentAudio?.durationMs === 'number' && currentAudio.durationMs > 0)
        ? currentAudio.durationMs
        : (playedDuration || getAudioDuration());
      if (d && d > 0) dispatch(setReferenceAudioDuration({ duration: d }));
    }
  };

  const toggleRecording = async () => {
    // STOP (Whisper)
    if (isWhisperRecording) {
      if (stopDebounceTimerRef.current) return;
      stopDebounceTimerRef.current = setTimeout(() => {
        try {
          whisperRecorderRef.current?.stop?.();
        } catch (_) {
          // ignore
        }
        stopDebounceTimerRef.current = null;
      }, 500);
      return;
    }

    setValidationResult(null);
    setTranscript('');
    setSttWarning(null);
    // 이미 통과한 문장은 재녹음 시작 전에도 '다음' 유지
    setCanGoNext(!!(currentSentence?.id && passedBySentenceId?.[currentSentence.id]));
    setEvaluationResult(null);
    setRecordingDuration(0);
    resetTimers();
    dispatch(resetCurrentPractice());
    // 녹음 시작 시 참조 오디오 길이 재설정 (같은 문장 반복 시 useEffect가 재실행되지 않으므로)
    if (currentAudio?.durationMs > 0) {
      dispatch(setReferenceAudioDuration({ duration: currentAudio.durationMs }));
    }
    setVadTrimError(null);
    setIsVadTrimming(false);
    clearReplayUrls(currentSentence?.id);

    recordingStartTimeRef.current = Date.now();
    recordingSentenceIdRef.current = currentSentence?.id || null;
    if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    recordingTimerRef.current = setInterval(() => {
      const elapsed = Date.now() - recordingStartTimeRef.current;
      setRecordingDuration(elapsed);
      if (elapsed >= MAX_RECORDING_DURATION) {
        try {
          whisperRecorderRef.current?.stop?.();
        } catch (_) {
          // ignore
        }
      }
    }, 100);

    try {
      // Whisper path: record once, then transcribe (no parallel debug recording)
      // Ensure debug recorder is off to avoid parallel mic usage
      setIsTranscribing(false);

      // Start recording now, and complete transcription in recorder.onstop (triggered by next toggleRecording STOP)
      whisperChunksRef.current = [];
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        },
      });
      whisperStreamRef.current = stream;
      setMicStream(stream);
      // PCM recorder (WAV) for replay/trim (Safari 호환)
      try {
        pcmRecorderRef.current = createPcmRecorder(stream, { channelCount: 1 });
      } catch (_) {
        pcmRecorderRef.current = null;
      }

      const preferred = [
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/ogg;codecs=opus',
        'audio/mp4;codecs=mp4a.40.2',
        'audio/mp4',
      ];
      const mimeType = preferred.find((t) => window.MediaRecorder?.isTypeSupported?.(t)) || '';
      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      whisperRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e?.data?.size > 0) whisperChunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        const blobType = mimeType || whisperChunksRef.current?.[0]?.type || 'audio/webm';
        const audioBlob = new Blob(whisperChunksRef.current, { type: blobType });
        whisperChunksRef.current = [];

        // VAD 세그먼트 확정 + 원본/트리밍 오디오 URL 생성(재생용)
        const sentenceId = recordingSentenceIdRef.current || currentSentence?.id || null;
        const vadSegments = typeof finalizeVadSegments === 'function' ? finalizeVadSegments() : [];
        const vadSegmentsDurationMs = (vadSegments || []).reduce((sum, seg) => {
          const s = typeof seg?.start === 'number' ? seg.start : 0;
          const e = typeof seg?.end === 'number' ? seg.end : 0;
          const d = Math.max(0, e - s);
          return sum + d;
        }, 0);
        let replayBaseBlob = audioBlob;
        try {
          const wav = await pcmRecorderRef.current?.stop?.();
          if (wav) replayBaseBlob = wav;
        } catch (_) {}
        pcmRecorderRef.current = null;
        setIsVadTrimming(true);
        setVadTrimError(null);
        try {
          const vadBlob = await extractVADSegments(replayBaseBlob, vadSegments);
          // vadDurationMs는 STT 완료 시 설정됨 (여기서는 건드리지 않음)
          if (sentenceId) {
            const url = URL.createObjectURL(vadBlob);
            setVadAudioUrlForSentenceId(sentenceId, url);
            // STT를 스킵하는 경우에도 UI/디버그용으로 우선 VAD(전처리) 시간은 기록
            setVadDurationMsBySentenceId((prev) => ({ ...(prev || {}), [sentenceId]: vadSegmentsDurationMs }));
          }
        } catch (e) {
          setVadTrimError(e?.message || 'VAD 오디오 생성에 실패했습니다.');
          if (sentenceId) setVadAudioUrlForSentenceId(sentenceId, null);
        } finally {
          setIsVadTrimming(false);
        }

        // cleanup stream
        if (whisperStreamRef.current) {
          whisperStreamRef.current.getTracks().forEach((t) => {
            try {
              t.enabled = false;
            } catch (_) {}
            try {
              t.stop();
            } catch (_) {}
          });
          whisperStreamRef.current = null;
        }
        setMicStream(null);
        whisperRecorderRef.current = null;
        setIsWhisperRecording(false);
        recordingSentenceIdRef.current = null;

        const startedAt = recordingStartTimeRef.current || Date.now();
        const durationMs = Math.max(0, Date.now() - startedAt);
        const speakingMs = Math.max(0, speakingMsRef.current || 0);
        setLastTotalDurationMs(durationMs);
        setLastSpeechDurationMs(speakingMs);
        setTotalTimeMs((t) => t + durationMs);

        // 카메라 감지 시간 vs VAD(전처리) 시간 비교: ±3초 이내일 때만 STT/평가 진행
        const cameraMs = Math.max(0, cameraDetectedMsRef?.current || 0);
        const vadMs = Math.max(0, vadSegmentsDurationMs || 0);
        const diffMs = Math.abs(cameraMs - vadMs);
        const THRESHOLD_MS = 3000;
        if (diffMs > THRESHOLD_MS) {
          setTranscript('');
          setSttWarning(
            `발화 감지 시간이 불일치합니다. (카메라 ${(cameraMs / 1000).toFixed(1)}s / VAD ${(vadMs / 1000).toFixed(1)}s, 차이 ${(diffMs / 1000).toFixed(1)}s)\n` +
            `±3초 이내일 때만 STT 변환/평가를 진행합니다.`
          );
          setIsTranscribing(false);
          if (recordingTimerRef.current) {
            clearInterval(recordingTimerRef.current);
            recordingTimerRef.current = null;
          }
          setRecordingDuration(0);
          return;
        }

        setIsTranscribing(true);
        try {
          const result = await whisperTranscribe(audioBlob, {
            prompt: currentSentence?.text,
            backend: 'webgpu',
            vad: true,
            trimThreshold: 0.003,
            trimPaddingSec: 0.1,
          });
          const transcribedText = String(result?.text || '').trim();
          const sttVadDurationMs = result?.vadDurationMs || null;

          // STT 전처리 VAD 시간 저장
          console.log('[PracticePage] STT result:', {
            text: transcribedText.substring(0, 30),
            vadDurationMs: sttVadDurationMs,
            vadDurationSec: sttVadDurationMs ? (sttVadDurationMs / 1000).toFixed(2) : null
          });
          if (sttVadDurationMs !== null) {
            if (sentenceId) {
              setVadDurationMsBySentenceId((prev) => ({ ...(prev || {}), [sentenceId]: sttVadDurationMs }));
            }
          }

          if (!transcribedText) {
            setTranscript('');
            setSttWarning('STT 결과가 비었습니다. 다시 한 번 말해보세요.');
            setEvaluationResult(null);
            return;
          }
          setTranscript(transcribedText);

          if (currentSentence) {
            setIsEvaluating(true);
            try {
              const result = await evaluatePronunciation({
                originalText: currentSentence.text,
                transcribedText: transcribedText,
                sentenceId: currentSentence.id,
                audioDurationMs: durationMs,
              });
              setEvaluationResult(result.evaluation);
            } catch (error) {
              console.error('Pronunciation evaluation error:', error);
              setEvaluationResult(null);
            } finally {
              setIsEvaluating(false);
            }
          }

          dispatch(completePractice({ userSpeakingTime: speakingMs }));
        } catch (e) {
          console.error('Whisper STT error:', e);
          setTranscript('');
          setSttWarning(e?.message || 'Whisper STT 오류가 발생했습니다.');
        } finally {
          setIsTranscribing(false);
          if (recordingTimerRef.current) {
            clearInterval(recordingTimerRef.current);
            recordingTimerRef.current = null;
          }
          setRecordingDuration(0);
        }
      };

      recorder.start();
      setIsWhisperRecording(true);
      // Whisper start returns immediately (recording ongoing)
    } catch (error) {
      console.error('Recording start error:', error);
      setTranscript('');
      setSttWarning(error?.message || '녹음 시작 오류가 발생했습니다.');
      setIsTranscribing(false);
      setMicStream(null);
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
        recordingTimerRef.current = null;
      }
      setRecordingDuration(0);
    }
  };

  const formatTime = (ms) => {
    const seconds = Math.floor(ms / 1000);
    return `${seconds}초`;
  };

  const isRecordingNow = isWhisperRecording;
  const currentVadUrl = currentSentence?.id ? vadAudioUrlBySentenceId[currentSentence.id] : null;
  const currentVadDurationMs = currentSentence?.id ? vadDurationMsBySentenceId[currentSentence.id] : null;
  const passedCount = Object.values(passedBySentenceId || {}).filter(Boolean).length;
  const isGoalReached = passedCount >= 5;

  return (
    <StudentLayout todayTime={Math.floor(totalTimeMs / 1000 / 60)}>
      <Box sx={{ maxWidth: 1200, mx: 'auto', width: '100%' }}>
        {/* Permission Error */}
        {hasCameraPermission === false && (
          <Alert severity="error" sx={{ mb: 2 }}>
            카메라 권한이 필요합니다. 브라우저 설정에서 권한을 허용해주세요.
          </Alert>
        )}

        {/* Sentence Loading/Error */}
        {isSentenceLoading && (
          <Alert severity="info" sx={{ mb: 2 }}>
            <CircularProgress size={20} sx={{ mr: 1 }} />
            문장 생성 중...
          </Alert>
        )}
        {sentenceError && (
          <Alert severity="warning" sx={{ mb: 2 }}>
            {sentenceError}
          </Alert>
        )}
        {ttsError && (
          <Alert severity="warning" sx={{ mb: 2 }}>
            TTS 오류: {ttsError}
          </Alert>
        )}
        {sentenceList.length > 0 && !practiceSessionId && !isSentenceLoading && (
          <Alert severity="warning" sx={{ mb: 2 }}>
            오디오 세션을 생성하지 못했습니다. 새로고침 후 다시 시도해주세요.
          </Alert>
        )}
        {audioSessionError && (
          <Alert severity="warning" sx={{ mb: 2 }}>
            오디오 준비 상태 조회 오류: {audioSessionError}
          </Alert>
        )}

        {/* STT 상태 */}
        {sttWarning && (
          <Alert severity="warning" sx={{ mb: 2 }}>
            {sttWarning}
          </Alert>
        )}
        {whisperError && (
          <Alert severity="warning" sx={{ mb: 2 }}>
            STT 오류: {whisperError}
          </Alert>
        )}

        {/* MediaPipe Loading */}
        {!isModelLoaded && hasCameraPermission && (
          <Alert severity="info" sx={{ mb: 2 }}>
            <CircularProgress size={20} sx={{ mr: 1 }} />
            얼굴 인식 모델 로딩 중...
          </Alert>
        )}

        {/* 상단 영역: 카메라 + 문장 */}
        <Stack direction="row" spacing={2} sx={{ mb: 3 }}>
          {/* 웹캠 프리뷰 */}
          <Card elevation={2} sx={{ flex: 1 }}>
            <CardContent>
              <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
                <Typography variant="h6" sx={{ fontWeight: 600 }}>
                  📹 웹캠
                </Typography>
                <Stack direction="row" spacing={0.5}>
                  <IconButton size="small" onClick={() => setShowGrid((v) => !v)} title="그리드">
                    <GridOn fontSize="small" color={showGrid ? 'primary' : 'inherit'} />
                  </IconButton>
                  <IconButton
                    size="small"
                    onClick={() => setShowMouthLandmarks((v) => !v)}
                    title="입 랜드마크"
                  >
                    {showMouthLandmarks ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}
                  </IconButton>
                </Stack>
              </Stack>
              <Box sx={{ position: 'relative', width: '100%', aspectRatio: '4/3', bgcolor: '#000', borderRadius: 2, overflow: 'hidden' }}>
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                  }}
                />
                <canvas
                  ref={canvasRef}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: '100%',
                  }}
                />
              </Box>
            </CardContent>
          </Card>

          {/* 문장 표시 */}
          <Card elevation={2} sx={{ flex: 1 }}>
            <CardContent>
              <Stack spacing={2}>
                <Box sx={{ textAlign: 'center' }}>
                  {sentenceList.length > 0 ? (
                    <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
                      문장 {currentIndex + 1} / {sentenceList.length}
                    </Typography>
                  ) : (
                    <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
                      문장 준비 중
                    </Typography>
                  )}
                  {practiceSessionId && audioSummary && (
                    <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
                      오디오 {audioSummary.completedCount}/{audioSummary.totalCount}
                      {audioSummary.pendingCount > 0 && (isAudioPolling ? ' (준비중...)' : ' (지연)')}
                      {audioSummary.failedCount > 0 && ` · 실패 ${audioSummary.failedCount}`}
                    </Typography>
                  )}
                  <Typography
                    variant="h4"
                    sx={{
                      fontWeight: 600,
                      mb: 3,
                      minHeight: 100,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {currentSentence?.text || (isSentenceLoading ? '문장 생성 중...' : '문장을 불러오지 못했습니다')}
                  </Typography>

                  {/* 컨트롤 버튼 */}
                  <Stack direction="row" spacing={2} justifyContent="center" sx={{ mb: 2 }}>
                    <Button
                      variant="outlined"
                      startIcon={<SkipPrevious />}
                      onClick={handlePrev}
                      disabled={currentIndex === 0 || isRecordingNow}
                    >
                      이전
                    </Button>
                    <Button
                      variant="contained"
                      startIcon={<VolumeUp />}
                      onClick={handlePlaySentence}
                      disabled={isSpeaking || !currentSentence || !isCurrentAudioReady}
                      sx={{
                        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                      }}
                    >
                      {isSpeaking ? '재생 중...' : (isCurrentAudioReady ? '듣기' : '준비중')}
                    </Button>
                    <Button
                      variant={isRecordingNow ? 'contained' : 'outlined'}
                      color={isRecordingNow ? 'error' : 'primary'}
                      startIcon={isRecordingNow ? <MicOff /> : <Mic />}
                      onClick={toggleRecording}
                      disabled={!currentSentence || whisperStatus !== 'ready' || isSpeaking}
                    >
                      {whisperStatus === 'loading'
                        ? '모델 로딩 중...'
                        : isRecordingNow
                          ? `중지 (${Math.floor((MAX_RECORDING_DURATION - recordingDuration) / 1000)}초)`
                          : '녹음'}
                    </Button>
                    <IconButton
                      size="medium"
                      onClick={() => playLocalUrl(currentVadUrl)}
                      disabled={!currentVadUrl || isVadTrimming || isRecordingNow || isSpeaking}
                      title={isVadTrimming ? '음성 추출 중...' : '발화 구간만 다시듣기'}
                      sx={{ border: 1, borderColor: 'divider', borderRadius: 1 }}
                    >
                      {isVadTrimming ? <CircularProgress size={20} /> : <GraphicEq fontSize="small" />}
                    </IconButton>
                    {isGoalReached ? (
                      <Button
                        variant="contained"
                        color="success"
                        startIcon={<HomeRounded />}
                        onClick={() => navigate('/home')}
                        disabled={isRecordingNow || isNavigating}
                      >
                        홈으로
                      </Button>
                    ) : (
                      <Button
                        variant="outlined"
                        startIcon={isNavigating ? <CircularProgress size={20} /> : <SkipNext />}
                        onClick={handleNext}
                        disabled={
                          currentIndex >= sentenceList.length - 1 ||
                          isRecordingNow ||
                          !canGoNext ||
                          isNavigating ||
                          !practiceSessionId
                        }
                      >
                        {isNavigating ? '이동 중...' : '다음'}
                      </Button>
                    )}
                  </Stack>

                  {vadTrimError && (
                    <Alert severity="warning" sx={{ mb: 2 }}>
                      VAD 오디오 생성 실패: {vadTrimError}
                    </Alert>
                  )}
                  {replayError && (
                    <Alert severity="warning" sx={{ mb: 2 }}>
                      오디오 재생 실패: {replayError}
                    </Alert>
                  )}

                  {/* STT 처리 중 */}
                  {isTranscribing && (
                    <Box sx={{ textAlign: 'center', py: 2 }}>
                      <CircularProgress size={24} />
                      <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                        음성 인식 중...
                      </Typography>
                    </Box>
                  )}

                  {/* 발음 평가 결과 */}
                  {isEvaluating && (
                    <Box sx={{ textAlign: 'center', py: 2 }}>
                      <CircularProgress size={24} />
                      <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                        발음 평가 중...
                      </Typography>
                    </Box>
                  )}

                  {evaluationResult && !isEvaluating && (
                    <Alert severity={evaluationResult.overallScore >= 80 ? 'success' : evaluationResult.overallScore >= 60 ? 'info' : 'warning'} sx={{ textAlign: 'left' }}>
                      <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                        발음 점수: {evaluationResult.overallScore}점 | 정확도: {evaluationResult.wordAccuracy}%
                      </Typography>
                      {evaluationResult.missedWords && evaluationResult.missedWords.length > 0 && (
                        <Typography variant="caption" color="error.main" sx={{ display: 'block' }}>
                          놓친 단어: {evaluationResult.missedWords.join(', ')}
                        </Typography>
                      )}
                      {evaluationResult.extraWords && evaluationResult.extraWords.length > 0 && (
                        <Typography variant="caption" color="warning.main" sx={{ display: 'block' }}>
                          추가된 단어: {evaluationResult.extraWords.join(', ')}
                        </Typography>
                      )}
                      <Typography variant="caption" sx={{ display: 'block', mt: 0.5 }}>
                        {evaluationResult.feedback}
                      </Typography>
                    </Alert>
                  )}
                </Box>

                {/* 난이도 표시 */}
                <Box sx={{ textAlign: 'center' }}>
                  <Stack direction="row" spacing={1} justifyContent="center" flexWrap="wrap">
                    <Chip label={`주제: ${topic?.title || topicId}`} color="secondary" size="small" />
                    <Chip label={`난이도: ${difficulty}`} color="primary" size="small" />
                  </Stack>
                </Box>

                {/* STT 결과 (주제/난이도 아래) */}
                {transcript && !isTranscribing && (
                  <Box sx={{ mt: 1.5, p: 2, bgcolor: 'primary.50', border: 1, borderColor: 'primary.200', borderRadius: 2 }}>
                    <Typography variant="subtitle2" color="primary.main" sx={{ fontWeight: 600, mb: 1 }}>
                      🎤 인식된 텍스트
                    </Typography>
                    <Typography variant="body1" sx={{ fontStyle: 'italic', color: 'text.primary', fontWeight: 500 }}>
                      "{transcript}"
                    </Typography>
                  </Box>
                )}
              </Stack>
            </CardContent>
          </Card>
        </Stack>

        {/* 통계 카드 */}
        <Card elevation={2} sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>
              📊 통계
            </Typography>
            <Stack spacing={2}>
              {/* Pace Ratio */}
              <Box>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  속도 비율 (Pace Ratio)
                </Typography>
                <Stack direction="row" spacing={2}>
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="h6" sx={{ fontWeight: 700 }}>
                      {currentPaceRatio ? currentPaceRatio.toFixed(2) : '-'}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      현재
                    </Typography>
                  </Box>
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="h6" sx={{ fontWeight: 700 }}>
                      {avgPaceRatio ? avgPaceRatio.toFixed(2) : '-'}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      평균
                    </Typography>
                  </Box>
                </Stack>
                {currentPaceRatio && (
                  <Chip
                    label={getPaceRatioFeedback(currentPaceRatio).message}
                    size="small"
                    sx={{
                      mt: 1,
                      bgcolor: getPaceRatioFeedback(currentPaceRatio).color + '.100',
                      color: getPaceRatioFeedback(currentPaceRatio).color + '.800',
                    }}
                  />
                )}
              </Box>

              {/* Net Speaking Density */}
              <Box>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  발화 밀도 (Net Speaking Density)
                </Typography>
                <Stack direction="row" spacing={2}>
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="h6" sx={{ fontWeight: 700 }}>
                      {netDensity.toFixed(1)}%
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      현재
                    </Typography>
                  </Box>
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="h6" sx={{ fontWeight: 700 }}>
                      {avgNetDensity > 0 ? `${avgNetDensity.toFixed(1)}%` : '-'}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      평균
                    </Typography>
                  </Box>
                </Stack>
                <Chip
                  label={getNetSpeakingDensityFeedback(netDensity).message}
                  size="small"
                  sx={{
                    mt: 1,
                    bgcolor: getNetSpeakingDensityFeedback(netDensity).color + '.100',
                    color: getNetSpeakingDensityFeedback(netDensity).color + '.800',
                  }}
                />
              </Box>
            </Stack>
          </CardContent>
        </Card>

        {/* Debug Panel - VAD & Camera Detection */}
        <Card elevation={2} sx={{ mt: 3, bgcolor: '#f5f5f5' }}>
          <CardContent>
            <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>
              🔍 Detection Debug Panel
            </Typography>
            {debugState ? (
              <Stack direction="row" spacing={4}>
                {/* VAD (Audio) */}
                <Box sx={{ flex: 1 }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1, color: 'primary.main' }}>
                    VAD (Audio Detection)
                  </Typography>
                  <Stack spacing={0.5}>
                    <Typography variant="body2">
                      Volume: <strong>{debugState.volume.toFixed(1)}</strong>
                    </Typography>
                    <Typography variant="body2">
                      Noise Floor: <strong>{debugState.noiseFloor.toFixed(1)}</strong>
                    </Typography>
                    <Typography variant="body2">
                      Threshold: <strong>{debugState.threshold.toFixed(1)}</strong>
                    </Typography>
                    <Typography variant="body2" component="div">
                      Has Audio: <Chip
                        label={debugState.hasAudio ? 'YES' : 'NO'}
                        size="small"
                        color={debugState.hasAudio ? 'success' : 'default'}
                        sx={{ ml: 1 }}
                      />
                    </Typography>
                    <Typography variant="body2" sx={{ mt: 1, fontWeight: 600, color: 'primary.dark' }}>
                      VAD 감지 시간: <strong>{currentVadDurationMs ? (currentVadDurationMs / 1000).toFixed(1) + 's' : '-'}</strong>
                    </Typography>
                  </Stack>
                </Box>

                {/* Camera (MAR) */}
                <Box sx={{ flex: 1 }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1, color: 'secondary.main' }}>
                    Camera (Mouth Detection)
                  </Typography>
                  <Stack spacing={0.5}>
                    <Typography variant="body2">
                      MAR (Multi-Point): <strong>{debugState.mar.toFixed(4)}</strong>
                    </Typography>
                    <Typography variant="body2">
                      MAR Std Dev: <strong>{debugState.marStd.toFixed(4)}</strong>
                    </Typography>
                    <Typography variant="body2" component="div">
                      Mouth Open: <Chip
                        label={debugState.mouthOpen ? 'YES' : 'NO'}
                        size="small"
                        color={debugState.mouthOpen ? 'success' : 'default'}
                        sx={{ ml: 1 }}
                      />
                    </Typography>
                    <Typography variant="body2" component="div">
                      Mouth Moving: <Chip
                        label={debugState.mouthMoving ? 'YES' : 'NO'}
                        size="small"
                        color={debugState.mouthMoving ? 'success' : 'default'}
                        sx={{ ml: 1 }}
                      />
                    </Typography>
                    <Typography variant="body2" component="div">
                      Mouth Active: <Chip
                        label={debugState.mouthActive ? 'YES' : 'NO'}
                        size="small"
                        color={debugState.mouthActive ? 'success' : 'default'}
                        sx={{ ml: 1 }}
                      />
                    </Typography>
                    <Typography variant="body2" component="div">
                      Has Landmarks: <Chip
                        label={debugState.hasLandmarks ? 'YES' : 'NO'}
                        size="small"
                        color={debugState.hasLandmarks ? 'success' : 'default'}
                        sx={{ ml: 1 }}
                      />
                    </Typography>
                    <Typography variant="body2" sx={{ mt: 1, fontWeight: 600, color: 'secondary.dark' }}>
                      카메라 감지 시간: <strong>{(debugState.cameraDetectedMs / 1000).toFixed(1)}s</strong>
                    </Typography>
                  </Stack>
                </Box>
              </Stack>
            ) : (
              <Typography variant="body2" color="text.secondary">
                녹음을 시작하면 디버그 정보가 표시됩니다.
              </Typography>
            )}
          </CardContent>
        </Card>

      </Box>

      {/* 튜터 피드백 오버레이 - 독립적 컴포넌트 */}
      <TutorFeedbackOverlay />
    </StudentLayout>
  );
}
