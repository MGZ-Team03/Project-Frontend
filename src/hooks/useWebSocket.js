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
  const onMessageRef = useRef(onMessage);

  // onMessage가 바뀔 때마다 ref 업데이트 (useEffect 재실행 방지)
  useEffect(() => {
    onMessageRef.current = onMessage;
  }, [onMessage]);

  useEffect(() => {
    if (!userEmail) return;

    const connect = () => {
      // WebSocket 연결 (user_email과 tutor_email을 쿼리 파라미터로 전달)
      let wsUrl = `${WS_URL}?user_email=${encodeURIComponent(userEmail)}`;
      if (tutorEmail) {
        wsUrl += `&tutor_email=${encodeURIComponent(tutorEmail)}`;
      }
      
      const ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        setIsConnected(true);
        setError(null);
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          if (onMessageRef.current) {
            onMessageRef.current(data);
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
        setIsConnected(false);

        // 5초 후 자동 재연결
        if (reconnectTimeoutRef.current) {
          clearTimeout(reconnectTimeoutRef.current);
        }
        reconnectTimeoutRef.current = setTimeout(() => {
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
  }, [userEmail, tutorEmail]); // onMessage 의존성 제거 (ref로 처리)

  const sendMessage = (message) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
    } else {
      console.error('❌ WebSocket이 연결되지 않음');
    }
  };

  return { isConnected, error, sendMessage };
};
