import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import StudentLayout from '../../components/common/StudentLayout';
import FloatingCameraPreview from '../../components/common/FloatingCameraPreview';
import TutorFeedbackOverlay from '../../components/student/TutorFeedbackOverlay';

// Hooks
import { useMediaPipe } from '../../hooks/conversation/useMediaPipe';
import { useSpeechActivityTracker } from '../../hooks/conversation/useSpeechActivityTracker';
import { useWhisperSTT } from '../../hooks/useWhisperSTT';
import { startAiChat, sendAiChatMessage } from '../../api/aiChat';
import { getRecommendedSentences, getSentenceFeedback } from '../../api/sentences';
import { useTTSAudio } from '../../hooks/useTTSAudio';
import { toApiDifficulty, toApiTopic } from '../../utils/apiMappers';
import { selectWhisperPreloadStatus } from '../../store/slices/whisperPreloadSlice';
import { playVadReplay, stopVadReplay } from '../../utils/vadReplayPlayer';
import { calculateResponseQuality } from '../../utils/conversation/responseQualityCalculator';
import { cancelPrevious, enqueue } from '../../utils/postRecordingPipeline';



// Data
import { getScenarioById } from '../../data/conversation/scenarios';

// Redux
import {
  startSession,
  endSession,
  updateRecordingTime,
  updateSpeakingTime,
  addResponseQuality,
  incrementChatTurn,
  addResponseLatency,
  uploadDailyStatsOnRecordingEnd,
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

function clsx(...parts) {
  return parts.filter(Boolean).join(' ');
}

function Banner({ tone = 'info', title, children }) {
  const styles =
    tone === 'error'
      ? 'border-red-200 bg-red-50 text-red-800 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200'
      : tone === 'warning'
        ? 'border-yellow-200 bg-yellow-50 text-yellow-900 dark:border-yellow-500/30 dark:bg-yellow-500/10 dark:text-yellow-200'
        : 'border-primary/20 bg-primary/10 text-[#111418] dark:text-white';

  return (
    <div className={clsx('rounded-xl border px-4 py-3', styles)}>
      {title ? <p className="text-sm font-bold">{title}</p> : null}
      {children ? <div className={title ? 'mt-1' : ''}>{children}</div> : null}
    </div>
  );
}

function IconPillButton({ icon, label, onClick, disabled, title, className }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title || label}
      className={clsx(
        'flex items-center justify-center rounded-full size-12 bg-gray-100 dark:bg-white/5 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-white/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed',
        className
      )}
    >
      <span className="material-symbols-outlined">{icon}</span>
    </button>
  );
}

function ProgressRing({ valuePercent }) {
  const size = 84;
  const stroke = 6;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, valuePercent || 0));
  const dash = (pct / 100) * c;
  const color = pct >= 80 ? 'text-red-500' : 'text-primary';

  return (
    <svg width={size} height={size} className="absolute inset-0">
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="transparent"
        stroke="currentColor"
        strokeWidth={stroke}
        className="text-gray-200 dark:text-white/10"
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
        className={color}
      />
    </svg>
  );
}

export default function ChatPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const dispatch = useDispatch();

  // Redux selectors
  const user = useSelector(state => state.auth.user);
  const netDensity = useSelector(selectDailyAvgNetSpeakingDensity);
  const lastQuality = useSelector(selectLastResponseQuality);
  const avgQuality = useSelector(selectDailyAvgResponseQuality);
  const dailyStats = useSelector(state => state.speakingStats.dailyStats);
  const userEmail = useSelector(state => state.auth.user?.email);

  // Refs
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const cameraStreamRef = useRef(null);
  const messagesScrollRef = useRef(null);
  const autoScrollEnabledRef = useRef(true);
  const composerRef = useRef(null);
  const initialMessageSentRef = useRef(false);
  const lastAutoSpokenRef = useRef(null);
  const conversationIdRef = useRef(null);
  const sttStatusMsgIdRef = useRef(1);
  const stopDebounceTimerRef = useRef(null);
  const isRecordingRef = useRef(false); // 즉시 동기화용 ref
  const [isWhisperRecording, setIsWhisperRecording] = useState(false);
  const whisperStreamRef = useRef(null);
  const whisperRecorderRef = useRef(null);
  const whisperChunksRef = useRef([]);
  const whisperStartedAtRef = useRef(null);
  const [micStream, setMicStream] = useState(null);

  // Recording timer state (for 30-second limit)
  const recordingStartTimeRef = useRef(null);
  const recordingTimerRef = useRef(null);
  const [recordingDuration, setRecordingDuration] = useState(0);

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
  const [permissionError, setPermissionError] = useState(null);
  const [isChatInitLoading, setIsChatInitLoading] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [sttError, setSttError] = useState(null);

  console.log("user ", user)
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

  // onTick 콜백을 useCallback으로 메모이제이션 (메모리 누수 방지)
  const handleSpeechTick = useCallback(({ deltaMs, isSpeaking: speaking }) => {
    // 녹음 시간 누적
    dispatch(updateRecordingTime({ deltaTime: deltaMs }));
    // 발화 시간 누적
    dispatch(updateSpeakingTime({ deltaTime: deltaMs, isSpeaking: speaking }));
  }, [dispatch]);

  // 실제 발화시간(VAD/MAR) 트래킹: Whisper 스트림 재사용
  const { speakingMsRef, cameraDetectedMsRef, finalizeVadSegments } = useSpeechActivityTracker({
    enabled: isWhisperRecording,
    stream: micStream,
    landmarksRef,
    isTtsPlaying: isSpeaking,
    onTick: handleSpeechTick,
  });

  const lastVadReplayPcmRef = useRef(null); // Float32Array (16k)
  const [isVadTrimming, setIsVadTrimming] = useState(false);
  const [vadTrimError, setVadTrimError] = useState(null);
  const [replayError, setReplayError] = useState(null);

  const clearReplayUrls = useCallback(() => {
    lastVadReplayPcmRef.current = null;
  }, []);

  const playLastVad = useCallback(async () => {
    const pcm = lastVadReplayPcmRef.current || null;
    if (!pcm) return;
    setReplayError(null);
    try {
      await playVadReplay({ pcm, sampleRate: 16000 });
    } catch (e) {
      setReplayError(e?.message || '오디오 재생에 실패했습니다.');
    }
  }, []);

  useEffect(() => {
    return () => {
      try {
        stopVadReplay();
      } catch (_) {}
      lastVadReplayPcmRef.current = null;
    };
  }, []);

  // Camera permission
  useEffect(() => {
    let cancelled = false;
    const stopStream = () => {
      if (cameraStreamRef.current) {
        cameraStreamRef.current.getTracks().forEach((track) => {
          try {
            track.enabled = false;
          } catch (_) {}
          try {
            track.stop();
          } catch (_) {}
        });
        cameraStreamRef.current = null;
      }
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
    };

    const requestCamera = async () => {
      try {
        setPermissionError(null);
        setHasCameraPermission(null);

        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        cameraStreamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;
        setHasCameraPermission(true);
      } catch (err) {
        console.error('Camera permission error:', err);
        setPermissionError(err?.message || '카메라 권한을 확인해주세요.');
        setHasCameraPermission(false);
        stopStream();
      }
    };

    requestCamera();

    return () => {
      cancelled = true;
      stopStream();
    };
  }, []);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (stopDebounceTimerRef.current) {
        clearTimeout(stopDebounceTimerRef.current);
        stopDebounceTimerRef.current = null;
      }
      // Recording timer cleanup
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
        recordingTimerRef.current = null;
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

  // Recording duration limit (30 seconds)
  const MAX_RECORDING_DURATION = 30 * 1000;

  const handleMessagesScroll = useCallback(() => {
    const el = messagesScrollRef.current;
    if (!el) return;
    const distanceToBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    autoScrollEnabledRef.current = distanceToBottom < 80;
  }, []);

  // Smart auto-scroll: only when user is near bottom
  useEffect(() => {
    const el = messagesScrollRef.current;
    if (!el) return;
    if (!autoScrollEnabledRef.current) return;
    el.scrollTop = el.scrollHeight;
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
    if (isRecordingRef.current) {
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

    // 새 녹음 시작 시: 이전 후처리 파이프라인 결과 무시(latest-only)
    cancelPrevious('chat');

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

      // Initialize recording timer for 30-second limit
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
      const preferred = [
        // mp4 우선(테스트용)
        'audio/mp4;codecs=mp4a.40.2',
        'audio/mp4',
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/ogg;codecs=opus',
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

        // VAD 세그먼트 확정 (재생/통계용)
        const vadSegments = typeof finalizeVadSegments === 'function' ? finalizeVadSegments() : [];
        const vadSegmentsDurationMs = (vadSegments || []).reduce((sum, seg) => {
          const s = typeof seg?.start === 'number' ? seg.start : 0;
          const e = typeof seg?.end === 'number' ? seg.end : 0;
          return sum + Math.max(0, e - s);
        }, 0);

        if (whisperStreamRef.current) {
          whisperStreamRef.current.getTracks().forEach((t) => {
            try { t.enabled = false; } catch (_) {}
            try { t.stop(); } catch (_) {}
          });
          whisperStreamRef.current = null;
        }
        setMicStream(null);
        whisperRecorderRef.current = null;
        isRecordingRef.current = false; // 즉시 동기화
        setIsWhisperRecording(false);

        // Clear recording timer
        if (recordingTimerRef.current) {
          clearInterval(recordingTimerRef.current);
          recordingTimerRef.current = null;
        }
        setRecordingDuration(0);

        const durationMs = Math.max(0, Date.now() - (whisperStartedAtRef.current || Date.now()));
        const speakingMs = Math.max(0, speakingMsRef.current || 0);
        setCurrentSpeakingTime(speakingMs / 1000);
        setLastTotalDurationMs(durationMs);
        setLastSpeechDurationMs(speakingMs);
        setTotalTimeMs((t) => t + durationMs);

        // 녹음 후 처리(STT/VAD 트리밍/업로드)는 싱글턴 파이프라인에서 1개씩 처리
        enqueue(
          'chat',
          async ({ isCurrent }) => {
            if (!isCurrent()) return;

            // 통계 백업: 유효 녹음(diff 통과 여부는 thunk에서 검사), 데이터 변화가 있으면 POST
            const cameraMs = Math.max(0, cameraDetectedMsRef?.current || 0);
            const vadMs = Math.max(0, vadSegmentsDurationMs || 0);
            dispatch(uploadDailyStatsOnRecordingEnd({ cameraMs, vadMs }));

            setIsTranscribing(true);
            try {
              const result = await whisperTranscribe(audioBlob, {
                backend: 'webgpu',
                vad: true,
                trimThreshold: 0.003,
                trimPaddingSec: 0.1,
              });
              if (!isCurrent()) return;
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
              if (!isCurrent()) return;
              const errMsg = e?.message || String(e);
              setSttError(errMsg);
              setMessages((prev) =>
                prev.map((m) =>
                  m?.id === sttMsgId ? { ...m, content: `⚠️ 음성 인식 실패: ${errMsg}`, streaming: false } : m
                )
              );
            } finally {
              if (!isCurrent()) return;
              setIsTranscribing(false);

              // VAD 다시듣기: WAV/Blob 생성 없이 WebAudio로 재생할 PCM을 만든다
              if (!result?.replayPcm) return;
              setIsVadTrimming(true);
              setVadTrimError(null);
              try {
                const replayPcm = result.replayPcm;
                const sr = Number(result.replaySampleRate || 16000) || 16000;
                const segs = Array.isArray(vadSegments) ? vadSegments : [];
                let totalSamples = 0;
                const ranges = segs
                  .map((seg) => {
                    const sMs = Math.max(0, Number(seg?.start || 0));
                    const eMs = Math.max(sMs, Number(seg?.end || 0));
                    const s = Math.max(0, Math.min(replayPcm.length, Math.floor((sMs / 1000) * sr)));
                    const e = Math.max(s, Math.min(replayPcm.length, Math.floor((eMs / 1000) * sr)));
                    const len = Math.max(0, e - s);
                    totalSamples += len;
                    return { s, e, len };
                  })
                  .filter((r) => r.len > 0);
                if (!ranges.length || totalSamples <= 0) {
                  lastVadReplayPcmRef.current = null;
                  return;
                }
                const out = new Float32Array(totalSamples);
                let off = 0;
                for (const r of ranges) {
                  out.set(replayPcm.subarray(r.s, r.e), off);
                  off += r.len;
                }
                if (!isCurrent()) return;
                lastVadReplayPcmRef.current = out;
              } catch (e) {
                if (!isCurrent()) return;
                setVadTrimError(e?.message || 'VAD 오디오 생성에 실패했습니다.');
                lastVadReplayPcmRef.current = null;
              } finally {
                if (isCurrent()) setIsVadTrimming(false);
              }
            }
          },
          { label: 'chat_onstop' }
        );
      };

      recorder.start();
      isRecordingRef.current = true; // 즉시 동기화
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

    // Chat turn 증가 (사용자 메시지 전송 시)
    dispatch(incrementChatTurn());

    // AI 응답 지연 측정 시작
    const requestStartTime = Date.now();

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

      // AI 응답 지연 시간 계산 및 기록
      const responseLatency = Date.now() - requestStartTime;
      dispatch(addResponseLatency({ latencyMs: responseLatency }));
      console.log(`[ChatPage] AI response latency: ${responseLatency}ms`);

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

      // 백엔드 저장은 세션 종료 시 POST /api/sessions/end를 통해 자동으로 이루어집니다.

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
  const handlePlayAIMessage = useCallback((content) => {
    if (!content) return;
    stopTTS();
    playText(content);
  }, [stopTTS, playText]);

  // Reveal AI message
  const handleRevealMessage = useCallback((index) => {
    setRevealedMessages(prev => {
      const newSet = new Set(prev);
      newSet.add(index);
      return newSet;
    });
  }, []);

  const formatTime = (ms) => {
    const totalSec = Math.max(0, Math.floor(ms / 1000));
    const m = String(Math.floor(totalSec / 60)).padStart(2, '0');
    const s = String(totalSec % 60).padStart(2, '0');
    return `${m}:${s}`;
  };

  const isRecordingNow = isWhisperRecording;

  const canRecord =
    !conversationEnded &&
    !isAILoading &&
    !isTranscribing &&
    !!conversationIdRef.current &&
    whisperStatus === 'ready';

  // 녹음 중일 때는 무조건 클릭 가능 (중지를 위해)
  const canClickMic = isRecordingNow || canRecord;

  const sessionHeader = useMemo(() => {
    return (
      <header
        data-session-header="true"
        className="flex items-center justify-between border-b border-solid border-b-[#f0f2f4] dark:border-b-white/10 bg-white dark:bg-background-dark px-4 md:px-8 py-3 shrink-0"
      >
        <div className="flex items-center gap-4 px-4 md:px-6 py-2 bg-gray-50 dark:bg-white/5 rounded-full border border-gray-100 dark:border-white/10 mx-auto lg:mx-0">
          <div className="flex items-center gap-2">
            <span className="size-2 bg-red-500 rounded-full animate-pulse"></span>
            <p className="text-sm font-semibold text-gray-600 dark:text-gray-300">Live Session</p>
          </div>
          <div className="w-px h-4 bg-gray-200 dark:bg-white/10"></div>
          <p className="text-sm font-bold text-[#111418] dark:text-white">
            {getScenarioById(currentScenario)?.title || 'AI Conversation'}
          </p>
          <div className="w-px h-4 bg-gray-200 dark:bg-white/10"></div>
          <div className="flex items-center gap-2 text-primary font-bold">
            <span className="material-symbols-outlined text-sm">timer</span>
            <p className="text-sm uppercase tracking-wider">{formatTime(totalTimeMs)}</p>
          </div>
        </div>

        <div className="hidden lg:flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-gray-400 uppercase tracking-tighter">Difficulty</span>
            <span className="inline-flex items-center rounded-full px-3 py-1 text-xs font-black bg-primary/10 text-primary border border-primary/20">
              {difficulty}
            </span>
          </div>
        </div>
      </header>
    );
  }, [currentScenario, difficulty, totalTimeMs]);

  const lastUserIdx = useMemo(() => {
    return messages.reduce(
      (acc, m, i) => (m?.role === 'user' && !String(m?.content || '').startsWith('🎤') ? i : acc),
      -1
    );
  }, [messages]);

  const handleEndSession = useCallback(() => {
    try {
      stopTTS();
    } catch (_) {}
    try {
      whisperRecorderRef.current?.stop?.();
    } catch (_) {}
    try {
      replayAudioRef.current?.pause?.();
    } catch (_) {}
    navigate('/home');
  }, [navigate, stopTTS]);

  const micProgressPct = isRecordingNow ? (recordingDuration / MAX_RECORDING_DURATION) * 100 : 0;

  const placeholderText = useMemo(() => {
    if (conversationEnded) return '대화가 종료되었습니다';
    if (isRecordingNow) return '녹음 중... (다시 누르면 종료 후 인식)';
    if (isTranscribing) return '음성 인식 중...';
    return '메시지를 입력하거나 마이크를 사용하세요';
  }, [conversationEnded, isRecordingNow, isTranscribing]);

  const showComposerDisabled =
    conversationEnded || isRecordingNow || isTranscribing || isAILoading || !conversationIdRef.current;

  return (
    <StudentLayout
      mode="session"
      sessionHeader={sessionHeader}
      todayTime={Math.floor(totalTimeMs / 1000 / 60)}
    >
      <div className="h-full min-h-0 flex">
        <main className="relative flex flex-1 min-h-0 overflow-hidden">
          <section className="relative flex-[7] flex flex-col min-h-0 overflow-hidden bg-white dark:bg-background-dark border-r border-[#e5e7eb] dark:border-white/10">
            <div className="px-4 md:px-6 pt-2 space-y-2">
              {aiError ? (
                <Banner tone="error" title="AI 응답 오류">
                  <p className="text-sm opacity-90">{aiError?.message || String(aiError)}</p>
                </Banner>
              ) : null}

              {isChatInitLoading ? (
                <Banner title="대화 준비 중...">
                  <div className="flex items-center gap-2">
                    <span className="inline-block size-4 animate-spin rounded-full border-2 border-primary/30 border-t-primary" />
                    <p className="text-sm font-semibold text-[#111418] dark:text-white">잠시만 기다려주세요.</p>
                  </div>
                </Banner>
              ) : null}

              {isTranscribing ? (
                <Banner title="음성 인식 중...">
                  <div className="flex items-center gap-2">
                    <span className="inline-block size-4 animate-spin rounded-full border-2 border-primary/30 border-t-primary" />
                    <p className="text-sm font-semibold text-[#111418] dark:text-white">녹음 결과를 텍스트로 변환하고 있어요.</p>
                  </div>
                </Banner>
              ) : null}

              {sttError || whisperError ? (
                <Banner tone="warning" title="STT 오류">
                  <p className="text-sm opacity-90">{sttError || whisperError}</p>
                </Banner>
              ) : null}

              {ttsStatus === 'generating' ? (
                <Banner title="오디오 생성 중...">
                  <div className="flex items-center gap-2">
                    <span className="inline-block size-4 animate-spin rounded-full border-2 border-primary/30 border-t-primary" />
                    <p className="text-sm font-semibold text-[#111418] dark:text-white">TTS 오디오를 만들고 있어요.</p>
                  </div>
                </Banner>
              ) : null}
            </div>

            <div className="px-4 md:px-6 py-2 border-b border-gray-100 dark:border-white/10 flex items-center justify-between bg-white/90 dark:bg-background-dark/90 backdrop-blur-md sticky top-0 z-10">
              <div className="flex items-center gap-4">
                <div className="relative">
                  <div className="size-12 rounded-full bg-primary/10 flex items-center justify-center border-2 border-primary/20 overflow-hidden">
                    <span className="material-symbols-outlined text-2xl text-primary">face_6</span>
                  </div>
                  <div className="absolute -bottom-0.5 -right-0.5 size-3.5 bg-green-500 rounded-full border-2 border-white dark:border-background-dark" />
                </div>
                <div>
                  <h3 className="font-bold text-[#111418] dark:text-white leading-none">AI Sarah</h3>
                  <p className="text-xs text-primary font-medium mt-1 uppercase tracking-widest flex items-center gap-1">
                    <span className={clsx('material-symbols-outlined text-[10px]', isSpeaking ? 'animate-pulse' : '')}>
                      graphic_eq
                    </span>
                    {isSpeaking ? 'Speaking...' : 'Ready'}
                  </p>
                </div>
              </div>

              <div className="hidden md:flex items-center gap-2">
                <span className="text-xs font-bold text-gray-400 uppercase">Fluency</span>
                <div className="w-32 bg-gray-100 dark:bg-white/10 h-1.5 rounded-full overflow-hidden">
                  <div className="bg-primary h-full w-[84%]" />
                </div>
                <span className="text-xs font-bold text-primary">84%</span>
              </div>
            </div>

            <div
              ref={messagesScrollRef}
              onScroll={handleMessagesScroll}
              className="flex-1 min-h-0 overflow-y-auto p-3 md:p-5 bg-gray-50/30 dark:bg-background-dark/30"
            >
              <div className="max-w-6xl mx-auto flex flex-col gap-6">
                {messages.map((message, index) => {
                  const role = message?.role;
                  const content = String(message?.content || '');
                  const isAssistant = role === 'assistant';
                  const isUser = role === 'user';
                  const isSystem = role === 'system';
                  const isLast = index === messages.length - 1;
                  const isBlurred = isAssistant && !message.streaming && !revealedMessages.has(index);

                  const bubbleBase = 'relative inline-block rounded-3xl px-4 py-3';
                  const bubbleTone = isUser
                    ? 'bg-primary text-white shadow-sm'
                    : isSystem
                      ? 'rounded-full px-4 py-2 bg-white/80 dark:bg-white/10 border border-gray-100 dark:border-white/10 text-xs font-bold text-gray-600 dark:text-gray-300'
                      : 'bg-white dark:bg-white/10 border border-gray-100 dark:border-white/10 text-[#111418] dark:text-white';
                  const bubbleAccent = isAssistant && index > 0 ? 'border-l-4 border-primary' : '';

                  return (
                    <div
                      key={`${role}-${index}`}
                      className={clsx(
                        'flex gap-6',
                        isUser ? 'justify-end' : 'justify-start'
                      )}
                    >
                      <div className={clsx('flex-1', isUser ? 'text-right max-w-[90%]' : 'max-w-[90%]')}>
                        <span
                          className={clsx(
                            'text-[11px] font-bold uppercase tracking-widest mb-3 block',
                            isUser ? 'text-primary' : 'text-gray-400'
                          )}
                        >
                          {isUser ? 'You' : isAssistant ? 'Sarah' : 'System'}
                        </span>

                        <div className={clsx('relative inline-block', isUser ? 'text-right' : '')}>
                          <div
                            role={isAssistant ? 'button' : undefined}
                            tabIndex={isAssistant ? 0 : undefined}
                            onClick={() => {
                              if (isAssistant && isBlurred) handleRevealMessage(index);
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                if (isAssistant && isBlurred) handleRevealMessage(index);
                              }
                            }}
                            className={clsx(
                              bubbleBase,
                              bubbleTone,
                              bubbleAccent,
                              isAssistant && isBlurred ? 'cursor-pointer' : ''
                            )}
                          >
                            <p
                              className={clsx(
                                'text-base lg:text-lg leading-relaxed',
                                isUser ? 'text-white font-semibold' : isAssistant ? 'font-light' : '',
                                isBlurred ? 'blur-[6px] select-none' : ''
                              )}
                            >
                              {content || (message.streaming ? '...' : '')}
                            </p>

                            {message.streaming ? (
                              <div className="mt-4 flex gap-1.5">
                                <span className="size-2 bg-primary/40 rounded-full" />
                                <span className="size-2 bg-primary/40 rounded-full" />
                                <span className="size-2 bg-primary/40 rounded-full" />
                              </div>
                            ) : null}

                            {isAssistant && isBlurred ? (
                              <div className="absolute inset-0 flex items-center justify-center">
                                <div className="bg-black/70 text-white px-3 py-1 rounded-full text-xs font-bold">
                                  클릭하여 보기
                                </div>
                              </div>
                            ) : null}
                          </div>
                        </div>

                        {!isSystem ? (
                          <div className={clsx('mt-3 flex items-center gap-2', isUser ? 'justify-end' : 'justify-start')}>
                            {isAssistant && !message.streaming ? (
                              <>
                                {isLast ? (
                                  <button
                                    type="button"
                                    onClick={generateSuggestedReplies}
                                    disabled={suggestLoading}
                                    className="inline-flex items-center justify-center rounded-full size-10 bg-gray-100 dark:bg-white/5 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-white/10 transition-colors disabled:opacity-50"
                                    title="답변 추천"
                                  >
                                    <span className="material-symbols-outlined">
                                      {suggestLoading ? 'progress_activity' : 'lightbulb'}
                                    </span>
                                  </button>
                                ) : null}

                                <button
                                  type="button"
                                  onClick={() => handlePlayAIMessage(content)}
                                  disabled={isSpeaking || message.streaming}
                                  className="inline-flex items-center justify-center rounded-full size-10 bg-gray-100 dark:bg-white/5 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-white/10 transition-colors disabled:opacity-50"
                                  title="TTS 재생"
                                >
                                  <span className="material-symbols-outlined">volume_up</span>
                                </button>
                              </>
                            ) : null}

                            {isUser && index === lastUserIdx && !content.startsWith('🎤') ? (
                              <button
                                type="button"
                                onClick={() => handleRequestFeedback(index, content)}
                                disabled={feedbackLoading[index] || !!messageFeedback[index]}
                                className="inline-flex items-center justify-center rounded-full size-10 bg-gray-100 dark:bg-white/5 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-white/10 transition-colors disabled:opacity-50"
                                title="피드백 요청"
                              >
                                <span className="material-symbols-outlined">
                                  {feedbackLoading[index] ? 'progress_activity' : 'feedback'}
                                </span>
                              </button>
                            ) : null}

                            {isUser && message?.speakingTime ? (
                              <span className="inline-flex items-center rounded-full px-3 py-1 text-xs font-black bg-primary/10 text-primary border border-primary/20">
                                {Number(message.speakingTime).toFixed(1)}초
                              </span>
                            ) : null}
                          </div>
                        ) : null}

                        {isUser && messageFeedback[index] ? (
                          <div className="mt-4">
                            {messageFeedback[index].error ? (
                              <Banner tone="error" title="피드백 오류">
                                <p className="text-sm opacity-90">{messageFeedback[index].error}</p>
                              </Banner>
                            ) : (
                              <Banner title="피드백">
                                {messageFeedback[index].correctedUserText ? (
                                  <p className="text-sm font-semibold">
                                    <span className="font-black">교정:</span> {messageFeedback[index].correctedUserText}
                                  </p>
                                ) : null}

                                {Array.isArray(messageFeedback[index].feedback) && messageFeedback[index].feedback.length > 0 ? (
                                  <div className="mt-2 space-y-1">
                                    {messageFeedback[index].feedback.map((fb, i) => (
                                      <p key={i} className="text-sm opacity-90">
                                        - {fb}
                                      </p>
                                    ))}
                                  </div>
                                ) : null}

                                {Array.isArray(messageFeedback[index].suggestions) &&
                                messageFeedback[index].suggestions.length > 0 ? (
                                  <div className="mt-3">
                                    <p className="text-xs font-black uppercase tracking-widest text-gray-500 dark:text-gray-400">
                                      대안 표현
                                    </p>
                                    <div className="mt-2 flex flex-wrap gap-2">
                                      {messageFeedback[index].suggestions.map((sg, i) => (
                                        <button
                                          key={i}
                                          type="button"
                                          onClick={() => setInputText(sg)}
                                          className="rounded-full px-3 py-1.5 text-sm font-semibold border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 hover:border-primary/30 hover:text-primary transition"
                                        >
                                          {sg}
                                        </button>
                                      ))}
                                    </div>
                                  </div>
                                ) : null}

                                {messageFeedback[index].encouragement ? (
                                  <p className="mt-3 text-sm font-bold text-green-600 dark:text-green-400">
                                    {messageFeedback[index].encouragement}
                                  </p>
                                ) : null}
                              </Banner>
                            )}
                          </div>
                        ) : null}

                        {isAssistant && !message.streaming && isLast && conversationEnded ? (
                          <div className="mt-4">
                            <Banner title="대화가 종료되었습니다">
                              <div className="flex items-center justify-between gap-3">
                                <p className="text-sm font-semibold opacity-90">수고하셨습니다!</p>
                                <button
                                  type="button"
                                  onClick={() => navigate('/home')}
                                  className="rounded-full px-4 py-2 text-sm font-bold border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 hover:border-primary/30 hover:text-primary transition"
                                >
                                  홈으로
                                </button>
                              </div>
                            </Banner>
                          </div>
                        ) : null}
                      </div>
                    </div>
                  );
                })}

                {isAILoading ? (
                  <div className="flex flex-col items-center justify-center py-10 opacity-70">
                    <div className="flex items-center gap-1.5 mb-2 h-12">
                      <div className="w-1.5 bg-primary/60 h-4 rounded-full"></div>
                      <div className="w-1.5 bg-primary/60 h-8 rounded-full"></div>
                      <div className="w-1.5 bg-primary/60 h-12 rounded-full"></div>
                      <div className="w-1.5 bg-primary/60 h-10 rounded-full"></div>
                      <div className="w-1.5 bg-primary/60 h-5 rounded-full"></div>
                    </div>
                    <span className="text-xs font-bold text-primary tracking-[0.2em] uppercase">AI is analyzing...</span>
                  </div>
                ) : null}

              </div>
            </div>

            <div className="shrink-0 border-t border-gray-100 dark:border-white/10 bg-white dark:bg-background-dark">
              <div className="max-w-6xl mx-auto px-3 md:px-5 py-3">
                {(suggestedReplies.length > 0 || suggestLoading) && (
                  <div className="mb-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-black uppercase tracking-widest text-gray-500 dark:text-gray-400 flex items-center gap-2">
                        <span className="material-symbols-outlined text-sm text-primary">lightbulb</span>
                        Suggestions {suggestLoading ? '(불러오는 중...)' : ''}
                      </p>
                      <button
                        type="button"
                        onClick={() => {
                          setSuggestedReplies([]);
                          setInputHint('');
                        }}
                        disabled={suggestLoading && suggestedReplies.length === 0}
                        className="text-xs font-black text-primary hover:underline disabled:opacity-50"
                      >
                        닫기
                      </button>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {suggestedReplies.map((s, idx) => {
                        const selected = inputHint === s;
                        return (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => {
                              setInputHint(s);
                              composerRef.current?.focus?.();
                            }}
                            className={clsx(
                              'rounded-full px-3 py-1.5 text-sm font-semibold border transition',
                              selected
                                ? 'bg-primary text-white border-primary'
                                : 'bg-white dark:bg-white/5 border-gray-200 dark:border-white/10 hover:border-primary/30 hover:text-primary'
                            )}
                          >
                            {s}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div className="flex items-end gap-3">
                  <div className="flex-1">
                    <textarea
                      ref={composerRef}
                      value={inputText}
                      onChange={(e) => setInputText(e.target.value)}
                      placeholder={inputHint || placeholderText}
                      disabled={showComposerDisabled}
                      rows={1}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          handleSendMessage();
                        }
                      }}
                      className="w-full resize-none rounded-2xl bg-gray-100 dark:bg-white/5 text-[#111418] dark:text-white placeholder:text-gray-500 dark:placeholder:text-gray-400 px-4 py-3 text-sm font-medium outline-none border border-transparent focus:border-primary/30 disabled:opacity-60 disabled:cursor-not-allowed"
                    />
                    {inputHint ? (
                      <div className="mt-2 flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() => {
                            setInputText(inputHint);
                            composerRef.current?.focus?.();
                          }}
                          className="text-xs font-black text-primary hover:underline"
                        >
                          Use hint
                        </button>
                        <button
                          type="button"
                          onClick={() => setInputHint('')}
                          className="text-xs font-black text-gray-500 dark:text-gray-400 hover:underline"
                        >
                          Clear
                        </button>
                      </div>
                    ) : null}
                  </div>
                  <button
                    type="button"
                    onClick={handleSendMessage}
                    disabled={conversationEnded || !inputText.trim() || isTranscribing || isAILoading || !conversationIdRef.current}
                    className="inline-flex items-center justify-center rounded-full size-12 bg-primary text-white shadow-lg shadow-primary/20 hover:bg-primary/90 transition disabled:opacity-60 disabled:cursor-not-allowed"
                    title="전송"
                  >
                    <span className="material-symbols-outlined">send</span>
                  </button>
                </div>

                {(vadTrimError || replayError) && (
                  <div className="mt-3 space-y-2">
                    {vadTrimError ? <Banner tone="warning" title="오디오 처리">{vadTrimError}</Banner> : null}
                    {replayError ? <Banner tone="warning" title="오디오 재생">{replayError}</Banner> : null}
                  </div>
                )}
              </div>

              <div className="p-3 md:p-4">
                <div className="max-w-6xl mx-auto flex items-center justify-center relative">
                  {/* Center group: MIC + 다시듣기 */}
                  <div className="flex gap-4 items-center">
                    {/* MIC button */}
                    <div className="relative flex items-center justify-center">
                      {isRecordingNow ? <ProgressRing valuePercent={micProgressPct} /> : null}
                      <button
                        type="button"
                        onClick={handleMicToggle}
                        disabled={!canClickMic}
                        className={clsx(
                          'flex items-center justify-center rounded-full size-20 text-white shadow-2xl transition-transform disabled:opacity-60 disabled:cursor-not-allowed',
                          isRecordingNow
                            ? 'bg-red-500 shadow-red-500/20 hover:scale-105'
                            : 'bg-primary shadow-primary/30 hover:scale-105'
                        )}
                        title={
                          isRecordingNow
                            ? `녹음 중지 (${Math.floor((MAX_RECORDING_DURATION - recordingDuration) / 1000)}초 남음)`
                            : '녹음 시작'
                        }
                      >
                        <span className="material-symbols-outlined text-4xl">{isRecordingNow ? 'mic_off' : 'mic'}</span>
                      </button>
                    </div>

                    {/* VAD replay button - 항상 표시 */}
                    <IconPillButton
                      icon="graphic_eq"
                      label="다시듣기"
                      onClick={playLastVad}
                      disabled={!lastVadReplayPcmRef.current || isVadTrimming || isRecordingNow || isSpeaking}
                      title={
                        !lastVadReplayPcmRef.current
                          ? '녹음 후 다시듣기 가능'
                          : isVadTrimming
                          ? '음성 추출 중...'
                          : '내 말 다시듣기'
                      }
                    />
                  </div>

                  {/* Right: END SESSION (absolute positioning) */}
                  <button
                    type="button"
                    onClick={handleEndSession}
                    className="absolute right-0 px-6 md:px-8 py-3 rounded-full bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 font-black text-sm hover:bg-red-100 dark:hover:bg-red-500/15 transition-colors"
                  >
                    END SESSION
                  </button>
                </div>
              </div>
            </div>

            <FloatingCameraPreview
              videoRef={videoRef}
              canvasRef={canvasRef}
              showGrid={showGrid}
              setShowGrid={setShowGrid}
              showMouthLandmarks={showMouthLandmarks}
              setShowMouthLandmarks={setShowMouthLandmarks}
              title="Live Preview"
            />
          </section>

          <aside className="hidden lg:flex flex-[3] max-w-sm flex-col min-h-0 bg-gray-50/50 dark:bg-background-dark/80 p-6 gap-6 overflow-hidden">
            {/* Suggestions 섹션 제거 - 입력창 위에만 표시 */}

            <div className="bg-white dark:bg-white/5 p-6 rounded-2xl border border-gray-200 dark:border-white/10">
              <div className="flex items-center justify-between mb-4">
                <span className="text-xs font-black text-gray-500 dark:text-gray-400 uppercase tracking-widest">
                  Learning Stats
                </span>
              </div>

              <div className="space-y-5">
                <div>
                  <div className="flex justify-between items-end">
                    <span className="text-xs text-gray-500 dark:text-gray-400">응답 품질(마지막)</span>
                    <span className="text-xs font-black text-primary">
                      {lastQuality ? `${lastQuality.overallScore}점` : '-'}
                    </span>
                  </div>
                  {lastQuality ? (
                    <div className="mt-2 flex items-center gap-2">
                      <span className="inline-flex items-center rounded-full px-3 py-1 text-xs font-black bg-primary/10 text-primary border border-primary/20">
                        {getResponseQualityFeedback(lastQuality.overallScore).message}
                      </span>
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        {lastQuality.wordCount}단어 · {lastQuality.wordsPerMinute.toFixed(0)} wpm
                      </span>
                    </div>
                  ) : null}
                </div>

                <div>
                  <div className="flex justify-between items-end">
                    <span className="text-xs text-gray-500 dark:text-gray-400">응답 품질(평균)</span>
                    <span className="text-xs font-black text-primary">{avgQuality ? `${avgQuality.toFixed(1)}점` : '-'}</span>
                  </div>
                  <div className="mt-2 w-full bg-gray-100 dark:bg-white/10 h-1.5 rounded-full overflow-hidden">
                    <div className="bg-primary h-full w-[75%]" />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between items-end">
                    <span className="text-xs text-gray-500 dark:text-gray-400">발화 밀도</span>
                    <span className="text-xs font-black text-primary">
                      {netDensity != null && netDensity > 0 ? `${netDensity.toFixed(1)}%` : '-'}
                    </span>
                  </div>
                  <div className="mt-2 w-full bg-gray-100 dark:bg-white/10 h-1.5 rounded-full overflow-hidden">
                    <div className="bg-green-500 h-full w-[92%]" />
                  </div>
                  {netDensity != null && netDensity > 0 ? (
                    <p className="mt-2 text-xs font-bold text-gray-500 dark:text-gray-400">
                      {getNetSpeakingDensityFeedback(netDensity).message}
                    </p>
                  ) : null}
                </div>
              </div>
            </div>

          </aside>
        </main>
      </div>

      <TutorFeedbackOverlay />
    </StudentLayout>
  );
}
