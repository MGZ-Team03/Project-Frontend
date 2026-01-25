import { WS_URL } from "../utils/constants.js";

// 순환 참조 방지: store를 외부에서 주입
let _store = null;

class WebSocketSingleton {
    constructor() {
        this.socket = null;
        this.intervalId = null;
        this.messageListeners = new Set();
        this.connectedUserEmail = null;
        this.reconnectTimeout = null;
        this.isReconnecting = false;
    }

    // store 주입 메서드
    setStore(store) {
        _store = store;
    }

    // 메시지 리스너 등록
    addMessageListener(listener) {
        this.messageListeners.add(listener);
        return () => this.messageListeners.delete(listener);
    }

    // 메시지 리스너 제거
    removeMessageListener(listener) {
        this.messageListeners.delete(listener);
    }

    connect() {
        console.log("[WS] connect() 호출");
        
        // 오프라인 체크
        try {
            if (typeof navigator !== 'undefined' && navigator.onLine === false) {
                console.log("[WS] 오프라인 상태 - 연결 중단");
                return null;
            }
        } catch (_) {}

        // 재연결 중이면 중복 시도 방지
        if (this.isReconnecting) {
            console.log("[WS] 재연결 중 - 기존 소켓 반환");
            return this.socket;
        }

        // Redux에서 사용자 이메일 가져오기
        const state = _store?.getState();
        const userEmail = state?.auth?.user?.email;
        console.log("[WS] userEmail:", userEmail);

        // userEmail이 없으면 연결하지 않음
        if (!userEmail) {
            console.log("[WS] userEmail 없음 - 연결 중단");
            return null;
        }

        // 같은 사용자로 이미 연결되어 있거나 연결 중이면 재사용
        if (this.socket &&
            (this.socket.readyState === WebSocket.OPEN || this.socket.readyState === WebSocket.CONNECTING) &&
            this.connectedUserEmail === userEmail) {
            console.log("[WS] 이미 연결됨 - 기존 소켓 반환, readyState:", this.socket.readyState);
            return this.socket;
        }

        // 기존 연결이 열려있으면 닫기
        if (this.socket && this.socket.readyState === WebSocket.OPEN) {
            console.log("[WS] 기존 연결 닫기");
            this.socket.close();
        }

        // user_email 쿼리 파라미터로 연결
        const wsUrl = `${WS_URL}?user_email=${encodeURIComponent(userEmail)}`;
        console.log("[WS] 연결 시도:", wsUrl);
        this.socket = new WebSocket(wsUrl);
        this.connectedUserEmail = userEmail;
        this._setupListeners();

        return this.socket;
    }

    startSendingData(interval = 50000, getData = () => null) {
        if (this.intervalId) return;

        this.intervalId = setInterval(() => {
            if (this.socket && this.socket.readyState === WebSocket.OPEN) {
                const data = getData();
                if (data) {
                    this.socket.send(JSON.stringify(data));
                }
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

        if (this.reconnectTimeout) {
            clearTimeout(this.reconnectTimeout);
            this.reconnectTimeout = null;
        }
        this.isReconnecting = false;

        if (this.socket) {
            this.socket.close();
            this.socket = null;
        }
    }

    _setupListeners() {
        this.socket.onopen = () => {
            console.log("[WS] ✅ 연결 성공!");
            this.isReconnecting = false;
            if (this.reconnectTimeout) {
                clearTimeout(this.reconnectTimeout);
                this.reconnectTimeout = null;
            }
        };

        this.socket.onmessage = (event) => {
            console.log("[WS] 📩 메시지 수신:", event.data);
            try {
                const data = JSON.parse(event.data);
                console.log("[WS] 파싱된 데이터:", data);
                console.log("[WS] 등록된 리스너 수:", this.messageListeners.size);
                this.messageListeners.forEach(listener => {
                    try {
                        listener(data);
                    } catch (err) {
                        console.error("[WS] 리스너 오류:", err);
                    }
                });
            } catch (err) {
                console.error("[WS] 메시지 파싱 오류:", err);
            }
        };

        this.socket.onerror = (error) => {
            console.error("[WS] ❌ 에러:", error);
        };

        this.socket.onclose = (event) => {
            console.log("[WS] 🔌 연결 종료 - code:", event.code, "reason:", event.reason);
            this.connectedUserEmail = null;

            // 5초 후 재연결 시도
            if (!this.isReconnecting && !this.reconnectTimeout) {
                console.log("[WS] 5초 후 재연결 예정...");
                this.isReconnecting = true;
                this.reconnectTimeout = setTimeout(() => {
                    this.isReconnecting = false;
                    this.reconnectTimeout = null;
                    this.connect();
                }, 5000);
            }
        };
    }

    getSocket() {
        return this.socket;
    }
}

const ws = new WebSocketSingleton();
export default ws;
