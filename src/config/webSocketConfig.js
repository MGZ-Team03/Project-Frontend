import {WS_URL} from "../utils/constants.js";

// 순환 참조 방지: store를 외부에서 주입
let _store = null;

class WebSocketSingleton {
    constructor() {
        this.socket = null; // 초기에는 연결 없음
        this.intervalId = null;
        this.messageListeners = new Set();  // 메시지 리스너 집합
        this.connectedUserEmail = null;  // 연결된 사용자 이메일 추적
    }

    // store 주입 메서드
    setStore(store) {
        _store = store;
    }

    // 메시지 리스너 등록
    addMessageListener(listener) {
        this.messageListeners.add(listener);
        return () => this.messageListeners.delete(listener);  // unsubscribe 함수 반환
    }

    // 메시지 리스너 제거
    removeMessageListener(listener) {
        this.messageListeners.delete(listener);
    }

    connect() {
        // 오프라인 체크
        try {
            if (typeof navigator !== 'undefined' && navigator.onLine === false) {
                console.warn("⚠️ 오프라인 상태: WebSocket 연결을 건너뜁니다");
                return null;
            }
        } catch (_) {}
        
        // Redux에서 사용자 이메일 가져오기
        const state = _store?.getState();
        const userEmail = state?.auth?.user?.email;
        
        // 같은 사용자로 이미 연결되어 있으면 재사용
        if (this.socket && 
            this.socket.readyState === WebSocket.OPEN && 
            this.connectedUserEmail === userEmail) {
            return this.socket;
        }
        
        // 다른 사용자이거나 연결이 없으면 새로 연결
        if (this.socket && this.socket.readyState !== WebSocket.CLOSED) {
            this.socket.close();
        }
        
        // user_email 쿼리 파라미터 추가
        let wsUrl = WS_URL;
        if (userEmail) {
            wsUrl = `${WS_URL}?user_email=${encodeURIComponent(userEmail)}`;
        }
        
        this.socket = new WebSocket(wsUrl);
        this.connectedUserEmail = userEmail;
        this._setupListeners();
        
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
        this.socket.onopen = () => console.log("✅ WebSocket 연결됨 (user_email:", this.connectedUserEmail, ")");
        
        // 모든 등록된 리스너에게 메시지 전달
        this.socket.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                
                // 모든 리스너에게 메시지 전달
                this.messageListeners.forEach(listener => {
                    try {
                        listener(data);
                    } catch (err) {
                        console.error("❌ 리스너 오류:", err);
                    }
                });
            } catch (err) {
                console.error("❌ 메시지 파싱 오류:", err);
            }
        };
        
        this.socket.onerror = (error) => console.error("❌ WebSocket 에러:", error);
        this.socket.onclose = () => {
            this.connectedUserEmail = null;
        };
    }

    getSocket() {
        return this.socket;
    }
}

const ws = new WebSocketSingleton();
export default ws;
