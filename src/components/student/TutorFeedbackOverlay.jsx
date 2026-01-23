import { useState, useEffect, useRef } from 'react';
import { useSelector } from 'react-redux';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Stack,
  Avatar,
  IconButton,
  Badge,
  Fab,
  Alert,
  Chip,
} from '@mui/material';
import {
  Person,
  VolumeUp,
  Notifications,
  Close,
  CheckCircle,
  NotificationsOff,
  OpenInFull,
  VolumeOff,
} from '@mui/icons-material';
import { useWebSocket } from '../../hooks/useWebSocket';
import { useTTSAudio } from '../../hooks/useTTSAudio';

/**
 * 텍스트의 언어를 감지합니다 (한글 포함 여부 확인)
 * @param {string} text
 * @returns {'ko' | 'en'}
 */
function detectLanguage(text) {
  // 한글 범위: U+AC00 ~ U+D7AF
  return /[\uAC00-\uD7AF]/.test(text) ? 'ko' : 'en';
}

/**
 * 튜터 피드백 오버레이 컴포넌트
 * - ChatPage 우측 하단에 독립적으로 표시
 * - WebSocket을 통한 실시간 피드백 수신
 * - 브라우저 알림 지원
 */
export default function TutorFeedbackOverlay() {
  const user = useSelector((state) => state.auth.user);
  const [feedbacks, setFeedbacks] = useState([]);
  const [isExpanded, setIsExpanded] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const { playText } = useTTSAudio();
  const panelRef = useRef(null);

  // 학생 제어 옵션
  const [doNotDisturb, setDoNotDisturb] = useState(false);   // 방해금지 모드
  const [autoExpand, setAutoExpand] = useState(true);         // 자동 패널 확장
  const [autoPlayTTS, setAutoPlayTTS] = useState(false);     // TTS 자동재생

  // WebSocket 메시지 핸들러
  const handleWebSocketMessage = (message) => {
    if (message.type === 'feedback') {
      const newFeedback = {
        ...message,
        tutor_email: message.from || message.tutor_email, // 백엔드가 'from' 필드 사용
        receivedAt: new Date().toISOString(),
        isRead: false,
      };
      
      // 피드백 저장 및 카운트 증가 (항상 실행)
      setFeedbacks((prev) => {
        const updated = [newFeedback, ...prev].slice(0, 20);
        return updated;
      });
      setUnreadCount((prev) => prev + 1);
            
      // 자동 패널 확장 (설정에 따라)
      if (autoExpand) {
        setIsExpanded(true);
      }
            
      // 브라우저 알림 (방해금지 모드 아닐 때만)
      if ('Notification' in window) {
        if (Notification.permission === 'granted') {
          try {
            const notification = new Notification('튜터 피드백 도착!', {
              body: message.message || '새로운 피드백이 도착했습니다.',
              icon: '/tutor-icon.png',
              badge: '/tutor-badge.png',
              tag: 'tutor-feedback',
              requireInteraction: false,
            });
          } catch (error) {
            console.error('❌ 알림 생성 실패:', error);
          }
        } else {
          console.warn('⚠️ 알림 권한 없음:', Notification.permission);
        }
      } else {
        console.error('❌ 브라우저가 Notification API를 지원하지 않습니다');
      }
      
      // TTS 자동 재생 (설정에 따라)
      if (autoPlayTTS && message.messageType === 'tts' && message.message) {
        const language = detectLanguage(message.message);
        playText(message.message, { language });
      }
    } else {
      console.warn('⚠️ 피드백 타입이 아닙니다:', {
        received_type: message.type,
        expected: 'feedback',
        fullMessage: message,
      });
    }
  };

  // WebSocket 연결
  const { isConnected, error: wsError } = useWebSocket(
    user?.email,
    null, // tutorEmail (학생은 null)
    handleWebSocketMessage
  );

  // 브라우저 알림 권한 요청
  useEffect(() => {
    if ('Notification' in window) {
      if (Notification.permission === 'default') {
        Notification.requestPermission().then((permission) => {
          if (permission === 'denied') {
            console.warn('⚠️ 사용자가 알림 권한을 거부했습니다. 브라우저 설정에서 허용해주세요.');
          }
        });
      } else if (Notification.permission === 'denied') {
        console.warn('⚠️ 알림이 차단되어 있습니다. 브라우저 주소창 왼쪽 자물쇠 아이콘을 클릭하여 알림을 허용해주세요.');
      }
    } else {
      console.error('❌ 이 브라우저는 Notification API를 지원하지 않습니다.');
    }
  }, []);

  // 패널 외부 클릭 시 닫기
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (isExpanded && panelRef.current && !panelRef.current.contains(event.target)) {
        // FAB 버튼 클릭은 제외
        const fab = event.target.closest('[data-testid="fab-button"]');
        if (!fab) {
          setIsExpanded(false);
          setUnreadCount(0);
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isExpanded]);

  // 확장 시 읽음 처리
  useEffect(() => {
    if (isExpanded && unreadCount > 0) {
      const timer = setTimeout(() => {
        setUnreadCount(0);
        setFeedbacks((prev) =>
          prev.map((fb) => ({ ...fb, isRead: true }))
        );
      }, 1000);
      
      return () => clearTimeout(timer);
    }
  }, [isExpanded, unreadCount]);

  const handlePlayAudio = (text, audioUrl) => {
    if (audioUrl) {
      const audio = new Audio(audioUrl);
      audio.play().catch((err) => {
        console.error('오디오 재생 실패:', err);
        // 오디오 재생 실패 시 브라우저 TTS로 대체
        playBrowserTTS(text);
      });
    } else if (text) {
      // 브라우저 내장 TTS 사용 (서버 API 호출 없음)
      playBrowserTTS(text);
    }
  };

  const playBrowserTTS = (text) => {
    if (!text || !window.speechSynthesis) return;

    // 기존 음성 중단
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'en-US'; // 영어
    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    utterance.volume = 1.0;
    
    utterance.onerror = (e) => console.error('❌ TTS 오류:', e);

    window.speechSynthesis.speak(utterance);
  };

  const handleClearAll = () => {
    setFeedbacks([]);
    setUnreadCount(0);
  };

  return (
    <>
      {/* 우측 하단 FAB 버튼 */}
      <Fab
        data-testid="fab-button"
        color="primary"
        sx={{
          position: 'fixed',
          bottom: 24,
          right: 24,
          zIndex: 1300,
          boxShadow: 4,
          '&:hover': {
            boxShadow: 8,
          },
        }}
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <Badge 
          badgeContent={unreadCount} 
          color="error"
          max={99}
        >
          <Notifications />
        </Badge>
      </Fab>

      {/* 피드백 패널 */}
      <Box
        ref={panelRef}
        sx={{
          position: 'fixed',
          bottom: isExpanded ? 90 : -600,
          right: 24,
          width: 420,
          maxHeight: 550,
          zIndex: 1300,
          transition: 'bottom 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          boxShadow: 10,
        }}
      >
        <Card elevation={12}>
          <CardContent sx={{ p: 0 }}>
            {/* 헤더 */}
            <Box
              sx={{
                p: 2,
                bgcolor: '#ff9800',
                color: 'white',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <Stack direction="row" spacing={1} alignItems="center">
                <Notifications />
                <Typography variant="h6" sx={{ fontWeight: 600 }}>
                  튜터 피드백
                </Typography>
                {!isConnected && (
                  <Chip
                    label="연결 안됨"
                    size="small"
                    sx={{ bgcolor: 'rgba(255,255,255,0.3)', color: 'white' }}
                  />
                )}
              </Stack>
              
              <Stack direction="row" spacing={0.5}>
                {/* 방해금지 모드 */}
                <IconButton
                  size="small"
                  sx={{ 
                    color: 'white',
                    bgcolor: doNotDisturb ? 'rgba(255,255,255,0.3)' : 'transparent',
                  }}
                  onClick={() => {
                    const newDND = !doNotDisturb;
                    setDoNotDisturb(newDND);
                    // 방해금지 모드 ON 시 자동확장과 TTS도 OFF
                    if (newDND) {
                      setAutoExpand(false);
                      setAutoPlayTTS(false);
                    }
                  }}
                  title={doNotDisturb ? '방해금지 모드 켜짐' : '방해금지 모드 끄기'}
                >
                  {doNotDisturb ? <NotificationsOff fontSize="small" /> : <Notifications fontSize="small" />}
                </IconButton>
                
                {/* 자동 패널 확장 */}
                <IconButton
                  size="small"
                  sx={{ 
                    color: 'white',
                    bgcolor: autoExpand ? 'rgba(255,255,255,0.3)' : 'transparent',
                    opacity: doNotDisturb ? 0.5 : 1,
                  }}
                  onClick={() => {
                    // 방해금지 모드일 때는 자동확장 켤 수 없음
                    if (!doNotDisturb) {
                      setAutoExpand(!autoExpand);
                    }
                  }}
                  title={doNotDisturb ? '방해금지 모드에서는 사용 불가' : (autoExpand ? '자동 확장 켜짐' : '자동 확장 끄기')}
                >
                  <OpenInFull fontSize="small" />
                </IconButton>
                
                {/* TTS 자동재생 */}
                <IconButton
                  size="small"
                  sx={{ 
                    color: 'white',
                    bgcolor: autoPlayTTS ? 'rgba(255,255,255,0.3)' : 'transparent',
                    opacity: doNotDisturb ? 0.5 : 1,
                  }}
                  onClick={() => {
                    // 방해금지 모드일 때는 TTS 자동재생 켤 수 없음
                    if (!doNotDisturb) {
                      setAutoPlayTTS(!autoPlayTTS);
                    }
                  }}
                  title={doNotDisturb ? '방해금지 모드에서는 사용 불가' : (autoPlayTTS ? 'TTS 자동재생 켜짐' : 'TTS 자동재생 끄기')}
                >
                  {autoPlayTTS ? <VolumeUp fontSize="small" /> : <VolumeOff fontSize="small" />}
                </IconButton>
                
                <IconButton
                  size="small"
                  sx={{ color: 'white' }}
                  onClick={() => setIsExpanded(false)}
                  title="닫기"
                >
                  <Close fontSize="small" />
                </IconButton>
              </Stack>
            </Box>

            {/* WebSocket 연결 상태 */}
            {wsError && (
              <Alert severity="error" sx={{ m: 2, mb: 0 }}>
                {wsError}
              </Alert>
            )}

            {/* 피드백 리스트 */}
            <Box
              sx={{
                maxHeight: 450,
                overflowY: 'auto',
                p: 2,
                bgcolor: '#fafafa',
              }}
            >
              <Stack spacing={1.5}>
                {feedbacks.length === 0 ? (
                  <Box
                    sx={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      py: 6,
                      color: 'text.secondary',
                    }}
                  >
                    <Notifications sx={{ fontSize: 60, opacity: 0.3, mb: 2 }} />
                    <Typography variant="body2" textAlign="center">
                      아직 피드백이 없습니다
                    </Typography>
                    <Typography variant="caption" textAlign="center" sx={{ mt: 0.5 }}>
                      튜터가 보내는 피드백이 여기에 표시됩니다
                    </Typography>
                  </Box>
                ) : (
                  feedbacks.map((fb, idx) => (
                    <Card
                      key={idx}
                      sx={{
                        bgcolor: fb.isRead ? 'white' : '#fff3e0',
                        border: fb.isRead ? 'none' : '2px solid #ff9800',
                        transition: 'all 0.3s ease',
                        '&:hover': {
                          boxShadow: 3,
                        },
                      }}
                    >
                      <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
                        <Stack direction="row" spacing={1.5} alignItems="flex-start">
                          <Avatar
                            sx={{
                              bgcolor: '#ff9800',
                              width: 40,
                              height: 40,
                            }}
                          >
                            <Person />
                          </Avatar>
                          
                          <Box sx={{ flex: 1, minWidth: 0 }}>
                            {/* 튜터 이메일 */}
                            <Typography
                              variant="caption"
                              color="text.secondary"
                              sx={{ display: 'block', mb: 0.5 }}
                            >
                              {fb.tutor_email || '튜터'}
                            </Typography>
                            
                            {/* 피드백 메시지 */}
                            <Typography
                              variant="body1"
                              sx={{
                                wordBreak: 'break-word',
                                whiteSpace: 'pre-wrap',
                                mb: 0.5,
                              }}
                            >
                              {fb.message}
                            </Typography>
                            
                            {/* 타임스탬프 */}
                            <Typography variant="caption" color="text.secondary">
                              {new Date(fb.timestamp || fb.receivedAt).toLocaleString('ko-KR', {
                                month: 'short',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </Typography>
                            
                            {/* 메시지 타입 */}
                            {fb.message_type && (
                              <Chip
                                label={fb.message_type === 'tts' ? 'TTS' : '텍스트'}
                                size="small"
                                sx={{ ml: 1, height: 20, fontSize: '0.7rem' }}
                              />
                            )}
                          </Box>
                          
                          {/* 오디오 재생 버튼 */}
                          <IconButton
                            size="small"
                            onClick={() => handlePlayAudio(fb.message, null)}
                            sx={{ color: '#ff9800' }}
                            title="음성으로 듣기"
                          >
                            <VolumeUp fontSize="small" />
                          </IconButton>
                        </Stack>
                      </CardContent>
                    </Card>
                  ))
                )}
              </Stack>
            </Box>

            {/* 연결 상태 표시 */}
            <Box
              sx={{
                p: 1,
                bgcolor: isConnected ? '#e8f5e9' : '#ffebee',
                borderTop: 1,
                borderColor: 'divider',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 1,
              }}
            >
              <Box
                sx={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  bgcolor: isConnected ? '#4caf50' : '#f44336',
                  animation: isConnected ? 'pulse 2s infinite' : 'none',
                  '@keyframes pulse': {
                    '0%, 100%': { opacity: 1 },
                    '50%': { opacity: 0.5 },
                  },
                }}
              />
              <Typography variant="caption" color={isConnected ? 'success.main' : 'error.main'}>
                {isConnected ? '실시간 연결 중' : '연결 안됨'}
              </Typography>
            </Box>
          </CardContent>
        </Card>
      </Box>
    </>
  );
}
