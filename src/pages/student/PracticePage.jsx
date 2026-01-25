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
import FloatingCameraPreview from '../../components/common/FloatingCameraPreview';
import { getFeedbackHistory } from '../../api/tutorFeedback';

// Hooks
import { useMediaPipe } from '../../hooks/conversation/useMediaPipe';
import { useSpeechActivityTracker } from '../../hooks/conversation/useSpeechActivityTracker';
import { useTTSAudio } from '../../hooks/useTTSAudio';
import { useWhisperSTT } from '../../hooks/useWhisperSTT';
import { selectWhisperPreloadStatus } from '../../store/slices/whisperPreloadSlice';

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
// import {useStudentStatus} from "../../api/useStudentStatus.js";

// Prevent duplicate calls (StrictMode mount/unmount) + add simple cache
const sentenceBatchInFlight = new Map(); // key -> Promise<{sessionId:string|null, sentences:string[]}>
const sentenceBatchCache = new Map(); // key -> { sessionId: string|null, sentences: {id,text}[], savedAt: number }
const sentenceBatchFailAt = new Map(); // key -> lastFailedAt(ms)
const AUDIO_POLL_SCHEDULE_MS = [0, 500, 1000, 2000, 3000, 5000];

// 캐시 크기 제한 (메모리 누수 방지)
const MAX_SENTENCE_CACHE_SIZE = 20;

function ProgressRing({ valuePercent }) {
  const size = 96;
  const stroke = 6;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, valuePercent || 0));
  const dash = (pct / 100) * c;

  return (
    <svg width={size} height={size} className="absolute inset-0">
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="transparent"
        stroke="currentColor"
        strokeWidth={stroke}
        className="text-white/15"
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="transparent"
        stroke="currentColor"
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={`${dash} ${c - dash}`}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        className="text-white"
      />
    </svg>
  );
}

export default function PracticePage() {
  const user = useSelector(state => state.auth.user);
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
  const startNonce = location.state?.startNonce || location.key; // ensures new set per start; stable in StrictMode

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

  // useStudentStatus(user, location);

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

  // onTick 콜백을 useCallback으로 메모이제이션 (메모리 누수 방지)
  const handleSpeechTick = useCallback(({ deltaMs, isSpeaking: speaking }) => {
    // 녹음 시간 누적
    dispatch(updateRecordingTime({ deltaTime: deltaMs }));
    // 발화 시간 누적
    dispatch(updateSpeakingTime({ deltaTime: deltaMs, isSpeaking: speaking }));
    // 문장 연습 발화 시간 누적
    if (speaking) dispatch(updatePracticeSpeakingTime({ deltaTime: deltaMs }));
  }, [dispatch]);

  // 실제 발화시간(VAD/MAR) 트래킹: Whisper 스트림 재사용
  const { speakingMsRef, cameraDetectedMsRef, debugState, finalizeVadSegments } = useSpeechActivityTracker({
    enabled: isWhisperRecording,
    stream: micStream,
    landmarksRef,
    isTtsPlaying: isSpeaking,
    onTick: handleSpeechTick,
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
  const [sttNeedsRetry, setSttNeedsRetry] = useState(false);
  const [sttMismatchInfo, setSttMismatchInfo] = useState(null); // { cameraMs, vadMs, diffMs }
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
    const loadKey = `${topicId}:${difficulty}:${startNonce}`;

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
        // 캐시 크기 제한 (메모리 누수 방지: 오래된 항목 제거)
        if (sentenceBatchCache.size >= MAX_SENTENCE_CACHE_SIZE) {
          const firstKey = sentenceBatchCache.keys().next().value;
          sentenceBatchCache.delete(firstKey);
        }
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
  }, [topicId, difficulty, startNonce, resetTimers]);

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

        // 백엔드 저장은 세션 종료 시 POST /api/sessions/end를 통해 자동으로 이루어집니다.

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

  const handleRetryReset = useCallback(() => {
    try {
      stop?.();
    } catch (_) {}
    setValidationResult(null);
    setTranscript('');
    setSttWarning(null);
    setSttNeedsRetry(false);
    setSttMismatchInfo(null);
    setVadTrimError(null);
    setIsVadTrimming(false);
    setEvaluationResult(null);
    clearReplayUrls(currentSentence?.id);
  }, [clearReplayUrls, currentSentence?.id, stop]);

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
    setSttNeedsRetry(false);
    setSttMismatchInfo(null);
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

        console.log('[PracticePage] detection:', {
          cameraMs,
          vadMs,
          diffMs,
          thresholdMs: THRESHOLD_MS,
          cameraSec: (cameraMs / 1000).toFixed(2),
          vadSec: (vadMs / 1000).toFixed(2),
          diffSec: (diffMs / 1000).toFixed(2),
        });

        if (diffMs > THRESHOLD_MS) {
          setTranscript('');
          setEvaluationResult(null);
          setSttNeedsRetry(true);
          setSttMismatchInfo({ cameraMs, vadMs, diffMs });
          setSttWarning('발화 시간이 불안정하게 감지됐어요.\n조용한 환경에서 한 번 더 녹음해주세요.');
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
            setSttNeedsRetry(false);
            setSttMismatchInfo(null);
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
          setSttNeedsRetry(false);
          setSttMismatchInfo(null);
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
  const micProgressPct = isRecordingNow
    ? Math.min(100, Math.max(0, (recordingDuration / MAX_RECORDING_DURATION) * 100))
    : 0;
  const currentVadUrl = currentSentence?.id ? vadAudioUrlBySentenceId[currentSentence.id] : null;
  const currentVadDurationMs = currentSentence?.id ? vadDurationMsBySentenceId[currentSentence.id] : null;
  const passedCount = Object.values(passedBySentenceId || {}).filter(Boolean).length;
  const isGoalReached = passedCount >= 5;
  const progressPercent = Math.min(100, Math.round((passedCount / 5) * 100));
  // 단어별 하이라이트(간단 버전): expected 단어가 spoken에 있으면 OK
  const feedbackTokens = useMemo(() => {
    const expectedText = currentSentence?.text || '';
    const spokenRaw = String(validationResult?.spoken || '').trim();
    if (!expectedText || !spokenRaw) return [];
    const expectedWords = expectedText
      .replace(/[^\w\s]/g, '')
      .split(/\s+/)
      .filter(Boolean);

    const spokenSet = new Set(
      spokenRaw
        .split(/\s+/)
        .filter(Boolean)
        .map((w) => w.toLowerCase())
    );

    return expectedWords.map((w) => ({
      word: w,
      ok: spokenSet.has(String(w).toLowerCase()),
    }));
  }, [currentSentence?.text, validationResult?.spoken]);

  const missingWordsPreview = useMemo(() => {
    if (!feedbackTokens.length) return null;
    const missing = feedbackTokens.filter((t) => !t.ok).slice(0, 3).map((t) => t.word);
    return missing.length ? missing.join(', ') : null;
  }, [feedbackTokens]);

  // 문장 전환 애니메이션(페이지 넘어가는 느낌)
  const [transitionStage, setTransitionStage] = useState('idle'); // 'idle' | 'out' | 'in'
  const startTransitionOut = useCallback(async () => {
    setTransitionStage('out');
    await new Promise((r) => setTimeout(r, 160));
  }, []);
  useEffect(() => {
    setTransitionStage('in');
    const t = setTimeout(() => setTransitionStage('idle'), 220);
    return () => clearTimeout(t);
  }, [currentIndex]);

  const handleNextAnimated = useCallback(async () => {
    await startTransitionOut();
    await handleNext();
  }, [handleNext, startTransitionOut]);

  const handlePrevAnimated = useCallback(async () => {
    await startTransitionOut();
    handlePrev();
  }, [handlePrev, startTransitionOut]);

  const handleSkipAnimated = useCallback(async () => {
    if (isNavigating) return;
    if (!(sentenceList.length > 0 && currentIndex < sentenceList.length - 1)) return;
    if (!practiceSessionId) return;

    await startTransitionOut();

    try {
      setIsNavigating(true);
      const nextIndex = currentIndex + 1;
      const nextId = sentenceList[nextIndex]?.id;
      setCurrentIndex(nextIndex);
      setValidationResult(null);
      setTranscript('');
      setCanGoNext(!!(nextId && passedBySentenceId?.[nextId]));
      resetTimers();
    } finally {
      setIsNavigating(false);
    }
  }, [
    currentIndex,
    isNavigating,
    passedBySentenceId,
    practiceSessionId,
    resetTimers,
    sentenceList,
    startTransitionOut,
  ]);

  return (
    <StudentLayout
      mode="session"
      sessionHeader={
        <header
          data-session-header="true"
          className="w-full flex items-center justify-between whitespace-nowrap border-b border-solid border-gray-200 dark:border-gray-800 bg-white dark:bg-background-dark px-6 md:px-10 py-3"
        >
          <div className="flex items-center gap-4">
            <h2 className="text-[#111418] dark:text-white text-lg font-bold leading-tight tracking-[-0.015em]">
              Sentence Practice
            </h2>
          </div>
          <div className="flex gap-3">
            <button
              className="flex items-center justify-center rounded-lg h-10 w-10 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 transition"
              type="button"
              onClick={() => navigate('/home')}
              aria-label="Close"
              title="Close"
            >
              <span className="material-symbols-outlined">close</span>
            </button>
          </div>
        </header>
      }
      todayTime={Math.floor(totalTimeMs / 1000 / 60)}
    >
      <div className="max-w-[800px] w-full mx-auto flex flex-col gap-8">
        {/* Permission Error */}
        {hasCameraPermission === false && (
          <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 flex items-start gap-2">
            <span className="material-symbols-outlined text-red-600 dark:text-red-300 text-[20px] mt-0.5">error</span>
            <div className="flex-1">
              <p className="text-sm font-semibold text-[#111418] dark:text-white">
                카메라 권한이 필요합니다
              </p>
              <p className="text-sm text-[#617589] dark:text-[#a0aec0]">
                브라우저 설정에서 권한을 허용해주세요.
              </p>
            </div>
          </div>
        )}

        {/* Sentence Loading/Error */}
        {isSentenceLoading && (
          <div className="rounded-xl border border-primary/20 bg-primary/10 px-4 py-3 flex items-center gap-2">
            <span className="inline-block size-4 animate-spin rounded-full border-2 border-primary/30 border-t-primary" />
            <p className="text-sm font-semibold text-[#111418] dark:text-white">
              문장 생성 중...
            </p>
          </div>
        )}
        {sentenceError && (
          <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 flex items-start gap-2">
            <span className="material-symbols-outlined text-amber-600 dark:text-amber-300 text-[20px] mt-0.5">warning</span>
            <p className="text-sm font-semibold text-[#111418] dark:text-white">{sentenceError}</p>
          </div>
        )}
        {ttsError && (
          <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 flex items-start gap-2">
            <span className="material-symbols-outlined text-amber-600 dark:text-amber-300 text-[20px] mt-0.5">warning</span>
            <p className="text-sm font-semibold text-[#111418] dark:text-white">
              TTS 오류: {ttsError}
            </p>
          </div>
        )}
        {sentenceList.length > 0 && !practiceSessionId && !isSentenceLoading && (
          <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 flex items-start gap-2">
            <span className="material-symbols-outlined text-amber-600 dark:text-amber-300 text-[20px] mt-0.5">warning</span>
            <p className="text-sm font-semibold text-[#111418] dark:text-white">
              오디오 세션을 생성하지 못했습니다. 새로고침 후 다시 시도해주세요.
            </p>
          </div>
        )}
        {audioSessionError && (
          <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 flex items-start gap-2">
            <span className="material-symbols-outlined text-amber-600 dark:text-amber-300 text-[20px] mt-0.5">warning</span>
            <p className="text-sm font-semibold text-[#111418] dark:text-white">
              오디오 준비 상태 조회 오류: {audioSessionError}
            </p>
          </div>
        )}

        {isVadTrimming ? (
          <div className="rounded-xl border border-primary/20 bg-primary/10 px-4 py-3 flex items-center gap-2">
            <span className="inline-block size-4 animate-spin rounded-full border-2 border-primary/30 border-t-primary" />
            <p className="text-sm font-semibold text-[#111418] dark:text-white">
              VAD 처리 중...
            </p>
          </div>
        ) : null}

        {isTranscribing ? (
          <div className="rounded-xl border border-primary/20 bg-primary/10 px-4 py-3 flex items-center gap-2">
            <span className="inline-block size-4 animate-spin rounded-full border-2 border-primary/30 border-t-primary" />
            <p className="text-sm font-semibold text-[#111418] dark:text-white">
              음성 인식 중...
            </p>
          </div>
        ) : null}

        {isEvaluating ? (
          <div className="rounded-xl border border-primary/20 bg-primary/10 px-4 py-3 flex items-center gap-2">
            <span className="inline-block size-4 animate-spin rounded-full border-2 border-primary/30 border-t-primary" />
            <p className="text-sm font-semibold text-[#111418] dark:text-white">
              발음 평가 중...
            </p>
          </div>
        ) : null}

        {/* STT 상태 */}
        {sttWarning && (
          <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 flex items-start gap-2">
            <span className="material-symbols-outlined text-amber-600 dark:text-amber-300 text-[20px] mt-0.5">info</span>
            <div className="flex-1">
              <p className="text-sm font-semibold text-[#111418] dark:text-white whitespace-pre-line">
                {sttWarning}
              </p>
              {sttMismatchInfo ? (
                <p className="mt-1 text-xs text-[#617589] dark:text-[#a0aec0]">
                  카메라 {(sttMismatchInfo.cameraMs / 1000).toFixed(1)}s · VAD {(sttMismatchInfo.vadMs / 1000).toFixed(1)}s · 차이 {(sttMismatchInfo.diffMs / 1000).toFixed(1)}s
                </p>
              ) : null}
            </div>
            {sttNeedsRetry ? (
              <button
                type="button"
                onClick={handleRetryReset}
                className="shrink-0 rounded-lg px-3 py-2 bg-white/70 dark:bg-gray-800 text-[#111418] dark:text-white text-sm font-bold border border-amber-500/20 dark:border-gray-700 hover:border-primary/30 hover:text-primary transition"
              >
                다시 녹음
              </button>
            ) : null}
          </div>
        )}
        {whisperError && (
          <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 flex items-start gap-2">
            <span className="material-symbols-outlined text-red-600 dark:text-red-300 text-[20px] mt-0.5">error</span>
            <p className="text-sm font-semibold text-[#111418] dark:text-white">
              STT 오류: {whisperError}
            </p>
          </div>
        )}

        {/* MediaPipe Loading */}
        {!isModelLoaded && hasCameraPermission && (
          <div className="rounded-xl border border-primary/20 bg-primary/10 px-4 py-3 flex items-center gap-2">
            <span className="inline-block size-4 animate-spin rounded-full border-2 border-primary/30 border-t-primary" />
            <p className="text-sm font-semibold text-[#111418] dark:text-white">
              얼굴 인식 모델 로딩 중...
            </p>
          </div>
        )}

        {/* Daily Progress */}
        <div className="bg-white dark:bg-gray-900 rounded-xl p-6 shadow-sm border border-gray-100 dark:border-gray-800">
          <div className="flex flex-col gap-3">
            <div className="flex gap-6 justify-between items-center">
              <p className="text-[#111418] dark:text-gray-200 text-base font-medium">Daily Progress</p>
              <span className="bg-primary/10 text-primary px-3 py-1 rounded-full text-sm font-bold">
                {passedCount} / 5
              </span>
            </div>
            <div className="rounded-full bg-gray-100 dark:bg-gray-800 h-3 overflow-hidden">
              <div className="h-full bg-primary rounded-full transition-all duration-500" style={{ width: `${progressPercent}%` }} />
            </div>
            <p className="text-gray-500 dark:text-gray-400 text-sm">
              {isGoalReached
                ? '목표 달성! 홈으로 돌아가거나 더 연습해보세요.'
                : `좋아요! 목표까지 ${Math.max(0, 5 - passedCount)}개 남았어요.`}
            </p>
          </div>
        </div>

        {/* Main Sentence Area */}
        <div
          className={`flex flex-col gap-6 items-center text-center transition-all duration-200 ${
            transitionStage === 'out' ? 'opacity-0 -translate-x-3' : 'opacity-100 translate-x-0'
          }`}
        >
          <div className="flex flex-col gap-2">
            <span className="text-primary font-semibold tracking-wider text-xs uppercase">Target Sentence</span>
            <h1 className="text-[#111418] dark:text-white text-[40px] font-bold leading-tight px-4 max-w-3xl">
              {currentSentence?.text || (isSentenceLoading ? '문장 생성 중...' : '문장을 불러오지 못했습니다')}
            </h1>
            <p className="text-xs text-[#617589] dark:text-[#a0aec0]">
              {sentenceList.length > 0 ? `문장 ${currentIndex + 1} / ${sentenceList.length}` : '문장 준비 중'}
              {practiceSessionId && audioSummary && (
                <>
                  {' · '}
                  오디오 {audioSummary.completedCount}/{audioSummary.totalCount}
                  {audioSummary.pendingCount > 0 && (isAudioPolling ? ' (준비중...)' : ' (지연)')}
                  {audioSummary.failedCount > 0 && ` · 실패 ${audioSummary.failedCount}`}
                </>
              )}
            </p>
          </div>

          <div className="w-full bg-white dark:bg-gray-900 rounded-2xl p-8 border-2 border-dashed border-gray-200 dark:border-gray-800 flex flex-col items-center gap-4">
            <p className="text-gray-400 dark:text-gray-500 text-sm font-medium uppercase tracking-widest">Your Speech Feedback</p>

            <div className="w-full max-w-2xl rounded-xl border border-[#dbe0e6] dark:border-gray-800 bg-background-light/60 dark:bg-[#0d141c] px-4 py-3 text-left">
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[#617589] dark:text-gray-500">
                You said
              </p>
              <p className="mt-1 text-sm font-semibold text-[#111418] dark:text-white whitespace-pre-wrap">
                {transcript ? transcript : '—'}
              </p>
            </div>

            {feedbackTokens.length === 0 ? (
              <div className="text-center">
                <p className="text-[#617589] dark:text-[#a0aec0] text-sm font-semibold">
                  녹음이 끝나면 피드백이 표시됩니다.
                </p>
                <p className="mt-1 text-gray-500 dark:text-gray-500 text-xs">
                  마이크 버튼을 눌러 문장을 말해보세요.
                </p>
              </div>
            ) : (
              <>
                <div className="text-2xl font-medium flex flex-wrap justify-center gap-x-2 gap-y-1">
                  {feedbackTokens.slice(0, 14).map((t, idx) => (
                    <span
                      key={`${t.word}-${idx}`}
                      className={
                        t.ok
                          ? 'text-success underline decoration-2 underline-offset-4'
                          : 'text-error bg-error/10 px-1 rounded'
                      }
                    >
                      {t.word}
                    </span>
                  ))}
                  {feedbackTokens.length > 14 && <span className="text-gray-300 dark:text-gray-700">...</span>}
                </div>

                {(validationResult?.feedback?.message || missingWordsPreview) && (
                  <p className="text-error text-sm font-medium mt-2 flex items-center gap-1">
                    <span className="material-symbols-outlined text-sm">info</span>
                    {validationResult?.feedback?.message || '피드백을 확인해주세요.'}
                    {missingWordsPreview ? ` (빠진 단어: ${missingWordsPreview})` : ''}
                  </p>
                )}
              </>
            )}
          </div>

          <div className="flex flex-col items-center gap-3 py-4">
            <div className="flex items-center justify-center gap-8">
              <button
                type="button"
                className="size-16 rounded-full bg-gray-100 dark:bg-gray-800 hover:bg-primary/10 hover:text-primary transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                onClick={handlePlaySentence}
                disabled={isSpeaking || !currentSentence || !isCurrentAudioReady}
                title="Listen"
              >
                <span className="material-symbols-outlined text-3xl">volume_up</span>
              </button>

              <button
                type="button"
                onClick={toggleRecording}
                disabled={!currentSentence || whisperStatus !== 'ready' || isSpeaking}
                className="relative flex items-center justify-center rounded-full bg-primary h-24 w-24 text-white shadow-lg shadow-primary/30 hover:scale-105 active:scale-95 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                title={isRecordingNow ? 'Stop' : 'Record'}
              >
                {isRecordingNow && <div className="absolute inset-0 rounded-full border-4 border-primary/20 animate-ping" />}
                {isRecordingNow ? <ProgressRing valuePercent={micProgressPct} /> : null}
                <span className="material-symbols-outlined text-4xl">{isRecordingNow ? 'stop' : 'mic'}</span>
              </button>

              <button
                type="button"
                className="size-16 rounded-full bg-gray-100 dark:bg-gray-800 hover:bg-primary/10 hover:text-primary transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                onClick={() => playLocalUrl(currentVadUrl)}
                disabled={!currentSentence || !currentVadUrl || isVadTrimming || isRecordingNow || isSpeaking}
                title="Replay Your Speech"
              >
                <span className="material-symbols-outlined text-3xl">graphic_eq</span>
              </button>
            </div>

            <p className={`font-bold text-lg text-center ${isRecordingNow ? 'text-primary animate-pulse' : 'text-[#617589] dark:text-[#a0aec0]'}`}>
              {whisperStatus === 'loading'
                ? 'STT Loading...'
                : isRecordingNow
                  ? 'Recording...'
                  : 'Ready'}
            </p>
          </div>
        </div>

        <div className="flex justify-between items-center w-full pt-4 border-t border-gray-100 dark:border-gray-800">
          <button
            type="button"
            className="flex items-center gap-2 px-6 py-3 rounded-lg font-bold text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={handlePrevAnimated}
            disabled={currentIndex === 0 || isRecordingNow}
          >
            <span className="material-symbols-outlined">arrow_back</span>
            Previous
          </button>

          <div className="flex gap-4">
            <button
              type="button"
              className="flex items-center gap-2 px-8 py-3 rounded-lg bg-primary text-white font-bold hover:bg-primary/90 shadow-md shadow-primary/20 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
              onClick={isGoalReached ? async () => {
                // 백엔드 저장은 세션 종료 시 POST /api/sessions/end를 통해 자동으로 이루어집니다.
                navigate('/home');
              } : handleNextAnimated}
              disabled={
                isRecordingNow ||
                isNavigating ||
                !practiceSessionId ||
                (isGoalReached ? false : (!canGoNext || currentIndex >= sentenceList.length - 1))
              }
            >
              {isGoalReached ? 'Home' : 'Next Sentence'}
              <span className="material-symbols-outlined">arrow_forward</span>
            </button>
          </div>
        </div>

        <FloatingCameraPreview
          videoRef={videoRef}
          canvasRef={canvasRef}
          showGrid={showGrid}
          setShowGrid={setShowGrid}
          showMouthLandmarks={showMouthLandmarks}
          setShowMouthLandmarks={setShowMouthLandmarks}
        />

      </div>

      {/* 튜터 피드백 오버레이 - 독립적 컴포넌트 */}
      <TutorFeedbackOverlay />
    </StudentLayout>
  );
}
