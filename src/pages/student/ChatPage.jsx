import {useState, useRef, useEffect} from 'react';
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
  Paper,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Snackbar,
  Alert,
  CircularProgress,
  LinearProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
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
  Notifications,
  Feedback,
  LightbulbOutlined,
  Close,
  GraphicEq,
} from '@mui/icons-material';
import StudentLayout from '../../components/common/StudentLayout';
import TutorFeedbackOverlay from '../../components/student/TutorFeedbackOverlay';

// Hooks
import { useMediaPipe } from '../../hooks/conversation/useMediaPipe';
import { useSpeechActivityTracker } from '../../hooks/conversation/useSpeechActivityTracker';
import { useWhisperSTT } from '../../hooks/useWhisperSTT';
import { startAiChat, sendAiChatMessage } from '../../api/aiChat';
import { getRecommendedSentences, getSentenceFeedback } from '../../api/sentences';
import { useTTSAudio } from '../../hooks/useTTSAudio';
import { toApiDifficulty, toApiTopic } from '../../utils/apiMappers';
import { useTTS } from '../../hooks/conversation/useTTS';
import { useSpeechRecognition } from '../../hooks/conversation/useSpeechRecognition';
import { selectWhisperPreloadStatus } from '../../store/slices/whisperPreloadSlice';
import { extractVADSegments } from '../../utils/audioTrimmer';
import { createPcmRecorder } from '../../utils/pcmRecorder';
import { calculateResponseQuality } from '../../utils/conversation/responseQualityCalculator';



import useWebSocket from "../../hooks/webSocket/useWebSocket.js";
// Data
import { scenarios, getScenarioById } from '../../data/conversation/scenarios';

// Redux
import {
  startSession,
  endSession,
  updateRecordingTime,
  updateSpeakingTime,
  addResponseQuality,
} from '../../store/slices/speakingStatsSlice';
import {
  selectDailyAvgNetSpeakingDensity,
  selectLastResponseQuality,
  selectDailyAvgResponseQuality,
  getNetSpeakingDensityFeedback,
  getResponseQualityFeedback,
} from '../../store/selectors/speakingStatsSelectors';
import {useStudentStatus} from "../../api/useStudentStatus.js";
// server-backed chat + TTS

export default function ChatPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const dispatch = useDispatch();

  // Redux selectors
  const user = useSelector(state => state.auth.user);
  const netDensity = useSelector(selectDailyAvgNetSpeakingDensity);
  const lastQuality = useSelector(selectLastResponseQuality);
  const avgQuality = useSelector(selectDailyAvgResponseQuality);

  // Refs
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const cameraStreamRef = useRef(null);
  const messagesEndRef = useRef(null);
  const initialMessageSentRef = useRef(false);
  const lastAutoSpokenRef = useRef(null);
  const conversationIdRef = useRef(null);
  const sttStatusMsgIdRef = useRef(1);
  const stopDebounceTimerRef = useRef(null);
  const [isWhisperRecording, setIsWhisperRecording] = useState(false);
  const whisperStreamRef = useRef(null);
  const whisperRecorderRef = useRef(null);
  const whisperChunksRef = useRef([]);
  const whisperStartedAtRef = useRef(null);
  const [micStream, setMicStream] = useState(null);
  const pcmRecorderRef = useRef(null);

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
  const [inputHint, setInputHint] = useState(''); // 추천 문장 힌트(placeholder/helperText)
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
  const [ setPermissionError] = useState(null);
  const [isChatInitLoading, setIsChatInitLoading] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [sttError, setSttError] = useState(null);



  useStudentStatus(user, location);

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
      try {
        pcmRecorderRef.current?.stop?.();
      } catch (_) {}
      pcmRecorderRef.current = null;
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

  // 실제 발화시간(VAD/MAR) 트래킹: Whisper 스트림 재사용
  const { speakingMsRef, finalizeVadSegments } = useSpeechActivityTracker({
    enabled: isWhisperRecording,
    stream: micStream,
    landmarksRef,
    isTtsPlaying: isSpeaking,
    onTick: ({ deltaMs, isSpeaking: speaking }) => {
      // 녹음 시간 누적
      dispatch(updateRecordingTime({ deltaTime: deltaMs }));
      // 발화 시간 누적
      dispatch(updateSpeakingTime({ deltaTime: deltaMs, isSpeaking: speaking }));
    },
  });

  const [lastRecordedAudioUrl, setLastRecordedAudioUrl] = useState(null);
  const [lastVadAudioUrl, setLastVadAudioUrl] = useState(null);
  const [isVadTrimming, setIsVadTrimming] = useState(false);
  const [vadTrimError, setVadTrimError] = useState(null);
  const [replayError, setReplayError] = useState(null);
  const replayAudioRef = useRef(null);

  const clearReplayUrls = useCallback(() => {
    setLastRecordedAudioUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    setLastVadAudioUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
  }, []);

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

  useEffect(() => {
    return () => {
      try {
        replayAudioRef.current?.pause?.();
      } catch (_) {}
      try {
        if (lastRecordedAudioUrl) URL.revokeObjectURL(lastRecordedAudioUrl);
      } catch (_) {}
      try {
        if (lastVadAudioUrl) URL.revokeObjectURL(lastVadAudioUrl);
      } catch (_) {}
    };
  }, [lastRecordedAudioUrl, lastVadAudioUrl]);

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

  // Redux: 세션 시작/종료 + 백엔드 API 연동
  useEffect(() => {
    // Redux 세션 시작
    dispatch(startSession({ sessionType: 'chat' }));

    return () => {
      // Redux 세션 종료
      dispatch(endSession());
    };
  }, [dispatch]);

  // 세션 시간, 로딩 시간 추적 제거 (녹음 시간만 추적)

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
    setVadTrimError(null);
    setIsVadTrimming(false);
    clearReplayUrls();

    const sttMsgId = `stt-${Date.now()}-${sttStatusMsgIdRef.current++}`;

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
        const vadSegments = typeof finalizeVadSegments === 'function' ? finalizeVadSegments() : [];
        let replayBaseBlob = audioBlob;
        try {
          const wav = await pcmRecorderRef.current?.stop?.();
          if (wav) replayBaseBlob = wav;
        } catch (_) {}
        pcmRecorderRef.current = null;
        setLastRecordedAudioUrl((prev) => {
          if (prev) URL.revokeObjectURL(prev);
          return URL.createObjectURL(replayBaseBlob);
        });
        setIsVadTrimming(true);
        setVadTrimError(null);
        try {
          const vadBlob = await extractVADSegments(replayBaseBlob, vadSegments);
          setLastVadAudioUrl((prev) => {
            if (prev) URL.revokeObjectURL(prev);
            return URL.createObjectURL(vadBlob);
          });
        } catch (e) {
          setVadTrimError(e?.message || 'VAD 오디오 생성에 실패했습니다.');
          setLastVadAudioUrl((prev) => {
            if (prev) URL.revokeObjectURL(prev);
            return null;
          });
        } finally {
          setIsVadTrimming(false);
        }

        if (whisperStreamRef.current) {
          whisperStreamRef.current.getTracks().forEach((t) => {
            try { t.enabled = false; } catch (_) {}
            try { t.stop(); } catch (_) {}
          });
          whisperStreamRef.current = null;
        }
        setMicStream(null);
        whisperRecorderRef.current = null;
        setIsWhisperRecording(false);

        const durationMs = Math.max(0, Date.now() - (whisperStartedAtRef.current || Date.now()));
        const speakingMs = Math.max(0, speakingMsRef.current || 0);
        setCurrentSpeakingTime(speakingMs / 1000);
        setLastTotalDurationMs(durationMs);
        setLastSpeechDurationMs(speakingMs);
        setTotalTimeMs((t) => t + durationMs);

        setIsTranscribing(true);
        try {
          const result = await whisperTranscribe(audioBlob, { backend: 'webgpu', vad: true, trimThreshold: 0.003, trimPaddingSec: 0.1 });
          const text = String(result?.text || '').trim();
          if (text) setInputText(text);
          setMessages((prev) =>
            prev.map((m) =>
              m?.id === sttMsgId
                ? { ...m, content: `🎤 인식 결과: ${text || '(인식 실패)'}`, streaming: false }
                : m
            )
          );

          // Response Quality 계산 및 저장
          if (text && vadSegments.length > 0 && speakingMs > 0) {
            const responseQuality = calculateResponseQuality({
              durationMs: speakingMs,
              transcript: text,
              vadSegments,
            });
            dispatch(addResponseQuality(responseQuality));
            console.log('[Response Quality]', responseQuality);
          }
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
      setMicStream(null);
      setMessages((prev) =>
        prev.map((m) =>
          m?.id === sttMsgId ? { ...m, content: `⚠️ 음성 인식 실패: ${errMsg}`, streaming: false } : m
        )
      );
    } finally {
      setIsTranscribing(false);
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


            {/* Speaking Statistics */}
            <Card elevation={2}>
              <CardContent>
                <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>
                  📊 통계
                </Typography>
                <Stack spacing={2}>
                  {/* Response Quality */}
                  <Box>
                    <Typography variant="body2" color="text.secondary" gutterBottom>
                      응답 품질 (Response Quality)
                    </Typography>
                    <Stack direction="row" spacing={2}>
                      <Box sx={{ flex: 1 }}>
                        <Typography variant="h6" sx={{ fontWeight: 700 }}>
                          {lastQuality ? `${lastQuality.overallScore}점` : '-'}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          마지막
                        </Typography>
                      </Box>
                      <Box sx={{ flex: 1 }}>
                        <Typography variant="h6" sx={{ fontWeight: 700 }}>
                          {avgQuality ? `${avgQuality.toFixed(1)}점` : '-'}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          평균
                        </Typography>
                      </Box>
                    </Stack>
                    {lastQuality && (
                      <Box sx={{ mt: 1 }}>
                        <Chip
                          label={getResponseQualityFeedback(lastQuality.overallScore).message}
                          size="small"
                          sx={{
                            bgcolor: getResponseQualityFeedback(lastQuality.overallScore).color + '.100',
                            color: getResponseQualityFeedback(lastQuality.overallScore).color + '.800',
                          }}
                        />
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                          {lastQuality.wordCount}단어 · {lastQuality.wordsPerMinute.toFixed(0)} wpm · 유창성 {lastQuality.fluencyScore.toFixed(0)}%
                        </Typography>
                      </Box>
                    )}
                  </Box>

                  {/* Net Speaking Density */}
                  <Box>
                    <Typography variant="body2" color="text.secondary" gutterBottom>
                      발화 밀도 (Net Speaking Density)
                    </Typography>
                    <Typography variant="h6" sx={{ fontWeight: 700 }}>
                      {netDensity != null && netDensity > 0 ? `${netDensity.toFixed(1)}%` : '-'}
                    </Typography>
                    {netDensity != null && netDensity > 0 && (
                      <Chip
                        label={getNetSpeakingDensityFeedback(netDensity).message}
                        size="small"
                        sx={{
                          mt: 1,
                          bgcolor: getNetSpeakingDensityFeedback(netDensity).color + '.100',
                          color: getNetSpeakingDensityFeedback(netDensity).color + '.800',
                        }}
                      />
                    )}
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
                        disableTypography
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
                {/* 추천 문장 패널 (사용자가 닫기 전까지 유지) */}
                {(suggestedReplies.length > 0 || suggestLoading) && (
                  <Box sx={{ mb: 1 }}>
                    <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 0.5 }}>
                      <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>
                        추천 문장
                        {suggestLoading ? ' (불러오는 중...)' : ''}
                      </Typography>
                      <IconButton
                        size="small"
                        onClick={() => {
                          setSuggestedReplies([]);
                          setInputHint('');
                        }}
                        title="추천 닫기"
                        disabled={suggestLoading && suggestedReplies.length === 0}
                      >
                        <Close fontSize="small" />
                      </IconButton>
                    </Stack>
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, alignItems: 'center' }}>
                      {suggestedReplies.map((suggestion, idx) => {
                        const selected = inputHint === suggestion;
                        return (
                          <Chip
                            key={idx}
                            label={suggestion}
                            size="small"
                            variant={selected ? 'filled' : 'outlined'}
                            color={selected ? 'primary' : 'default'}
                            onClick={() => setInputHint(suggestion)}
                            sx={{ cursor: 'pointer' }}
                          />
                        );
                      })}
                    </Box>
                  </Box>
                )}

                <Stack direction="row" spacing={1} alignItems="center">
                  <IconButton
                    color={isRecordingNow ? 'error' : 'primary'}
                    onClick={handleMicToggle}
                    disabled={conversationEnded || isAILoading || isTranscribing || !conversationIdRef.current || whisperStatus !== 'ready'}
                  >
                    {isRecordingNow ? <MicOff /> : <Mic />}
                  </IconButton>
                  {lastVadAudioUrl && (
                    <IconButton
                      size="small"
                      onClick={() => playLocalUrl(lastVadAudioUrl)}
                      disabled={!lastVadAudioUrl || isVadTrimming || isRecordingNow || isSpeaking}
                      title={isVadTrimming ? '음성 추출 중...' : 'VAD만 다시듣기'}
                      sx={{ border: 1, borderColor: 'divider', borderRadius: 1 }}
                    >
                      {isVadTrimming ? <CircularProgress size={18} /> : <GraphicEq fontSize="small" />}
                    </IconButton>
                  )}

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
                            : (inputText ? '메시지를 입력하거나 마이크를 사용하세요' : (inputHint || '메시지를 입력하거나 마이크를 사용하세요'))
                    }
                    // helperText는 버튼 정렬을 깨지 않도록 사용하지 않고, placeholder로만 힌트를 제공
                    helperText=" "
                    FormHelperTextProps={{ sx: { display: 'none' } }}
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
                {(vadTrimError || replayError) && (
                  <Box sx={{ mt: 1 }}>
                    {vadTrimError && (
                      <Alert severity="warning" sx={{ py: 0, px: 1 }}>
                        {vadTrimError}
                      </Alert>
                    )}
                    {replayError && (
                      <Alert severity="warning" sx={{ py: 0, px: 1, mt: vadTrimError ? 1 : 0 }}>
                        {replayError}
                      </Alert>
                    )}
                  </Box>
                )}
              </CardContent>
            </Card>
          </Box>
        </Stack>
      </Box>

      {/* 튜터 피드백 오버레이 - 독립적 컴포넌트 */}
      <TutorFeedbackOverlay />
    </StudentLayout>
  );
}
