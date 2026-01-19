import { useEffect, useRef } from "react";
import ws from "../../config/webSocketConfig.js";

export default function useWebSocket(getData, options={}) {

    const {
        interval = 5000,
        sendImmediately = true,  // 즉시 전송 여부
        enableInterval = true     // 주기적 전송 여부
    } = options;

    const getDataRef = useRef(getData);

    // getData가 바뀔 때마다 ref 업데이트
    useEffect(() => {
        getDataRef.current = getData;
    }, [getData]);

    useEffect(() => {
        console.log("🔌 WebSocket 마운트");

        const socket = ws.connect();

        const handleOpen = () => {
            console.log("✅ WebSocket 열림");

            // 즉시 전송 옵션이 켜져있을 때만 전송
            if (sendImmediately) {
                const data = getDataRef.current();
                if (data) {
                    socket.send(JSON.stringify(data));
                    console.log("📤 초기 전송:", data);
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
            console.log("👋 WebSocket cleanup");
            socket.removeEventListener('open', handleOpen);
            if (enableInterval) {
                ws.stopSendingData();
            }
            // 주의: disconnect()는 다른 컴포넌트에서도 사용 중일 수 있으므로 호출 안함
        };
    }, [interval, sendImmediately, enableInterval]);

    return ws.getSocket();
}