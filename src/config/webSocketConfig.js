import {WS_URL} from "../utils/constants.js";

class WebSocketSingleton {
    constructor() {
        this.socket = null; // 초기에는 연결 없음
        this.intervalId = null;
    }

    connect() {
        // 오프라인이면 연결 시도하지 않음 (콘솔 스팸 방지)
        try {
            if (typeof navigator !== 'undefined' && navigator.onLine === false) {
                console.warn("⚠️ 오프라인 상태: WebSocket 연결을 건너뜁니다");
                return null;
            }
        } catch (_) {}
        if (!this.socket || this.socket.readyState === WebSocket.CLOSED) {
            this.socket = new WebSocket(WS_URL);
            this._setupListeners();
        }
        return this.socket;
    }

    startSendingData(interval = 50000,getData=()=> null){
        // 이미 실행 중이면 중복 방지
        if(this.intervalId) return;

        this.intervalId = setInterval(() => {
            if (this.socket && this.socket.readyState === WebSocket.OPEN) {
                const data = getData();
                if(!data) {
                    console.log("❌data null");
                    return;
                }
                this.socket.send(JSON.stringify(data));
                 console.log("📤 데이터 전송:", data);
            }
        }, interval);

    }

    stopSendingData() {

        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
    }

    disconnect() {
        this.stopSendingData();
        if (this.socket) {
            this.socket.close();
            this.socket = null;
        }
    }
    _setupListeners() {
        this.socket.onopen = () => console.log("✅ WebSocket 연결됨");
        this.socket.onmessage = (event) => console.log("📩 메시지 수신:", event.data);
        this.socket.onerror = (error) => console.error("❌ WebSocket 에러:", error);
        this.socket.onclose = () => console.log("⚡ WebSocket 연결 종료");
    }

    getSocket() {
        return this.socket;
    }
}

const ws = new WebSocketSingleton();
export default ws;
