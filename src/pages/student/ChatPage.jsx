import { useState, useRef, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
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
} from '@mui/icons-material';
import StudentLayout from '../../components/common/StudentLayout';

// Hooks
import { useMediaPipe } from '../../hooks/conversation/useMediaPipe';
import { useAudioDetection } from '../../hooks/conversation/useAudioDetection';
import { useSpeakingTimer } from '../../hooks/conversation/useSpeakingTimer';
import { useTTS } from '../../hooks/conversation/useTTS';
import { useSpeechRecognition } from '../../hooks/conversation/useSpeechRecognition';
import { useClaudeConversation } from '../../hooks/conversation/useClaudeConversation';

// Data
import { scenarios, getScenarioById } from '../../data/conversation/scenarios';
import { isApiKeyConfigured } from '../../service/conversation/claudeClient';

export default function ChatPage() {
  const location = useLocation();
  const navigate = useNavigate();

  // Refs
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const messagesEndRef = useRef(null);
  const initialMessageSentRef = useRef(false);
  const lastAutoSpokenRef = useRef(null);

  // Get difficulty and scenario from navigation state
  const difficulty = location.state?.difficulty || '중';
  const initialScenario = location.state?.scenario || 'restaurant';

  // State - Scenario
  const [currentScenario, setCurrentScenario] = useState(initialScenario);

  // State - Messages
  const [messages, setMessages] = useState([]);
  const [revealedMessages, setRevealedMessages] = useState(new Set());

  // State - Input
  const [isRecording, setIsRecording] = useState(false);
  const [inputText, setInputText] = useState('');
  const [currentSpeakingTime, setCurrentSpeakingTime] = useState(0);

  // State - UI
  const [showMouthLandmarks, setShowMouthLandmarks] = useState(false);
  const [showGrid, setShowGrid] = useState(false);
  const [hasCameraPermission, setHasCameraPermission] = useState(null);
  const [permissionError, setPermissionError] = useState(null);
  const [hasApiKey, setHasApiKey] = useState(true);

  // Hooks - MediaPipe & Audio
  const { landmarksRef, isModelLoaded, error: mediaPipeError } = useMediaPipe(
    videoRef,
    canvasRef,
    { showGrid, showMouthLandmarks }
  );

  const { audioVolume, isInitialized: isAudioInit } = useAudioDetection(isRecording);

  const { totalTime, speakingTime, ratio, currentlySpeaking, resetTimers } =
    useSpeakingTimer(isRecording, landmarksRef, audioVolume);

  // Hooks - TTS & STT
  const { speak, stop, isSpeaking } = useTTS();

  const { transcript } = useSpeechRecognition(
    isRecording,
    (text) => {
      // STT 콜백 - 녹음 중에는 아무것도 하지 않음
    },
    (error) => console.error('STT Error:', error)
  );

  // Hooks - Claude API
  const { sendMessage, isLoading: isAILoading, error: aiError } = useClaudeConversation();

  // Camera permission
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

  // API Key check
  useEffect(() => {
    setHasApiKey(isApiKeyConfigured());
  }, []);

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

  // STT result to text field
  useEffect(() => {
    if (!isRecording && transcript) {
      setInputText(transcript);
    }
  }, [isRecording, transcript]);

  // Auto scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Initial AI message
  const sendInitialMessage = async () => {
    if (!hasApiKey) return;

    setMessages([]); // Clear messages
    const scenario = getScenarioById(currentScenario);
    const systemPrompt = scenario.systemPrompt('Student', difficulty);

    try {
      // Send a greeting request instead of empty message
      await sendMessage(
        'Hello, I would like to start practicing.',
        [],
        systemPrompt,
        difficulty,
        onStream,
        onComplete
      );
    } catch (error) {
      console.error('Initial message error:', error);
    }
  };

  // Mic toggle handler
  const handleMicToggle = () => {
    if (isRecording) {
      // Stop recording
      setIsRecording(false);
      setCurrentSpeakingTime(speakingTime / 1000); // Convert to seconds
    } else {
      // Start recording
      setInputText('');
      setIsRecording(true);
      resetTimers();
    }
  };

  // Send message handler
  const handleSendMessage = async () => {
    if (!inputText.trim() || isAILoading) return;

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

    // Send to AI
    const scenario = getScenarioById(currentScenario);
    const systemPrompt = scenario.systemPrompt('Student', difficulty);

    try {
      await sendMessage(
        messageToSend,
        messages,
        systemPrompt,
        difficulty,
        onStream,
        onComplete
      );
    } catch (error) {
      console.error('Send message error:', error);
    }
  };

  // Streaming callback
  const onStream = (textDelta, fullResponse) => {
    setMessages((prev) => {
      const newMessages = [...prev];
      const lastMsg = newMessages[newMessages.length - 1];

      if (lastMsg?.role === 'assistant' && lastMsg.streaming) {
        lastMsg.content = fullResponse;
      } else {
        newMessages.push({
          role: 'assistant',
          content: fullResponse,
          streaming: true,
          timestamp: new Date(),
        });
      }

      return newMessages;
    });
  };

  // Complete callback
  const onComplete = (fullResponse) => {
    setMessages((prev) => {
      const newMessages = [...prev];
      const lastMsg = newMessages[newMessages.length - 1];
      if (lastMsg) {
        lastMsg.streaming = false;
      }
      return newMessages;
    });

    // Auto TTS: speak assistant response as soon as streaming completes
    if (!fullResponse || isRecording || !hasApiKey) return;
    if (lastAutoSpokenRef.current === fullResponse) return;
    lastAutoSpokenRef.current = fullResponse;

    try {
      stop();
      speak(fullResponse, { lang: 'en-US', rate: 0.9 });
    } catch (e) {
      console.error('Auto TTS error:', e);
    }
  };

  // Play AI message with TTS
  const handlePlayAIMessage = (content) => {
    if (!content) return;
    stop();
    speak(content, { lang: 'en-US', rate: 0.9 });
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

  return (
    <StudentLayout todayTime={Math.floor(totalTime / 1000 / 60)}>
      <Box sx={{ maxWidth: 1400, mx: 'auto', width: '100%', height: 'calc(100vh - 200px)' }}>
        {/* API Key Warning */}
        {!hasApiKey && (
          <Alert severity="warning" sx={{ mb: 2 }}>
            Claude API 키가 설정되지 않았습니다. .env.local 파일에 VITE_CLAUDE_API_KEY를 추가해주세요.
          </Alert>
        )}

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
            AI 응답 오류: {aiError.message}
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
                      icon={currentlySpeaking ? <Mic /> : <MicOff />}
                      label={currentlySpeaking ? '🎤 발음 중...' : '준비'}
                      color={currentlySpeaking ? 'success' : 'default'}
                      sx={{ fontSize: '1rem', py: 2, px: 1 }}
                    />
                  </Box>

                  {/* Time Display */}
                  <Stack direction="row" spacing={2} justifyContent="center">
                    <Box sx={{ textAlign: 'center' }}>
                      <Typography variant="h6" sx={{ fontWeight: 700 }}>
                        {formatTime(speakingTime)}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        발음 시간
                      </Typography>
                    </Box>
                    <Box sx={{ textAlign: 'center' }}>
                      <Typography variant="h6" sx={{ fontWeight: 700 }}>
                        {formatTime(totalTime)}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        전체 시간
                      </Typography>
                    </Box>
                  </Stack>

                  {/* Progress Bar */}
                  <Box>
                    <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>
                      발음 비율: {ratio}%
                    </Typography>
                    <LinearProgress
                      variant="determinate"
                      value={ratio}
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
                    총 대화 시간: {formatTime(totalTime)}
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
                            bgcolor: message.role === 'assistant' ? '#9C27B0' : '#2196F3',
                          }}
                        >
                          {message.role === 'assistant' ? <SmartToy /> : <Person />}
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
                                bgcolor: message.role === 'assistant' ? '#f5f5f5' : '#e3f2fd',
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
                    color={isRecording ? 'error' : 'primary'}
                    onClick={handleMicToggle}
                    disabled={isAILoading || !hasApiKey}
                  >
                    {isRecording ? <MicOff /> : <Mic />}
                  </IconButton>

                  <TextField
                    fullWidth
                    multiline
                    maxRows={3}
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    placeholder={
                      isRecording ? '녹음 중...' : '메시지를 입력하거나 마이크를 사용하세요'
                    }
                    disabled={isRecording || isAILoading || !hasApiKey}
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
                    disabled={!inputText.trim() || isAILoading || !hasApiKey}
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
