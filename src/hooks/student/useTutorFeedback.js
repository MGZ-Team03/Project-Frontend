// 튜터 피드백 WebSocket 및 상태 관리 훅

import { useState, useEffect, useCallback, useRef } from 'react';
import { useSelector } from 'react-redux';
import ws from '../../config/webSocketConfig';
import { useTTSAudio } from '../useTTSAudio';

/**
 * 텍스트의 언어를 감지합니다 (한글 포함 여부 확인)
 * @param {string} text
 * @returns {'ko' | 'en'}
 */
function detectLanguage(text) {
  return /[\uAC00-\uD7AF]/.test(text) ? 'ko' : 'en';
}

export default function useTutorFeedback(onAutoExpand) {
  const user = useSelector((state) => state.auth.user);
  const { playText } = useTTSAudio();

  // WebSocket 상태
  const [isConnected, setIsConnected] = useState(false);
  const [wsError, setWsError] = useState(null);

  // 피드백 상태
  const [feedbacks, setFeedbacks] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);

  // 학생 제어 옵션
  const [doNotDisturb, setDoNotDisturb] = useState(false);
  const [autoExpand, setAutoExpand] = useState(true);
  const [autoPlayTTS, setAutoPlayTTS] = useState(false);

  // 최신 상태를 참조하기 위한 ref
  const doNotDisturbRef = useRef(doNotDisturb);
  const autoExpandRef = useRef(autoExpand);
  const autoPlayTTSRef = useRef(autoPlayTTS);

  // ref 업데이트
  useEffect(() => {
    doNotDisturbRef.current = doNotDisturb;
  }, [doNotDisturb]);

  useEffect(() => {
    autoExpandRef.current = autoExpand;
  }, [autoExpand]);

  useEffect(() => {
    autoPlayTTSRef.current = autoPlayTTS;
  }, [autoPlayTTS]);

  // WebSocket 메시지 핸들러
  const handleWebSocketMessage = useCallback((message) => {
    if (message.type === 'feedback') {
      const newFeedback = {
        ...message,
        tutor_email: message.from || message.tutor_email,
        receivedAt: new Date().toISOString(),
        isRead: false,
      };
      
      // 피드백 저장 및 카운트 증가
      setFeedbacks((prev) => [newFeedback, ...prev].slice(0, 20));
      setUnreadCount((prev) => prev + 1);
      
      // 방해금지 모드일 때는 알림/확장/TTS 모두 건너뜀 (ref 사용)
      if (doNotDisturbRef.current) {
        return;
      }
      
      // 자동 패널 확장 (ref 사용)
      if (autoExpandRef.current && onAutoExpand) {
        onAutoExpand();
      }
      
      // 브라우저 알림
      if ('Notification' in window && Notification.permission === 'granted') {
        try {
          new Notification('튜터 피드백 도착!', {
            body: message.message || '새로운 피드백이 도착했습니다.',
            icon: '/tutor-icon.png',
            badge: '/tutor-badge.png',
            tag: 'tutor-feedback',
            requireInteraction: false,
          });
        } catch (error) {
          console.error('❌ 알림 생성 실패:', error);
        }
      }
      
      // TTS 자동 재생 (ref 사용)
      const isTTS = message.messageType === 'tts';
      if (autoPlayTTSRef.current && isTTS && message.message) {
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
    }
  }, [playText, onAutoExpand]);

  // WebSocket 연결
  useEffect(() => {
    if (!user?.email) return;

    const socket = ws.connect();

    const updateConnectionStatus = () => {
      setIsConnected(socket?.readyState === WebSocket.OPEN);
    };

    updateConnectionStatus();
    const unsubscribe = ws.addMessageListener(handleWebSocketMessage);
    const statusInterval = setInterval(updateConnectionStatus, 1000);

    return () => {
      unsubscribe();
      clearInterval(statusInterval);
    };
  }, [user?.email, handleWebSocketMessage]);

  // 브라우저 알림 권한 요청
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().then((permission) => {
        if (permission === 'denied') {
          console.warn('⚠️ 사용자가 알림 권한을 거부했습니다.');
        }
      });
    }
  }, []);

  // 방해금지 모드 토글
  const toggleDoNotDisturb = () => {
    const newDND = !doNotDisturb;
    setDoNotDisturb(newDND);
    if (newDND) {
      setAutoExpand(false);
      setAutoPlayTTS(false);
    }
  };

  // 자동 확장 토글
  const toggleAutoExpand = () => {
    if (!doNotDisturb) {
      setAutoExpand(!autoExpand);
    }
  };

  // TTS 자동재생 토글
  const toggleAutoPlayTTS = () => {
    if (!doNotDisturb) {
      setAutoPlayTTS(!autoPlayTTS);
    }
  };

  // 모두 읽음 처리
  const markAllAsRead = () => {
    setUnreadCount(0);
    setFeedbacks((prev) => prev.map((fb) => ({ ...fb, isRead: true })));
  };

  // 모두 지우기
  const clearAll = () => {
    setFeedbacks([]);
    setUnreadCount(0);
  };

  // 오디오 재생
  const playAudio = (text, audioUrl) => {
    if (audioUrl) {
      const audio = new Audio(audioUrl);
      audio.play().catch((err) => {
        console.error('오디오 재생 실패:', err);
        playBrowserTTS(text);
      });
    } else if (text) {
      playBrowserTTS(text);
    }
  };

  const playBrowserTTS = (text) => {
    if (!text || !window.speechSynthesis) return;

    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'en-US';
    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    utterance.volume = 1.0;
    utterance.onerror = (e) => console.error('❌ TTS 오류:', e);

    window.speechSynthesis.speak(utterance);
  };

  return {
    // 상태
    isConnected,
    wsError,
    feedbacks,
    unreadCount,
    doNotDisturb,
    autoExpand,
    autoPlayTTS,
    
    // 메서드
    toggleDoNotDisturb,
    toggleAutoExpand,
    toggleAutoPlayTTS,
    markAllAsRead,
    clearAll,
    playAudio,
    handleWebSocketMessage,
  };
}
