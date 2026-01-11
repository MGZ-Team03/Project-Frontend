# 📁 api

API 통신 모듈

## 파일 목록

### 1. axios.js ✅ (구현됨)
Axios 인스턴스 설정

**기능:**
- baseURL 설정
- 요청 인터셉터: 토큰 자동 첨부
- 응답 인터셉터: 401 에러 시 로그아웃

---

### 2. auth.js ✅ (구현됨)
Cognito 인증 함수

**함수:**
- `login(email, password)` - 로그인
- `logout()` - 로그아웃
- `getCurrentUser()` - 현재 사용자 확인

---

### 3. websocket.js
WebSocket 연결 관리

**함수:**
```javascript
// 연결
export const connect = (userEmail, userType) => {
  const ws = new WebSocket(`${WS_URL}?email=${userEmail}&type=${userType}`);
  // ...
};

// 메시지 전송
export const sendMessage = (type, data) => {
  ws.send(JSON.stringify({ action: type, data }));
};

// 연결 해제
export const disconnect = () => {
  ws.close();
};
```

**이벤트 타입:**

| 타입 | 방향 | 설명 |
|------|------|------|
| `STUDENT_STATUS` | 학생→서버 | 학생 상태 전송 (1초마다) |
| `STUDENT_UPDATE` | 서버→튜터 | 학생 상태 업데이트 |
| `FEEDBACK` | 튜터→학생 | 피드백 전송 |

**상태 데이터 구조:**
```javascript
{
  email: string,
  activity: 'sentence' | 'ai_chat' | null,
  isSpeaking: boolean,
  speakingRatio: number,
  duration: number,
  currentSentence: string,
}
```
