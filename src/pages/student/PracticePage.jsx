import {useState, useRef, useEffect, useMemo, useCallback} from 'react';
import {redirect, useLocation, useNavigate} from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import {
  Box,
  Typography,
  Button,
  Card,
  CardContent,
  LinearProgress,
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
} from '@mui/icons-material';
import StudentLayout from '../../components/common/StudentLayout';

// Hooks
import { useMediaPipe } from '../../hooks/conversation/useMediaPipe';
import { useTTSAudio } from '../../hooks/useTTSAudio';
import { useWhisperSTT } from '../../hooks/useWhisperSTT';
import { selectWhisperPreloadStatus } from '../../store/slices/whisperPreloadSlice';

// API
import { generatePracticeSentences } from '../../api/sentences';
import { toApiDifficulty, toApiTopic } from '../../utils/apiMappers';
import { evaluatePronunciation } from '../../api/stt';

// Data & Utils
import { validateSentence } from '../../utils/conversation/sentenceValidator';
import { getScenarioById } from '../../data/conversation/scenarios';

import ws from "../../config/webSocketConfig.js";
import useWebSocket from "../../hooks/webSocket/useWebSocket.js";

// Redux
import {
  startSession,
  endSession,
  startPractice,
  setReferenceAudioDuration,
  completePractice,
} from '../../store/slices/speakingStatsSlice';
import {
  selectCurrentPaceRatio,
  selectSessionAvgPaceRatio,
  selectNetSpeakingDensity,
  getPaceRatioFeedback,
  getNetSpeakingDensityFeedback,
} from '../../store/selectors/speakingStatsSelectors';

// Prevent duplicate calls (StrictMode mount/unmount) + add simple cache
const sentenceBatchInFlight = new Map(); // key -> Promise<string[]>
const sentenceBatchCache = new Map(); // key -> { sentences: {id,text}[], savedAt: number }
const sentenceBatchFailAt = new Map(); // key -> lastFailedAt(ms)

export default function PracticePage() {
  const user = useSelector(state => state.auth.user);

  const getData = useCallback(() => {
    console.log("websocket 실행!!");

    if(!user?.email) {
      console.log("❌ 사용자 정보 없음");
      return null;
    }

    return {
      action: "status",
      data:{
        tutorEmail: user.tutorEmail || "unknown@example.com",
        studentEmail: user.email,
        status: "active",
        room: "sentence",
        assignedAt: new Date().toISOString().split("T")[0],
      }
    };
  }, [user?.email]); // ← tutorEmail도 추가!

// ✅ 함수 자체를 전달 (실행하지 않음!)
  const socket = useWebSocket(getData);

  const location = useLocation();
  const navigate = useNavigate();
  const dispatch = useDispatch();

  // Redux selectors
  const currentPaceRatio = useSelector(selectCurrentPaceRatio);
  const avgPaceRatio = useSelector(selectSessionAvgPaceRatio);
  const netDensity = useSelector(selectNetSpeakingDensity);

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
  const [hasCameraPermission, setHasCameraPermission] = useState(null);
  const [permissionError, setPermissionError] = useState(null);
  const [practiceSentences, setPracticeSentences] = useState([]); // { id, text }[]
  const [isSentenceLoading, setIsSentenceLoading] = useState(false);
  const [sentenceError, setSentenceError] = useState(null);
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

  // 세션 시간(통계용): 버튼 시작~끝 기준
  const [totalTimeMs, setTotalTimeMs] = useState(0);
  const [lastTotalDurationMs, setLastTotalDurationMs] = useState(0);
  const [lastSpeechDurationMs, setLastSpeechDurationMs] = useState(0);

  const resetTimers = () => {
    setLastTotalDurationMs(0);
    setLastSpeechDurationMs(0);
  };

  const { playText, stop, isPlaying: isSpeaking, error: ttsError, getAudioDuration } = useTTSAudio();

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

      try {
        // Cache hit (memory)
        const cached = sentenceBatchCache.get(loadKey);
        if (cached?.sentences?.length) {
          if (!cancelled) {
            setPracticeSentences(cached.sentences);
            setCurrentIndex(0);
            setValidationResult(null);
            setTranscript('');
            resetTimers();
          }
          return;
        }

        // In-flight dedupe
        let promise = sentenceBatchInFlight.get(loadKey);
        if (!promise) {
          promise = generatePracticeSentences({
            topic: toApiTopic(topicId),
            difficulty: toApiDifficulty(difficulty),
          });
          sentenceBatchInFlight.set(loadKey, promise);
        }

        const generated = await promise;
        const finalList = (generated || [])
          .slice(0, 10)
          .map((text, idx) => ({ id: `${topicId}-${difficulty}-${idx}`, text }));

        // IMPORTANT: cache should be written even if this component instance was unmounted (StrictMode)
        sentenceBatchCache.set(loadKey, { sentences: finalList, savedAt: Date.now() });

        if (!cancelled) {
          setPracticeSentences(finalList);
          setCurrentIndex(0);
          setValidationResult(null);
          setTranscript('');
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

  // Redux: 세션 시작/종료
  useEffect(() => {
    dispatch(startSession({ sessionType: 'practice' }));
    return () => {
      dispatch(endSession());
    };
  }, [dispatch]);

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
        setCanGoNext(true);
      }
    }
  }, [transcript, currentSentence, currentIndex, sentenceList.length]);

  // Handlers
  const handleNext = () => {
    if (sentenceList.length > 0 && currentIndex < sentenceList.length - 1) {
      setCurrentIndex(currentIndex + 1);
      setValidationResult(null);
      setTranscript('');
      setCanGoNext(false);
      resetTimers();
    }
  };

  const handlePrev = () => {
    if (sentenceList.length > 0 && currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
      setValidationResult(null);
      setTranscript('');
      setCanGoNext(false);
      resetTimers();
    }
  };

  const handlePlaySentence = async () => {
    if (currentSentence) {
      await playText(currentSentence.text);
      // TTS 재생 후 duration 설정
      const duration = getAudioDuration();
      if (duration > 0) {
        dispatch(setReferenceAudioDuration({ duration }));
      }
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
    setCanGoNext(false);
    setEvaluationResult(null);
    setRecordingDuration(0);
    resetTimers();

    recordingStartTimeRef.current = Date.now();
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

      const preferred = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus'];
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
        whisperRecorderRef.current = null;
        setIsWhisperRecording(false);

        const startedAt = recordingStartTimeRef.current || Date.now();
        const durationMs = Math.max(0, Date.now() - startedAt);
        setLastTotalDurationMs(durationMs);
        setLastSpeechDurationMs(durationMs);
        setTotalTimeMs((t) => t + durationMs);

        setIsTranscribing(true);
        try {
          const whisperText = await whisperTranscribe(audioBlob, {
            prompt: currentSentence?.text,
            backend: 'webgpu',
            vad: true,
            trimThreshold: 0.003,
            trimPaddingSec: 0.1,
          });
          const transcribedText = String(whisperText || '').trim();
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

          dispatch(completePractice({ userSpeakingTime: durationMs }));
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
                      disabled={isSpeaking || !currentSentence}
                      sx={{
                        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                      }}
                    >
                      {isSpeaking ? '재생 중...' : '듣기'}
                    </Button>
                    <Button
                      variant={isRecordingNow ? 'contained' : 'outlined'}
                      color={isRecordingNow ? 'error' : 'primary'}
                      startIcon={isRecordingNow ? <MicOff /> : <Mic />}
                      onClick={toggleRecording}
                      disabled={!currentSentence || whisperStatus !== 'ready'}
                    >
                      {whisperStatus === 'loading'
                        ? '모델 로딩 중...'
                        : isRecordingNow
                          ? `중지 (${Math.floor((MAX_RECORDING_DURATION - recordingDuration) / 1000)}초)`
                          : '녹음'}
                    </Button>
                    <Button
                      variant="outlined"
                      startIcon={<SkipNext />}
                      onClick={handleNext}
                      disabled={currentIndex >= sentenceList.length - 1 || isRecordingNow || !canGoNext}
                    >
                      다음
                    </Button>
                  </Stack>

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

        {/* 중단 영역: 발화 상태 */}
        <Card elevation={2} sx={{ mb: 3 }}>
          <CardContent>
            <Stack spacing={2}>
              {/* 발화 표시기 */}
              <Box sx={{ textAlign: 'center' }}>
                <Chip
                  icon={isWhisperRecording ? <Mic /> : <MicOff />}
                  label={isWhisperRecording ? '🎤 녹음 중...' : '대기'}
                  color={isWhisperRecording ? 'success' : 'default'}
                  sx={{ fontSize: '1rem', py: 2, px: 1 }}
                />
              </Box>

              {/* 시간 표시 */}
              <Stack direction="row" spacing={4} justifyContent="center">
                <Box sx={{ textAlign: 'center' }}>
                  <Typography variant="h5" sx={{ fontWeight: 700 }}>
                    {formatTime(lastSpeechDurationMs)}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    발음 시간
                  </Typography>
                </Box>
                <Box sx={{ textAlign: 'center' }}>
                  <Typography variant="h5" sx={{ fontWeight: 700 }}>
                    {formatTime(lastTotalDurationMs)}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    전체 시간
                  </Typography>
                </Box>
                <Box sx={{ textAlign: 'center' }}>
                  <Typography variant="h5" sx={{ fontWeight: 700, color: 'primary.main' }}>
                    {lastTotalDurationMs > 0 ? Math.round((lastSpeechDurationMs / lastTotalDurationMs) * 100) : 0}%
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    발음 비율
                  </Typography>
                </Box>
              </Stack>

              {/* 프로그레스 바 */}
              <Box>
                <LinearProgress
                  variant="determinate"
                  value={lastTotalDurationMs > 0 ? Math.round((lastSpeechDurationMs / lastTotalDurationMs) * 100) : 0}
                  sx={{
                    height: 10,
                    borderRadius: 5,
                    bgcolor: '#e0e0e0',
                    '& .MuiLinearProgress-bar': {
                      background: 'linear-gradient(90deg, #667eea 0%, #764ba2 100%)',
                    },
                  }}
                />
              </Box>
            </Stack>
          </CardContent>
        </Card>

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
                <Typography variant="h6" sx={{ fontWeight: 700 }}>
                  {netDensity.toFixed(1)}%
                </Typography>
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

      </Box>
    </StudentLayout>
  );
}
