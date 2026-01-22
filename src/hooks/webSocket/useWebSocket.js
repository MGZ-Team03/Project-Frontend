import { useEffect, useRef } from "react";
import ws from "../../config/webSocketConfig.js";

export default function useWebSocket(getData, options={}) {
    const {
        interval = 5000,
        sendImmediately = true,  // 즉시 전송 여부
        enableInterval = true,   // 주기적 전송 여부
        onMessage = null         // 메시지 핸들러 옵션
    } = options;

    const getDataRef = useRef(getData);
    const onMessageRef = useRef(onMessage);

    // getData가 바뀔 때마다 ref 업데이트
    useEffect(() => {
        getDataRef.current = getData;
    }, [getData]);

    // onMessage가 바뀔 때마다 ref 업데이트
    useEffect(() => {
        onMessageRef.current = onMessage;
    }, [onMessage]);

    useEffect(() => {
        const socket = ws.connect();

        // 메시지 리스너 항상 등록 (onMessageRef를 통해 최신 핸들러 호출)
        const unsubscribe = ws.addMessageListener((data) => {
            if (onMessageRef.current) {
                onMessageRef.current(data);
            }
        });

        const handleOpen = () => {
            // 즉시 전송 옵션이 켜져있을 때만 전송
            if (sendImmediately) {
                const data = getDataRef.current();
                if (data) {
                    socket.send(JSON.stringify(data));
                } else {
                    console.log("⏭️ 초기 전송 생략 (getData가 null 반환)");
                }
            }

            // 주기적 전송 옵션이 켜져있을 때만 시작
            if (enableInterval) {
                ws.startSendingData(interval, () => getDataRef.current());
            }
        };

        // 이미 열려있으면 즉시 실행
        if (socket.readyState === WebSocket.OPEN) {
            handleOpen();
        } else {
            // 아직 연결 중이면 open 이벤트 대기
            socket.addEventListener('open', handleOpen);
        }

       return () => {
            socket.removeEventListener('open', handleOpen);
            if (enableInterval) {
                ws.stopSendingData();
            }
            // 메시지 리스너 제거
            unsubscribe();
            // 주의: disconnect()는 다른 컴포넌트에서도 사용 중일 수 있으므로 호출 안함
        };
    }, [interval, sendImmediately, enableInterval]);  // onMessage 의존성 제거

    return ws.getSocket();
}