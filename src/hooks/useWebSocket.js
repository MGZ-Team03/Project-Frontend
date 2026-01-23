import { useEffect, useRef, useState } from 'react';
import { WS_URL } from '../utils/constants';

/**
 * WebSocket 연결 관리 커스텀 훅
 *
 * @param {string} userEmail - 사용자 이메일
 * @param {string} tutorEmail - 튜터 이메일 (학생인 경우)
 * @param {function} onMessage - 메시지 수신 콜백
 * @returns {object} { isConnected, error, sendMessage }
 */
export const useWebSocket = (userEmail, tutorEmail, onMessage) => {
  const wsRef = useRef(null);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState(null);
  const reconnectTimeoutRef = useRef(null);

  useEffect(() => {
    if (!userEmail) return;

    const connect = () => {
      // WebSocket 연결 (user_email과 tutor_email을 쿼리 파라미터로 전달)
      let wsUrl = `${WS_URL}?user_email=${encodeURIComponent(userEmail)}`;
      if (tutorEmail) {
        wsUrl += `&tutor_email=${encodeURIComponent(tutorEmail)}`;
      }
      console.log('🔌 WebSocket 연결 시도:', wsUrl);

      const ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        console.log('✅ WebSocket 연결 성공');
        setIsConnected(true);
        setError(null);
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log('📩 WebSocket 메시지 수신:', data);

          if (onMessage) {
            onMessage(data);
          }
        } catch (err) {
          console.error('❌ 메시지 파싱 오류:', err);
        }
      };

      ws.onerror = (err) => {
        console.error('❌ WebSocket 오류:', err);
        setError('WebSocket 연결 실패');
      };

      ws.onclose = (event) => {
        console.log('❌ WebSocket 연결 종료:', event.code, event.reason);
        setIsConnected(false);

        // 5초 후 자동 재연결
        if (reconnectTimeoutRef.current) {
          clearTimeout(reconnectTimeoutRef.current);
        }
        reconnectTimeoutRef.current = setTimeout(() => {
          console.log('🔄 WebSocket 재연결 시도...');
          connect();
        }, 5000);
      };

      wsRef.current = ws;
    };

    connect();

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.close();
      }
    };
  }, [userEmail, tutorEmail, onMessage]);

  const sendMessage = (message) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
      console.log('📤 WebSocket 메시지 전송:', message);
    } else {
      console.error('❌ WebSocket이 연결되지 않음');
    }
  };

  return { isConnected, error, sendMessage };
};
