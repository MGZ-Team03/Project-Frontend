# 📁 hooks

커스텀 React Hooks

## 파일 목록

### 1. useAuth.js
Cognito 인증 상태 관리 훅

**반환값:**
```javascript
{
  user: object | null,
  isAuthenticated: boolean,
  isLoading: boolean,
  login: (email, password) => Promise,
  logout: () => void,
}
```

**사용 예시:**
```javascript
const { user, isAuthenticated, logout } = useAuth();
```

---

### 2. useSpeechDetection.js
MAR + 음성 감지 훅 (발음 감지)

**Props:**
```javascript
{
  onSpeakingStart: function,
  onSpeakingEnd: function,
}
```

**반환값:**
```javascript
{
  isSpeaking: boolean,
  speakingDuration: number,
  startDetection: () => void,
  stopDetection: () => void,
}
```

**구현 로직:**
```javascript
// 입 벌림 감지 (MAR)
function calculateMAR(landmarks) {
  const vertical = distance(landmarks[13], landmarks[14]);
  const horizontal = distance(landmarks[78], landmarks[308]);
  return vertical / horizontal;
}

// 음성 감지
function detectVoice(analyser) {
  const data = new Uint8Array(analyser.frequencyBinCount);
  analyser.getByteFrequencyData(data);
  const volume = data.reduce((a, b) => a + b) / data.length;
  return volume > 30;
}

// 종합 판단: MAR > 0.3 && 음성 감지
```

---

### 3. useWebSocket.js
WebSocket 연결 관리 훅

**반환값:**
```javascript
{
  isConnected: boolean,
  sendMessage: (type, data) => void,
  lastMessage: object | null,
}
```

**이벤트 타입:**
- `STUDENT_STATUS` - 학생 상태 전송
- `STUDENT_UPDATE` - 학생 상태 수신 (튜터)
- `FEEDBACK` - 피드백 수신 (학생)

---

### 4. useTTS.js
Polly TTS 음성 재생 훅

**반환값:**
```javascript
{
  isPlaying: boolean,
  play: (audioUrl) => Promise,
  stop: () => void,
}
```

**사용 예시:**
```javascript
const { isPlaying, play } = useTTS();

// 음성 재생
await play('https://s3.../audio.mp3');
```
