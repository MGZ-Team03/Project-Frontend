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
        // 오프라인 체크
        try {
            if (typeof navigator !== 'undefined' && navigator.onLine === false) {
                return null;
            }
        } catch (_) {}

        // 재연결 중이면 중복 시도 방지
        if (this.isReconnecting) {
            return this.socket;
        }

        // Redux에서 사용자 이메일 가져오기
        const state = _store?.getState();
        const userEmail = state?.auth?.user?.email;

        // userEmail이 없으면 연결하지 않음
        if (!userEmail) {
            return null;
        }

        // 같은 사용자로 이미 연결되어 있거나 연결 중이면 재사용
        if (this.socket &&
            (this.socket.readyState === WebSocket.OPEN || this.socket.readyState === WebSocket.CONNECTING) &&
            this.connectedUserEmail === userEmail) {
            return this.socket;
        }

        // 기존 연결이 열려있으면 닫기
        if (this.socket && this.socket.readyState === WebSocket.OPEN) {
            this.socket.close();
        }

        // user_email 쿼리 파라미터로 연결
        const wsUrl = `${WS_URL}?user_email=${encodeURIComponent(userEmail)}`;
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
            this.isReconnecting = false;
            if (this.reconnectTimeout) {
                clearTimeout(this.reconnectTimeout);
                this.reconnectTimeout = null;
            }
        };

        this.socket.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                this.messageListeners.forEach(listener => {
                    try {
                        listener(data);
                    } catch (err) {
                        console.error("WebSocket 리스너 오류:", err);
                    }
                });
            } catch (err) {
                console.error("WebSocket 메시지 파싱 오류:", err);
            }
        };

        this.socket.onerror = (error) => {
            console.error("WebSocket 에러:", error);
        };

        this.socket.onclose = () => {
            this.connectedUserEmail = null;

            // 5초 후 재연결 시도
            if (!this.isReconnecting && !this.reconnectTimeout) {
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
