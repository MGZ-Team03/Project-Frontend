import { useState, useRef, useEffect, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
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
  Replay,
  Visibility,
  VisibilityOff,
  GridOn,
} from '@mui/icons-material';
import StudentLayout from '../../components/common/StudentLayout';

// Hooks
import { useMediaPipe } from '../../hooks/conversation/useMediaPipe';
import { useAudioDetection } from '../../hooks/conversation/useAudioDetection';
import { useSpeakingTimer } from '../../hooks/conversation/useSpeakingTimer';
import { useTTS } from '../../hooks/conversation/useTTS';
import { useSpeechRecognition } from '../../hooks/conversation/useSpeechRecognition';
import { useClaudeSentenceGenerator } from '../../hooks/conversation/useClaudeSentenceGenerator';

// Data & Utils
import { sentences } from '../../data/conversation/sentences';
import { validateSentence } from '../../utils/conversation/sentenceValidator';
import { getScenarioById } from '../../data/conversation/scenarios';
import { isApiKeyConfigured } from '../../service/conversation/claudeClient';
import { buildTopicBatchSentencePrompt } from '../../utils/conversation/sentencePromptBuilder';

// Prevent duplicate calls (StrictMode mount/unmount) + add simple cache
const sentenceBatchInFlight = new Map(); // key -> Promise<string[]>
const sentenceBatchCache = new Map(); // key -> { sentences: {id,text}[], savedAt: number }

export default function PracticePage() {
  const location = useLocation();
  const navigate = useNavigate();

  // Refs
  const videoRef = useRef(null);
  const canvasRef = useRef(null);

  // Get difficulty from navigation state, default to '중'
  const difficulty = location.state?.difficulty || '중';
  const topicId = location.state?.topicId || 'restaurant';
  const topic = useMemo(() => getScenarioById(topicId) || getScenarioById('restaurant'), [topicId]);

  // State
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isRecording, setIsRecording] = useState(false);
  const [showMouthLandmarks, setShowMouthLandmarks] = useState(false);
  const [showGrid, setShowGrid] = useState(false);
  const [validationResult, setValidationResult] = useState(null);
  const [transcript, setTranscript] = useState('');
  const [hasCameraPermission, setHasCameraPermission] = useState(null);
  const [permissionError, setPermissionError] = useState(null);
  const [practiceSentences, setPracticeSentences] = useState([]); // { id, text }[]
  const [isSentenceLoading, setIsSentenceLoading] = useState(false);
  const [sentenceError, setSentenceError] = useState(null);
  const [hasApiKey, setHasApiKey] = useState(true);
  const lastLoadKeyRef = useRef(null);

  // Hooks
  const { landmarksRef, isModelLoaded, error: mediaPipeError } = useMediaPipe(
    videoRef,
    canvasRef,
    { showGrid, showMouthLandmarks }
  );

  const { audioVolume, error: audioError, isInitialized: isAudioInit } =
    useAudioDetection(isRecording);

  const { totalTime, speakingTime, ratio, currentlySpeaking, resetTimers } =
    useSpeakingTimer(isRecording, landmarksRef, audioVolume);

  const { speak, stop, isSpeaking } = useTTS();

  const { isSupported: sttSupported, transcript: sttTranscript } =
    useSpeechRecognition(
      isRecording,
      (text) => setTranscript(text),
      (error) => console.error('STT Error:', error)
    );

  const { generateBatchSentences } = useClaudeSentenceGenerator();

  // API Key check
  useEffect(() => {
    setHasApiKey(isApiKeyConfigured());
  }, []);

  // Load/generate sentences by topic + difficulty
  useEffect(() => {
    let cancelled = false;
    const loadKey = `${topicId}:${difficulty}`;

    // Avoid re-loading the exact same key repeatedly (e.g., due to unrelated rerenders)
    if (lastLoadKeyRef.current === loadKey && practiceSentences.length > 0) return;
    lastLoadKeyRef.current = loadKey;

    const load = async () => {
      setIsSentenceLoading(true);
      setSentenceError(null);

      try {
        // If no API key, fallback immediately
        if (!hasApiKey) {
          const fallback = sentences.slice(0, 10).map((s) => ({ id: s.id, text: s.text }));
          if (!cancelled) setPracticeSentences(fallback);
          return;
        }

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
          const systemPrompt = buildTopicBatchSentencePrompt(topic, difficulty, 10);
          promise = generateBatchSentences(systemPrompt, difficulty);
          sentenceBatchInFlight.set(loadKey, promise);
        }

        const generated = await promise;

        // Normalize to {id,text}
        const normalized = (generated || [])
          .filter((t) => typeof t === 'string' && t.trim().length > 0)
          .slice(0, 10)
          .map((text, idx) => ({ id: `${topicId}-${difficulty}-${idx}`, text: text.trim() }));

        const finalList =
          normalized.length > 0
            ? normalized
            : sentences.slice(0, 10).map((s) => ({ id: s.id, text: s.text }));

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
        if (!cancelled) {
          const isRateLimit =
            err?.status === 429 ||
            err?.response?.status === 429 ||
            String(err?.message || '').includes('rate_limit') ||
            String(err?.message || '').includes('429');

          setSentenceError(
            isRateLimit
              ? 'Claude 요청이 너무 많아(429) 잠시 후 다시 시도해주세요.'
              : (err?.message || '문장 생성에 실패했습니다.')
          );
          const fallback = sentences.slice(0, 10).map((s) => ({ id: s.id, text: s.text }));
          setPracticeSentences(fallback);
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
  }, [topicId, topic, difficulty, hasApiKey, generateBatchSentences, resetTimers]);

  // Current sentence
  // API 호출 전에는 기본 문장(목업) 노출하지 않음. (에러/키없음 시에는 practiceSentences에 fallback이 들어감)
  const sentenceList = practiceSentences;
  const currentSentence = sentenceList[currentIndex];

  // Request camera permission
  useEffect(() => {
    const requestCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
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
      if (videoRef.current?.srcObject) {
        const tracks = videoRef.current.srcObject.getTracks();
        tracks.forEach((track) => track.stop());
      }
    };
  }, []);

  // Validate when transcript changes
  useEffect(() => {
    if (transcript && currentSentence) {
      const result = validateSentence(currentSentence.text, transcript);
      setValidationResult(result);

      // Auto-advance if passed
      if (result.passed && currentIndex < sentenceList.length - 1) {
        setTimeout(() => handleNext(), 2000);
      }
    }
  }, [transcript, currentSentence, currentIndex, sentenceList.length]);

  // Handlers
  const handleNext = () => {
    if (sentenceList.length > 0 && currentIndex < sentenceList.length - 1) {
      setCurrentIndex(currentIndex + 1);
      setValidationResult(null);
      setTranscript('');
      resetTimers();
    }
  };

  const handlePrev = () => {
    if (sentenceList.length > 0 && currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
      setValidationResult(null);
      setTranscript('');
      resetTimers();
    }
  };

  const handlePlaySentence = () => {
    if (currentSentence) {
      speak(currentSentence.text, { lang: 'en-US', rate: 0.9 });
    }
  };

  const toggleRecording = () => {
    if (isRecording) {
      setIsRecording(false);
    } else {
      setValidationResult(null);
      setTranscript('');
      resetTimers();
      setIsRecording(true);
    }
  };

  const formatTime = (ms) => {
    const seconds = Math.floor(ms / 1000);
    return `${seconds}초`;
  };

  return (
    <StudentLayout todayTime={Math.floor(totalTime / 1000 / 60)}>
      <Box sx={{ maxWidth: 1200, mx: 'auto', width: '100%' }}>
        {/* API Key Warning */}
        {!hasApiKey && (
          <Alert severity="warning" sx={{ mb: 2 }}>
            Claude API 키가 설정되지 않았습니다. .env.local 파일에 VITE_CLAUDE_API_KEY를 추가해주세요. (임시 문장으로 진행 중)
          </Alert>
        )}

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
            {sentenceError} (임시 문장으로 진행 중)
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
                  <Button
                    variant="contained"
                    startIcon={<VolumeUp />}
                    onClick={handlePlaySentence}
                    disabled={isSpeaking || !currentSentence}
                    sx={{
                      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                      px: 4,
                    }}
                  >
                    {isSpeaking ? '재생 중...' : '듣기'}
                  </Button>
                </Box>

                {/* 난이도 표시 */}
                <Box sx={{ textAlign: 'center' }}>
                  <Stack direction="row" spacing={1} justifyContent="center" flexWrap="wrap">
                    <Chip label={`주제: ${topic?.title || topicId}`} color="secondary" size="small" />
                    <Chip label={`난이도: ${difficulty}`} color="primary" size="small" />
                  </Stack>
                </Box>
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
                  icon={currentlySpeaking ? <Mic /> : <MicOff />}
                  label={currentlySpeaking ? '🎤 발음 중...' : '준비'}
                  color={currentlySpeaking ? 'success' : 'default'}
                  sx={{ fontSize: '1rem', py: 2, px: 1 }}
                />
              </Box>

              {/* 시간 표시 */}
              <Stack direction="row" spacing={4} justifyContent="center">
                <Box sx={{ textAlign: 'center' }}>
                  <Typography variant="h5" sx={{ fontWeight: 700 }}>
                    {formatTime(speakingTime)}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    발음 시간
                  </Typography>
                </Box>
                <Box sx={{ textAlign: 'center' }}>
                  <Typography variant="h5" sx={{ fontWeight: 700 }}>
                    {formatTime(totalTime)}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    전체 시간
                  </Typography>
                </Box>
                <Box sx={{ textAlign: 'center' }}>
                  <Typography variant="h5" sx={{ fontWeight: 700, color: 'primary.main' }}>
                    {ratio}%
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
                  value={ratio}
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

        {/* 하단 영역: 검증 & 컨트롤 */}
        <Card elevation={2}>
          <CardContent>
            <Stack spacing={3}>
              {/* STT 결과 */}
              {transcript && (
                <Box>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                    인식된 텍스트:
                  </Typography>
                  <Typography variant="body1" sx={{ fontStyle: 'italic', color: 'text.primary' }}>
                    "{transcript}"
                  </Typography>
                </Box>
              )}

              {/* 검증 피드백 */}
              {validationResult && (
                <Alert
                  severity={validationResult.passed ? 'success' : 'warning'}
                  sx={{ borderRadius: 2 }}
                >
                  <Typography variant="body2" sx={{ fontWeight: 600, mb: 1 }}>
                    점수: {validationResult.score}점
                  </Typography>
                  <Typography variant="body2">{validationResult.feedback.message}</Typography>
                </Alert>
              )}

              {/* 컨트롤 버튼 */}
              <Stack direction="row" spacing={2} justifyContent="center">
                <Button
                  variant="outlined"
                  startIcon={<SkipPrevious />}
                  onClick={handlePrev}
                  disabled={currentIndex === 0 || isRecording}
                >
                  이전
                </Button>

                <Button
                  variant="outlined"
                  startIcon={<Replay />}
                  onClick={handlePlaySentence}
                  disabled={isSpeaking || isRecording}
                >
                  다시 듣기
                </Button>

                <Button
                  variant="contained"
                  startIcon={isRecording ? <MicOff /> : <Mic />}
                  onClick={toggleRecording}
                  color={isRecording ? 'error' : 'primary'}
                  sx={{
                    background: isRecording
                      ? undefined
                      : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  }}
                >
                  {isRecording ? '녹음 중지' : '녹음 시작'}
                </Button>

                <Button
                  variant="outlined"
                  endIcon={<SkipNext />}
                  onClick={handleNext}
                  disabled={currentIndex === sentenceList.length - 1 || isRecording}
                >
                  다음
                </Button>
              </Stack>
            </Stack>
          </CardContent>
        </Card>
      </Box>
    </StudentLayout>
  );
}
