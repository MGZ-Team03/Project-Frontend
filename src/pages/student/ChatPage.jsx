import {useState, useRef, useEffect, useCallback} from 'react';
import { useLocation, useNavigate} from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import {
  Box,
  Typography,
  Button,
  Card,
  CardContent,
  Stack,
  TextField,
  Avatar,
  Chip,
  IconButton,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  Alert,
  CircularProgress,
  LinearProgress,
} from '@mui/material';
import {
  VolumeUp,
  Mic,
  MicOff,
  SmartToy,
  Person,
  Send,
  Visibility,
  VisibilityOff,
  GridOn,
  Feedback,
  LightbulbOutlined,
} from '@mui/icons-material';
import StudentLayout from '../../components/common/StudentLayout';

// Hooks
import { useMediaPipe } from '../../hooks/conversation/useMediaPipe';
import { useWhisperSTT } from '../../hooks/useWhisperSTT';
import { startAiChat, sendAiChatMessage } from '../../api/aiChat';
import { getRecommendedSentences, getSentenceFeedback } from '../../api/sentences';
import { useTTSAudio } from '../../hooks/useTTSAudio';
import { toApiDifficulty, toApiTopic } from '../../utils/apiMappers';
import { selectWhisperPreloadStatus } from '../../store/slices/whisperPreloadSlice';



import useWebSocket from "../../hooks/webSocket/useWebSocket.js";
// Data
import { scenarios, getScenarioById } from '../../data/conversation/scenarios';

// Redux
import {
  startSession,
  endSession,
  userSpeakingStarted,
  userSpeakingEnded,
  systemLoadingStarted,
  systemLoadingEnded,
} from '../../store/slices/speakingStatsSlice';
import {
  selectLastResponseLatency,
  selectSessionAvgResponseLatency,
  selectNetSpeakingDensity,
  getResponseLatencyFeedback,
  getNetSpeakingDensityFeedback,
} from '../../store/selectors/speakingStatsSelectors';
// server-backed chat + TTS

export default function ChatPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const dispatch = useDispatch();

  // Redux selectors
  const lastLatency = useSelector(selectLastResponseLatency);
  const avgLatency = useSelector(selectSessionAvgResponseLatency);
  const netDensity = useSelector(selectNetSpeakingDensity);

  // Refs
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const cameraStreamRef = useRef(null);
  const messagesEndRef = useRef(null);
  const initialMessageSentRef = useRef(false);
  const lastAutoSpokenRef = useRef(null);
  const conversationIdRef = useRef(null);
  const prevSpeakingRef = useRef(false);
  const sttStatusMsgIdRef = useRef(1);
  const stopDebounceTimerRef = useRef(null);
  const [isWhisperRecording, setIsWhisperRecording] = useState(false);
  const whisperStreamRef = useRef(null);
  const whisperRecorderRef = useRef(null);
  const whisperChunksRef = useRef([]);
  const whisperStartedAtRef = useRef(null);

  // Get difficulty and scenario from navigation state
  const difficulty = location.state?.difficulty || '중';
  const initialScenario = location.state?.scenario || 'small_talk';

  // State - Scenario
  const [currentScenario, setCurrentScenario] = useState(initialScenario);

  // State - Messages
  const [messages, setMessages] = useState([]);
  const [revealedMessages, setRevealedMessages] = useState(new Set());
  const [messageFeedback, setMessageFeedback] = useState({}); // messageIndex -> feedback data
  const [feedbackLoading, setFeedbackLoading] = useState({}); // messageIndex -> loading state
  const [suggestedReplies, setSuggestedReplies] = useState([]); // AI 응답 후 추천 문장들
  const [suggestLoading, setSuggestLoading] = useState(false); // 추천 문장 로딩 상태
  const [conversationEnded, setConversationEnded] = useState(false); // 대화 종료 여부
  const [endReason, setEndReason] = useState(null); // 종료 이유

  // State - Input
  const [inputText, setInputText] = useState('');
  const [currentSpeakingTime, setCurrentSpeakingTime] = useState(0);
  const [totalTimeMs, setTotalTimeMs] = useState(0);
  const [lastTotalDurationMs, setLastTotalDurationMs] = useState(0);
  const [lastSpeechDurationMs, setLastSpeechDurationMs] = useState(0);

  // State - UI
  const [showMouthLandmarks, setShowMouthLandmarks] = useState(false);
  const [showGrid, setShowGrid] = useState(false);
  const [hasCameraPermission, setHasCameraPermission] = useState(null);
  const [permissionError, setPermissionError] = useState(null);
  const [isChatInitLoading, setIsChatInitLoading] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [sttError, setSttError] = useState(null);

  // Hooks - MediaPipe
  const { landmarksRef, isModelLoaded, error: mediaPipeError } = useMediaPipe(
    videoRef,
    canvasRef,
    { showGrid, showMouthLandmarks }
  );

  // Hooks - Whisper STT (WebGPU 전용)
  const {
    transcribe: whisperTranscribe,
    error: whisperError,
  } = useWhisperSTT();

  const user = useSelector(state => state.auth.user);

  const getData = useCallback(() => {
    if(!user?.email) return null;

    return {
      action: "status",
      data:{
        tutorEmail: user.tutorEmail || "unknown@example.com",
        studentEmail: user.email,
        status: "active",
        room: "ai",
        assignedAt: new Date().toISOString().split("T")[0],
      }
    };
  }, [user?.email, user?.tutorEmail]);

// ✅ 함수 자체를 전달 (실행하지 않음!)
  useWebSocket(getData);

  // Redux에서 전역 Whisper 상태 가져오기
  const whisperStatus = useSelector(selectWhisperPreloadStatus);

  // Debug: record microphone in parallel (for replay)

  // sttEngine useEffect 제거됨 (Whisper 전용)

  useEffect(() => {
    return () => {
      if (whisperRecorderRef.current && whisperRecorderRef.current.state === 'recording') {
        try {
          whisperRecorderRef.current.stop();
        } catch (_) {}
      }
      whisperRecorderRef.current = null;
      whisperChunksRef.current = [];
      if (whisperStreamRef.current) {
        whisperStreamRef.current.getTracks().forEach((t) => {
          try { t.enabled = false; } catch (_) {}
          try { t.stop(); } catch (_) {}
        });
        whisperStreamRef.current = null;
      }
    };
  }, []);

  // Hooks - Server TTS
  const { playText, stop: stopTTS, isPlaying: isSpeaking, ttsStatus } = useTTSAudio();
  const [aiError, setAiError] = useState(null);
  const [isAILoading, setIsAILoading] = useState(false);

  // Camera permission
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
      if (cameraStreamRef.current) {
        cameraStreamRef.current.getTracks().forEach((track) => track.stop());
        cameraStreamRef.current = null;
      }
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
    };
  }, []);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (stopDebounceTimerRef.current) {
        clearTimeout(stopDebounceTimerRef.current);
        stopDebounceTimerRef.current = null;
      }
    };
  }, []);

  // Redux: 세션 시작/종료
  useEffect(() => {
    dispatch(startSession({ sessionType: 'chat' }));
    return () => {
      dispatch(endSession());
    };
  }, [dispatch]);

  // Redux: Response Latency용 발화 시작/종료는 Web Speech 시작/종료 시점으로 계산

  // Redux: AI 응답 로딩 상태 추적
  useEffect(() => {
    if (isAILoading) {
      dispatch(systemLoadingStarted());
    } else {
      dispatch(systemLoadingEnded());
    }
  }, [isAILoading, dispatch]);

  // Send initial message when scenario changes (prevent double call in StrictMode)
  useEffect(() => {
    if (!initialMessageSentRef.current) {
      initialMessageSentRef.current = true;
      sendInitialMessage();
    }

    return () => {
      // Cleanup: reset ref when component unmounts
      initialMessageSentRef.current = false;
    };
  }, [currentScenario]);

  // Auto scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Initial AI message
  const sendInitialMessage = async () => {
    try {
      setAiError(null);
      setIsChatInitLoading(true);
      setMessages([]);
      setRevealedMessages(new Set());
      conversationIdRef.current = null;

      const startRes = await startAiChat({
        topic: toApiTopic(currentScenario),
        difficulty: toApiDifficulty(difficulty),
      });
      console.log('Start chat response:', startRes);
      const conversationId = startRes?.conversationId;
      if (!conversationId) throw new Error('conversationId가 없습니다.');
      conversationIdRef.current = conversationId;
      console.log('ConversationId set:', conversationId);

      const initialAssistant =
        startRes?.aiMessage || startRes?.assistantMessage || startRes?.message || startRes?.content || null;

      if (initialAssistant) {
        setMessages([
          { role: 'assistant', content: initialAssistant, streaming: false, timestamp: new Date() },
        ]);
        lastAutoSpokenRef.current = null;
        await playText(initialAssistant);
      }
    } catch (error) {
      console.error('Initial message error:', error);
      setAiError(error);
    }
    finally {
      setIsChatInitLoading(false);
    }
  };

  // 사용자 메시지에 대한 피드백 요청
  const handleRequestFeedback = async (messageIndex, userMessage) => {
    // 이전 AI 메시지를 originalText로 사용 (대화 맥락상 AI가 말한 것에 대한 사용자 응답)
    const prevMessages = messages.slice(0, messageIndex);
    const lastAiMessage = [...prevMessages].reverse().find(m => m.role === 'assistant');
    const originalText = lastAiMessage?.content || '';

    setFeedbackLoading((prev) => ({ ...prev, [messageIndex]: true }));

    try {
      const response = await getSentenceFeedback({
        originalText,
        userText: userMessage,
        difficulty: toApiDifficulty(difficulty),
      });

      setMessageFeedback((prev) => ({
        ...prev,
        [messageIndex]: response,
      }));
    } catch (error) {
      console.error('Feedback request error:', error);
      setMessageFeedback((prev) => ({
        ...prev,
        [messageIndex]: { error: error.message || '피드백을 가져오는데 실패했습니다.' },
      }));
    } finally {
      setFeedbackLoading((prev) => ({ ...prev, [messageIndex]: false }));
    }
  };

  // AI 응답 후 추천 문장 생성
  const generateSuggestedReplies = async () => {
    setSuggestLoading(true);
    setSuggestedReplies([]);

    try {
      const response = await getRecommendedSentences({
        topic: toApiTopic(currentScenario),
        difficulty: toApiDifficulty(difficulty),
        count: 3,
        conversationId: conversationIdRef.current, // 대화 중이면 턴 차감
      });

      const sentences = (response?.sentences || []).map(s =>
        typeof s === 'string' ? s : s?.text
      ).filter(Boolean);

      setSuggestedReplies(sentences);
    } catch (error) {
      console.error('Suggest replies error:', error);
      setSuggestedReplies([]);
    } finally {
      setSuggestLoading(false);
    }
  };

  // Mic toggle handler (Whisper only)
  const handleMicToggle = async () => {
    if (isWhisperRecording) {
      // 수동 stop(끝자락 잘림 방지)
      if (stopDebounceTimerRef.current) return;
      stopDebounceTimerRef.current = setTimeout(() => {
        try {
          whisperRecorderRef.current?.stop?.();
        } catch (_) {}
        stopDebounceTimerRef.current = null;
      }, 500);
      return;
    }

    setInputText('');
    setSttError(null);

    const sttMsgId = `stt-${Date.now()}-${sttStatusMsgIdRef.current++}`;
    dispatch(userSpeakingStarted({ startTime: Date.now() }));
    prevSpeakingRef.current = true;

    try {
      // Whisper only
      setIsTranscribing(false);

      setMessages((prev) => [
        ...prev,
        { role: 'system', content: '🎤 녹음 중... (다시 누르면 종료 후 인식)', streaming: true, timestamp: new Date(), id: sttMsgId },
      ]);

      whisperChunksRef.current = [];
      whisperStartedAtRef.current = Date.now();
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

        if (whisperStreamRef.current) {
          whisperStreamRef.current.getTracks().forEach((t) => {
            try { t.enabled = false; } catch (_) {}
            try { t.stop(); } catch (_) {}
          });
          whisperStreamRef.current = null;
        }
        whisperRecorderRef.current = null;
        setIsWhisperRecording(false);

        const durationMs = Math.max(0, Date.now() - (whisperStartedAtRef.current || Date.now()));
        setCurrentSpeakingTime(durationMs / 1000);
        setLastTotalDurationMs(durationMs);
        setLastSpeechDurationMs(durationMs);
        setTotalTimeMs((t) => t + durationMs);

        setIsTranscribing(true);
        try {
          const text = String(
            await whisperTranscribe(audioBlob, { backend: 'webgpu', vad: true, trimThreshold: 0.003, trimPaddingSec: 0.1 })
          ).trim();
          if (text) setInputText(text);
          setMessages((prev) =>
            prev.map((m) =>
              m?.id === sttMsgId
                ? { ...m, content: `🎤 인식 결과: ${text || '(인식 실패)'}`, streaming: false }
                : m
            )
          );
        } catch (e) {
          const errMsg = e?.message || String(e);
          setSttError(errMsg);
          setMessages((prev) =>
            prev.map((m) =>
              m?.id === sttMsgId ? { ...m, content: `⚠️ 음성 인식 실패: ${errMsg}`, streaming: false } : m
            )
          );
        } finally {
          setIsTranscribing(false);
        }
      };

      recorder.start();
      setIsWhisperRecording(true);
      return; // now recording; stop on next click
    } catch (e) {
      console.error('STT error:', e);
      const errMsg = e?.message || String(e);
      setSttError(errMsg);
      setMessages((prev) =>
        prev.map((m) =>
          m?.id === sttMsgId ? { ...m, content: `⚠️ 음성 인식 실패: ${errMsg}`, streaming: false } : m
        )
      );
    } finally {
      setIsTranscribing(false);
      if (prevSpeakingRef.current) {
        dispatch(userSpeakingEnded());
        prevSpeakingRef.current = false;
      }
    }
  };

  // Send message handler
  const handleSendMessage = async () => {
    if (isTranscribing) return;
    if (!inputText.trim() || isAILoading) return;
    if (!conversationIdRef.current) {
      console.error('No conversationId available');
      return;
    }
    console.log('Sending message with conversationId:', conversationIdRef.current);

    // Add user message
    const userMessage = {
      role: 'user',
      content: inputText,
      speakingTime: currentSpeakingTime || null,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMessage]);

    // Save message to send
    const messageToSend = inputText;
    setInputText('');
    setCurrentSpeakingTime(0);

    try {
      setAiError(null);
      setIsAILoading(true);

      // show pending assistant bubble
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: '...', streaming: true, timestamp: new Date() },
      ]);

      const res = await sendAiChatMessage({
        conversationId: conversationIdRef.current,
        userMessage: messageToSend,
      });

      const assistantText = res?.aiMessage || res?.assistantMessage || res?.message || res?.content || '';

      // 턴 제한 체크
      if (res?.ended === true && res?.reason === 'TURN_LIMIT') {
        setConversationEnded(true);
        setEndReason('TURN_LIMIT');
      }

      // replace last streaming assistant bubble
      setMessages((prev) => {
        const next = [...prev];
        const last = next[next.length - 1];
        if (last?.role === 'assistant' && last.streaming) {
          next[next.length - 1] = {
            ...last,
            content: assistantText,
            streaming: false,
          };
        } else {
          next.push({ role: 'assistant', content: assistantText, streaming: false, timestamp: new Date() });
        }
        return next;
      });

      // AI 응답 후 추천 문장 초기화 (버튼 클릭 시 생성)
      setSuggestedReplies([]);

      // auto TTS
      if (assistantText) {
        if (lastAutoSpokenRef.current !== assistantText) {
          lastAutoSpokenRef.current = assistantText;
          await playText(assistantText);
        }
      }
    } catch (error) {
      console.error('Send message error:', error);
      setAiError(error);
      // mark pending bubble as error
      setMessages((prev) => {
        const next = [...prev];
        const last = next[next.length - 1];
        if (last?.role === 'assistant' && last.streaming) {
          next[next.length - 1] = {
            ...last,
            content: 'AI 응답 오류',
            streaming: false,
          };
        }
        return next;
      });
    } finally {
      setIsAILoading(false);
    }
  };

  // Play AI message with TTS
  const handlePlayAIMessage = (content) => {
    if (!content) return;
    stopTTS();
    playText(content);
  };

  // Reveal AI message
  const handleRevealMessage = (index) => {
    setRevealedMessages(prev => {
      const newSet = new Set(prev);
      newSet.add(index);
      return newSet;
    });
  };

  const formatTime = (ms) => {
    const seconds = Math.floor(ms / 1000);
    return `${seconds}초`;
  };

  const scenario = getScenarioById(currentScenario);
  const isRecordingNow = isWhisperRecording;

  return (
    <StudentLayout todayTime={Math.floor(totalTimeMs / 1000 / 60)}>
      <Box sx={{ maxWidth: 1400, mx: 'auto', width: '100%', height: 'calc(100vh - 200px)' }}>
        {/* Permission Error */}
        {hasCameraPermission === false && (
          <Alert severity="error" sx={{ mb: 2 }}>
            카메라 권한이 필요합니다. 브라우저 설정에서 권한을 허용해주세요.
          </Alert>
        )}

        {/* MediaPipe Loading */}
        {!isModelLoaded && hasCameraPermission && (
          <Alert severity="info" sx={{ mb: 2 }}>
            <CircularProgress size={20} sx={{ mr: 1 }} />
            얼굴 인식 모델 로딩 중...
          </Alert>
        )}

        {/* AI Error */}
        {aiError && (
          <Alert severity="error" sx={{ mb: 2 }}>
            AI 응답 오류: {aiError.message || String(aiError)}
          </Alert>
        )}

        {isChatInitLoading && (
          <Alert severity="info" sx={{ mb: 2 }}>
            <CircularProgress size={20} sx={{ mr: 1 }} />
            대화 준비 중...
          </Alert>
        )}

        {/* STT 상태 - 모델 로딩은 StudentLayout 배너에서 표시 */}
        {isTranscribing && (
          <Alert severity="info" sx={{ mb: 2 }}>
            <CircularProgress size={16} sx={{ mr: 1 }} />
            음성 인식 중...
          </Alert>
        )}
        {(sttError || whisperError) && (
          <Alert severity="warning" sx={{ mb: 2 }}>
            STT 오류: {sttError || whisperError}
          </Alert>
        )}


        {/* TTS Generating */}
        {ttsStatus === 'generating' && (
          <Alert severity="info" sx={{ mb: 2 }}>
            <CircularProgress size={16} sx={{ mr: 1 }} />
            오디오 생성 중...
          </Alert>
        )}

        {/* AI Loading */}
        {isAILoading && (
          <Alert severity="info" sx={{ mb: 2 }}>
            <CircularProgress size={16} sx={{ mr: 1 }} />
            AI 응답 대기 중...
          </Alert>
        )}

        {/* Main Layout */}
        <Stack direction="row" spacing={2} sx={{ height: '100%' }}>
          {/* Left: Camera Area */}
          <Box sx={{ flex: '0 0 400px', display: 'flex', flexDirection: 'column', gap: 2 }}>
            {/* Webcam Preview */}
            <Card elevation={2}>
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
                <Box
                  sx={{
                    position: 'relative',
                    width: '100%',
                    aspectRatio: '4/3',
                    bgcolor: '#000',
                    borderRadius: 2,
                    overflow: 'hidden',
                  }}
                >
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

            {/* Speaking Status */}
            <Card elevation={2}>
              <CardContent>
                <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>
                  발화 상태
                </Typography>
                <Stack spacing={2}>
                  {/* Speaking Indicator */}
                  <Box sx={{ textAlign: 'center' }}>
                    <Chip
                      icon={isRecordingNow ? <Mic /> : <MicOff />}
                      label={isRecordingNow ? '🎤 인식/녹음 중...' : '대기'}
                      color={isRecordingNow ? 'success' : 'default'}
                      sx={{ fontSize: '1rem', py: 2, px: 1 }}
                    />
                  </Box>

                  {/* Time Display */}
                  <Stack direction="row" spacing={2} justifyContent="center">
                    <Box sx={{ textAlign: 'center' }}>
                      <Typography variant="h6" sx={{ fontWeight: 700 }}>
                        {formatTime(lastSpeechDurationMs)}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        발음 시간
                      </Typography>
                    </Box>
                    <Box sx={{ textAlign: 'center' }}>
                      <Typography variant="h6" sx={{ fontWeight: 700 }}>
                        {formatTime(lastTotalDurationMs)}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        전체 시간
                      </Typography>
                    </Box>
                  </Stack>

                  {/* Progress Bar */}
                  <Box>
                    <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>
                      발음 비율: {lastTotalDurationMs > 0 ? Math.round((lastSpeechDurationMs / lastTotalDurationMs) * 100) : 0}%
                    </Typography>
                    <LinearProgress
                      variant="determinate"
                      value={lastTotalDurationMs > 0 ? Math.round((lastSpeechDurationMs / lastTotalDurationMs) * 100) : 0}
                      sx={{
                        height: 8,
                        borderRadius: 4,
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

            {/* Speaking Statistics */}
            <Card elevation={2}>
              <CardContent>
                <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>
                  📊 통계
                </Typography>
                <Stack spacing={2}>
                  {/* Response Latency */}
                  <Box>
                    <Typography variant="body2" color="text.secondary" gutterBottom>
                      반응 속도 (Response Latency)
                    </Typography>
                    <Stack direction="row" spacing={2}>
                      <Box sx={{ flex: 1 }}>
                        <Typography variant="h6" sx={{ fontWeight: 700 }}>
                          {lastLatency ? `${(lastLatency / 1000).toFixed(1)}초` : '-'}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          마지막
                        </Typography>
                      </Box>
                      <Box sx={{ flex: 1 }}>
                        <Typography variant="h6" sx={{ fontWeight: 700 }}>
                          {avgLatency ? `${(avgLatency / 1000).toFixed(1)}초` : '-'}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          평균
                        </Typography>
                      </Box>
                    </Stack>
                    {lastLatency && (
                      <Chip
                        label={getResponseLatencyFeedback(lastLatency).message}
                        size="small"
                        sx={{
                          mt: 1,
                          bgcolor: getResponseLatencyFeedback(lastLatency).color + '.100',
                          color: getResponseLatencyFeedback(lastLatency).color + '.800',
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

          {/* Right: Chat Area */}
          <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2, minHeight: 0 }}>
            {/* Header */}
            <Card elevation={2}>
              <CardContent>
                <Stack direction="row" alignItems="center" spacing={2}>
                  <Chip
                    label={`주제: ${getScenarioById(currentScenario)?.title || '레스토랑 주문'}`}
                    size="small"
                    color="secondary"
                  />
                  <Chip label={`난이도: ${difficulty}`} size="small" color="primary" />
                  <Box sx={{ flexGrow: 1 }} />
                  <Typography variant="body2" color="text.secondary">
                    총 대화 시간: {formatTime(totalTimeMs)}
                  </Typography>
                </Stack>
              </CardContent>
            </Card>

            {/* Messages Area */}
            <Card elevation={2} sx={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
              <CardContent sx={{ flex: 1, overflow: 'auto', minHeight: 0 }}>
                <List>
                  {messages.map((message, index) => (
                    <ListItem
                      key={index}
                      alignItems="flex-start"
                      sx={{
                        flexDirection: message.role === 'user' ? 'row-reverse' : 'row',
                        mb: 2,
                      }}
                    >
                      <ListItemAvatar>
                        <Avatar
                          sx={{
                            bgcolor:
                              message.role === 'assistant'
                                ? '#9C27B0'
                                : message.role === 'user'
                                  ? '#2196F3'
                                  : '#607d8b',
                          }}
                        >
                          {message.role === 'assistant' ? <SmartToy /> : message.role === 'user' ? <Person /> : <Mic />}
                        </Avatar>
                      </ListItemAvatar>
                      <ListItemText
                        sx={{
                          textAlign: message.role === 'user' ? 'right' : 'left',
                          ml: message.role === 'user' ? 0 : 2,
                          mr: message.role === 'user' ? 2 : 0,
                        }}
                        primary={
                          <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
                            <Box
                              sx={{
                                bgcolor:
                                  message.role === 'assistant'
                                    ? '#f5f5f5'
                                    : message.role === 'user'
                                      ? '#e3f2fd'
                                      : '#eceff1',
                                p: 2,
                                borderRadius: 2,
                                display: 'inline-block',
                                maxWidth: '80%',
                                position: 'relative',
                                cursor: message.role === 'assistant' && !revealedMessages.has(index) ? 'pointer' : 'default',
                              }}
                              onClick={() => {
                                if (message.role === 'assistant' && !revealedMessages.has(index) && !message.streaming) {
                                  handleRevealMessage(index);
                                }
                              }}
                            >
                              <Typography
                                variant="body1"
                                sx={{
                                  filter: message.role === 'assistant' && !revealedMessages.has(index) && !message.streaming
                                    ? 'blur(5px)'
                                    : 'none',
                                  transition: 'filter 0.3s ease',
                                }}
                              >
                                {message.content}
                                {message.streaming && (
                                  <CircularProgress size={16} sx={{ ml: 1, verticalAlign: 'middle' }} />
                                )}
                              </Typography>
                              {message.role === 'assistant' && !revealedMessages.has(index) && !message.streaming && (
                                <Box
                                  sx={{
                                    position: 'absolute',
                                    top: '50%',
                                    left: '50%',
                                    transform: 'translate(-50%, -50%)',
                                    bgcolor: 'rgba(0, 0, 0, 0.7)',
                                    color: 'white',
                                    px: 2,
                                    py: 1,
                                    borderRadius: 1,
                                    fontSize: '0.875rem',
                                    whiteSpace: 'nowrap',
                                  }}
                                >
                                  클릭하여 보기
                                </Box>
                              )}
                            </Box>

                            {/* AI 메시지: 추천 문장 버튼 (스피커 왼쪽) + 스피커 버튼 */}
                            {message.role === 'assistant' && !message.streaming && index === messages.length - 1 && (
                              <IconButton
                                size="small"
                                onClick={generateSuggestedReplies}
                                disabled={suggestLoading}
                                title="답변 추천"
                                sx={{ mt: 0.5 }}
                              >
                                {suggestLoading ? (
                                  <CircularProgress size={16} />
                                ) : (
                                  <LightbulbOutlined fontSize="small" />
                                )}
                              </IconButton>
                            )}

                            {/* Always show speaker button for assistant (even when blurred) */}
                            {message.role === 'assistant' && (
                              <IconButton
                                size="small"
                                onClick={() => handlePlayAIMessage(message.content)}
                                disabled={isSpeaking || message.streaming}
                                title="TTS 재생"
                                sx={{ mt: 0.5 }}
                              >
                                <VolumeUp fontSize="small" />
                              </IconButton>
                            )}

                            {/* 사용자 최신 메시지: 피드백 버튼 */}
                            {(() => {
                              // 마지막 사용자 메시지 인덱스 찾기 (🎤 제외)
                              const lastUserIdx = messages.reduce((acc, m, i) =>
                                m.role === 'user' && !m.content.startsWith('🎤') ? i : acc, -1);
                              return message.role === 'user' &&
                                !message.content.startsWith('🎤') &&
                                index === lastUserIdx;
                            })() && (
                                <IconButton
                                  size="small"
                                  onClick={() => handleRequestFeedback(index, message.content)}
                                  disabled={feedbackLoading[index] || !!messageFeedback[index]}
                                  title="피드백 요청"
                                  sx={{ mt: 0.5 }}
                                >
                                  {feedbackLoading[index] ? (
                                    <CircularProgress size={16} />
                                  ) : (
                                    <Feedback fontSize="small" color={messageFeedback[index] ? 'disabled' : 'primary'} />
                                  )}
                                </IconButton>
                              )}

                            {message.role === 'user' && message.speakingTime && (
                              <Chip
                                label={`${message.speakingTime.toFixed(1)}초`}
                                size="small"
                                color="primary"
                                sx={{ ml: 1 }}
                              />
                            )}
                          </Box>
                        }
                        secondary={
                          <>
                            {/* 사용자 메시지: 피드백 결과 표시 */}
                            {message.role === 'user' && messageFeedback[index] && (
                              <Box sx={{ mt: 1, textAlign: 'right' }}>
                                {messageFeedback[index].error ? (
                                  <Alert severity="error" sx={{ textAlign: 'left' }}>
                                    <Typography variant="caption">{messageFeedback[index].error}</Typography>
                                  </Alert>
                                ) : (
                                  <Alert
                                    severity="info"
                                    sx={{
                                      textAlign: 'left'
                                    }}
                                  >
                                    {messageFeedback[index].correctedUserText && (
                                      <Typography variant="caption" display="block" sx={{ mb: 0.5 }}>
                                        <strong>교정:</strong> {messageFeedback[index].correctedUserText}
                                      </Typography>
                                    )}
                                    {messageFeedback[index].feedback?.length > 0 && (
                                      <Box sx={{ mb: 0.5 }}>
                                        {messageFeedback[index].feedback.map((fb, i) => (
                                          <Typography key={i} variant="caption" display="block">• {fb}</Typography>
                                        ))}
                                      </Box>
                                    )}
                                    {messageFeedback[index].suggestions?.length > 0 && (
                                      <Box sx={{ mb: 0.5 }}>
                                        <Typography variant="caption" display="block"><strong>대안 표현:</strong></Typography>
                                        {messageFeedback[index].suggestions.map((sg, i) => (
                                          <Chip
                                            key={i}
                                            label={sg}
                                            size="small"
                                            variant="outlined"
                                            onClick={() => setInputText(sg)}
                                            sx={{ cursor: 'pointer', mr: 0.5, mt: 0.5 }}
                                          />
                                        ))}
                                      </Box>
                                    )}
                                    {messageFeedback[index].encouragement && (
                                      <Typography variant="caption" color="success.main" display="block">
                                        {messageFeedback[index].encouragement}
                                      </Typography>
                                    )}
                                  </Alert>
                                )}
                              </Box>
                            )}

                            {/* AI 메시지: 추천 문장 (최신 메시지만) */}
                            {message.role === 'assistant' &&
                              !message.streaming &&
                              index === messages.length - 1 &&
                              suggestedReplies.length > 0 && (
                                <Box sx={{ mt: 1 }}>
                                  <Box
                                    sx={{
                                      mt: 0.5,
                                      display: 'flex',
                                      flexWrap: 'wrap',
                                      gap: 0.5,
                                      alignItems: 'center',
                                    }}
                                  >
                                    {suggestedReplies.map((suggestion, idx) => (
                                      <Chip
                                        key={idx}
                                        label={suggestion}
                                        size="small"
                                        variant="outlined"
                                        onClick={() => setInputText(suggestion)}
                                        sx={{ cursor: 'pointer' }}
                                      />
                                    ))}
                                  </Box>
                                </Box>
                              )}

                            {/* AI 메시지: 대화 종료 안내 (최신 메시지만) */}
                            {message.role === 'assistant' &&
                              !message.streaming &&
                              index === messages.length - 1 &&
                              conversationEnded && (
                                <Box sx={{ mt: 1 }}>
                                  <Alert severity="info" sx={{ textAlign: 'left' }}>
                                    <Typography variant="body2" sx={{ mb: 1 }}>
                                      대화가 종료되었습니다. 수고하셨습니다!
                                    </Typography>
                                    <Button
                                      variant="outlined"
                                      size="small"
                                      onClick={() => navigate('/home')}
                                    >
                                      홈으로 돌아가기
                                    </Button>
                                  </Alert>
                                </Box>
                              )}
                          </>
                        }
                      />
                    </ListItem>
                  ))}
                  <div ref={messagesEndRef} />
                </List>
              </CardContent>

              {/* Input Area */}
              <CardContent sx={{ borderTop: 1, borderColor: 'divider' }}>
                <Stack direction="row" spacing={1} alignItems="flex-end">
                  <IconButton
                    color={isRecordingNow ? 'error' : 'primary'}
                    onClick={handleMicToggle}
                    disabled={conversationEnded || isAILoading || isTranscribing || !conversationIdRef.current || whisperStatus !== 'ready'}
                  >
                    {isRecordingNow ? <MicOff /> : <Mic />}
                  </IconButton>

                  <TextField
                    fullWidth
                    multiline
                    maxRows={3}
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    placeholder={
                      conversationEnded
                        ? '대화가 종료되었습니다'
                        : isRecordingNow
                          ? '녹음 중...'
                          : isTranscribing
                            ? '음성 인식 중...'
                            : '메시지를 입력하거나 마이크를 사용하세요'
                    }
                    disabled={conversationEnded || isRecordingNow || isTranscribing || isAILoading || !conversationIdRef.current}
                    onKeyPress={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSendMessage();
                      }
                    }}
                  />

                  <IconButton
                    color="primary"
                    onClick={handleSendMessage}
                    disabled={conversationEnded || !inputText.trim() || isTranscribing || isAILoading || !conversationIdRef.current}
                  >
                    <Send />
                  </IconButton>
                </Stack>
              </CardContent>
            </Card>
          </Box>
        </Stack>
      </Box>
    </StudentLayout>
  );
}
