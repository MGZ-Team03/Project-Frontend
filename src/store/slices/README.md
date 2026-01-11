# 📁 store/slices

Redux Toolkit Slices

## 파일 목록

### 1. authSlice.js ✅ (구현됨)
인증 상태 관리

**State:**
```javascript
{
  user: { email, name, role } | null,
  isAuthenticated: boolean,
  isLoading: boolean,
  error: string | null,
}
```

**Actions:**
- `login` - 로그인
- `logout` - 로그아웃
- `checkAuth` - 인증 상태 확인
- `clearError` - 에러 초기화

---

### 2. practiceSlice.js
문장 연습 상태 관리

**State:**
```javascript
{
  sentences: [],
  currentIndex: number,
  sessionId: string | null,
  speakingDuration: number,
  totalDuration: number,
  isLoading: boolean,
}
```

**Actions:**
- `fetchSentences` - 문장 목록 가져오기
- `nextSentence` - 다음 문장
- `prevSentence` - 이전 문장
- `updateSpeakingTime` - 발음 시간 업데이트
- `startSession` - 세션 시작
- `endSession` - 세션 종료

---

### 3. chatSlice.js
AI 대화 상태 관리

**State:**
```javascript
{
  topic: string | null,
  messages: [{ role, content, speakingTime }],
  conversationId: string | null,
  isLoading: boolean,
  totalSpeakingTime: number,
}
```

**Actions:**
- `setTopic` - 주제 선택
- `startConversation` - 대화 시작
- `sendMessage` - 메시지 전송
- `endConversation` - 대화 종료

---

### 4. studentSlice.js
학생 목록 상태 관리 (튜터용)

**State:**
```javascript
{
  students: [
    {
      email: string,
      name: string,
      status: 'active' | 'warning' | 'inactive',
      activity: string | null,
      speakingRatio: number,
      duration: number,
    }
  ],
  selectedStudent: object | null,
  isLoading: boolean,
}
```

**Actions:**
- `fetchStudents` - 학생 목록 가져오기
- `updateStudent` - 학생 상태 업데이트 (WebSocket)
- `selectStudent` - 학생 선택
- `sendFeedback` - 피드백 전송
