import { useState, useEffect, useRef, useCallback } from 'react';
import { useSelector } from 'react-redux';
import ws from '../../config/webSocketConfig';
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
  // WebSocket 연결 상태
  const [isConnected, setIsConnected] = useState(false);
  const [wsError, setWsError] = useState(null);

  const [feedbacks, setFeedbacks] = useState([]);
  const [isExpanded, setIsExpanded] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const { playText } = useTTSAudio();
  const panelRef = useRef(null);

  // 학생 제어 옵션
  const [doNotDisturb, setDoNotDisturb] = useState(false);   // 방해금지 모드
  const [autoExpand, setAutoExpand] = useState(true);         // 자동 패널 확장
  const [autoPlayTTS, setAutoPlayTTS] = useState(false);     // TTS 자동재생

  // WebSocket 메시지 핸들러 (useCallback으로 메모이제이션)
  const handleWebSocketMessage = useCallback((message) => {
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
      
      // 방해금지 모드일 때는 알림/확장/TTS 모두 건너뜀
      if (doNotDisturb) {
        return;
      }
            
      // 자동 패널 확장 (설정에 따라)
      if (autoExpand) {
        setIsExpanded(true);
      }
            
      // 브라우저 알림
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
      const isTTS = message.messageType === 'tts';
      if (autoPlayTTS && isTTS && message.message) {
        // audio_url이 있으면 우선 사용, 없으면 브라우저 TTS
        if (message.audio_url) {
          const audio = new Audio(message.audio_url);
          audio.play().catch((err) => {
            console.error('오디오 재생 실패, 브라우저 TTS로 대체:', err);
            const language = detectLanguage(message.message);
            playText(message.message, { language });
          });
        } else {
          const language = detectLanguage(message.message);
          playText(message.message, { language });
        }
      }
    } else {
      console.warn('⚠️ 피드백 타입이 아닙니다:', {
        received_type: message.type,
        expected: 'feedback',
        fullMessage: message,
      });
    }
  }, [doNotDisturb, autoExpand, autoPlayTTS, playText]);

  // WebSocket 연결 (Singleton 사용)
  useEffect(() => {
    if (!user?.email) return;

    // Singleton WebSocket 연결
    const socket = ws.connect();

    // 연결 상태 추적
    const updateConnectionStatus = () => {
      setIsConnected(socket?.readyState === WebSocket.OPEN);
    };

    // 초기 상태 설정
    updateConnectionStatus();

    // 메시지 리스너 등록
    const unsubscribe = ws.addMessageListener(handleWebSocketMessage);

    // 연결 상태 폴링 (간단한 방법)
    const statusInterval = setInterval(updateConnectionStatus, 1000);

    return () => {
      unsubscribe(); // 리스너만 제거, 연결은 유지
      clearInterval(statusInterval);
    };
  }, [user?.email, handleWebSocketMessage]);

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

  // 시간 포맷
  const formatTime = (timestamp) => {
    return new Date(timestamp).toLocaleString('ko-KR', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <>
      {/* 우측 하단 FAB 버튼 */}
      <button
        data-testid="fab-button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="fixed bottom-6 right-6 z-[1300] size-14 rounded-full bg-[#137fec] text-white shadow-lg hover:shadow-xl hover:scale-105 active:scale-95 transition-all flex items-center justify-center"
      >
        <span className="material-symbols-outlined text-2xl">notifications</span>
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 size-6 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center border-2 border-white">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* 피드백 패널 */}
      <div
        ref={panelRef}
        className={`fixed right-6 w-[400px] max-h-[550px] z-[1300] transition-all duration-300 ease-out shadow-2xl rounded-xl overflow-hidden ${
          isExpanded ? 'bottom-24 opacity-100 translate-y-0' : '-bottom-[600px] opacity-0 translate-y-4'
        }`}
      >
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col h-[550px]">
          {/* 헤더 */}
          <div className="bg-[#137fec] p-4 flex items-center justify-between text-white shrink-0">
            <div className="flex items-center gap-3">
              <div className="size-10 rounded-full bg-white/20 flex items-center justify-center">
                <span className="material-symbols-outlined">school</span>
              </div>
              <div>
                <h4 className="font-bold text-sm leading-tight">튜터 피드백</h4>
                <p className="text-[10px] text-white/80 uppercase tracking-wider font-bold flex items-center gap-1">
                  <span className={`size-2 rounded-full ${isConnected ? 'bg-green-400' : 'bg-red-400'}`}></span>
                  {isConnected ? '실시간 연결 중' : '연결 안됨'}
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-1">
              {/* 방해금지 모드 */}
              <button
                onClick={() => {
                  const newDND = !doNotDisturb;
                  setDoNotDisturb(newDND);
                  if (newDND) {
                    setAutoExpand(false);
                    setAutoPlayTTS(false);
                  }
                }}
                className={`size-8 rounded-lg flex items-center justify-center transition-colors ${
                  doNotDisturb ? 'bg-white/30' : 'hover:bg-white/20'
                }`}
                title={doNotDisturb ? '방해금지 모드 켜짐' : '방해금지 모드 끄기'}
              >
                <span className="material-symbols-outlined text-lg">
                  {doNotDisturb ? 'notifications_off' : 'notifications'}
                </span>
              </button>
              
              {/* 자동 패널 확장 */}
              <button
                onClick={() => !doNotDisturb && setAutoExpand(!autoExpand)}
                className={`size-8 rounded-lg flex items-center justify-center transition-colors ${
                  autoExpand ? 'bg-white/30' : 'hover:bg-white/20'
                } ${doNotDisturb ? 'opacity-50 cursor-not-allowed' : ''}`}
                title={doNotDisturb ? '방해금지 모드에서는 사용 불가' : (autoExpand ? '자동 확장 켜짐' : '자동 확장 끄기')}
              >
                <span className="material-symbols-outlined text-lg">open_in_full</span>
              </button>
              
              {/* TTS 자동재생 */}
              <button
                onClick={() => !doNotDisturb && setAutoPlayTTS(!autoPlayTTS)}
                className={`size-8 rounded-lg flex items-center justify-center transition-colors ${
                  autoPlayTTS ? 'bg-white/30' : 'hover:bg-white/20'
                } ${doNotDisturb ? 'opacity-50 cursor-not-allowed' : ''}`}
                title={doNotDisturb ? '방해금지 모드에서는 사용 불가' : (autoPlayTTS ? 'TTS 자동재생 켜짐' : 'TTS 자동재생 끄기')}
              >
                <span className="material-symbols-outlined text-lg">
                  {autoPlayTTS ? 'volume_up' : 'volume_off'}
                </span>
              </button>
              
              {/* 닫기 */}
              <button
                onClick={() => setIsExpanded(false)}
                className="size-8 rounded-lg flex items-center justify-center hover:bg-white/20 transition-colors"
                title="닫기"
              >
                <span className="material-symbols-outlined text-lg">close</span>
              </button>
            </div>
          </div>

          {/* WebSocket 에러 */}
          {wsError && (
            <div className="mx-4 mt-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-600 dark:text-red-400 text-sm">
              {wsError}
            </div>
          )}

          {/* 메시지 영역 */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50 dark:bg-slate-950/50">
            {/* 날짜 구분선 */}
            <div className="text-center">
              <span className="text-[10px] text-slate-400 uppercase font-bold tracking-widest bg-white dark:bg-slate-900 px-3 py-1 rounded-full border border-slate-100 dark:border-slate-800">
                오늘
              </span>
            </div>

            {feedbacks.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                <span className="material-symbols-outlined text-5xl mb-3 opacity-30">chat_bubble_outline</span>
                <p className="text-sm font-medium">아직 피드백이 없습니다</p>
                <p className="text-xs mt-1">튜터가 보내는 피드백이 여기에 표시됩니다</p>
              </div>
            ) : (
              feedbacks.map((fb, idx) => (
                <div key={idx} className="flex items-start gap-3 animate-in fade-in slide-in-from-bottom-2">
                  {/* 튜터 아바타 */}
                  <div className="size-9 rounded-full bg-[#137fec] flex items-center justify-center text-white text-sm font-bold shrink-0">
                    T
                  </div>
                  
                  {/* 메시지 내용 */}
                  <div className="flex-1 min-w-0">
                    {/* 튜터 이메일 */}
                    <p className="text-[10px] text-slate-400 font-medium mb-1 truncate">
                      {fb.tutor_email || '튜터'}
                    </p>
                    
                    {/* 말풍선 */}
                    <div className={`p-3 rounded-xl rounded-tl-none border shadow-sm transition-all ${
                      fb.isRead 
                        ? 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700' 
                        : 'bg-blue-50 dark:bg-blue-900/20 border-[#137fec]/30'
                    }`}>
                      <p className="text-sm text-slate-800 dark:text-slate-200 break-words whitespace-pre-wrap">
                        {fb.message}
                      </p>
                    </div>
                    
                    {/* 시간 및 타입 */}
                    <div className="flex items-center gap-2 mt-1.5 ml-1">
                      <span className="text-[10px] text-slate-400">
                        {formatTime(fb.timestamp || fb.receivedAt)}
                      </span>
                      {fb.messageType === 'tts' && (
                        <span className="text-[9px] bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 px-1.5 py-0.5 rounded font-bold uppercase">
                          TTS
                        </span>
                      )}
                    </div>
                  </div>
                  
                  {/* 오디오 재생 버튼 */}
                  <button
                    onClick={() => handlePlayAudio(fb.message, fb.audio_url)}
                    className="size-8 rounded-lg bg-slate-100 dark:bg-slate-800 text-[#137fec] hover:bg-[#137fec] hover:text-white transition-colors flex items-center justify-center shrink-0"
                    title="음성으로 듣기"
                  >
                    <span className="material-symbols-outlined text-lg">volume_up</span>
                  </button>
                </div>
              ))
            )}
          </div>

          {/* 하단 연결 상태 바 */}
          <div className={`px-4 py-2 border-t flex items-center justify-center gap-2 shrink-0 ${
            isConnected 
              ? 'bg-green-50 dark:bg-green-900/10 border-green-100 dark:border-green-900/30' 
              : 'bg-red-50 dark:bg-red-900/10 border-red-100 dark:border-red-900/30'
          }`}>
            <span className={`size-2 rounded-full animate-pulse ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}></span>
            <span className={`text-xs font-medium ${isConnected ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
              {isConnected ? '실시간 연결 중' : '연결 안됨'}
            </span>
            {feedbacks.length > 0 && (
              <button
                onClick={handleClearAll}
                className="ml-auto text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
              >
                모두 지우기
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
