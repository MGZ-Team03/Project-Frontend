import { useEffect, useRef } from "react";
import ws from "../../config/webSocketConfig.js";

export default function useWebSocket(getData, interval = 5000) {
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

            // 즉시 한 번 전송
            const data = getDataRef.current();
            if (data) {
                socket.send(JSON.stringify(data));
                console.log("📤 초기 전송:", data);
            }

            // 주기적 전송 시작
            ws.startSendingData(interval, () => getDataRef.current());
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
            ws.stopSendingData();
            ws.disconnect();
        };
    }, []); // 빈 배열 - 마운트 시 한 번만

    return ws.getSocket();
}