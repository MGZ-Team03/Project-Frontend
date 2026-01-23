# 튜터 피드백 프론트엔드 구현 가이드

## 1. 개요

튜터가 보낸 피드백을 학생이 **실시간으로 수신하여 학습 페이지에 통합 표시**하는 시스템입니다.

### 핵심 특징
- **WebSocket 실시간 통신**: 튜터 피드백을 즉시 수신
- **학습 페이지 통합**: 별도 페이지가 아닌 ChatPage/PracticePage에 피드백 표시
- **자동 재연결**: 네트워크 끊김 시 5초마다 자동 재연결
- **브라우저 알림**: 새 피드백 도착 시 알림 표시
- **TTS 지원**: 오디오 URL이 있을 경우 재생 가능

---

## 2. 아키텍처

### 데이터 흐름

```
튜터 (DashboardPage)
  → REST API (POST /api/tutor/feedback) 
    → TutorFeedbackHandler
      → DynamoDB 저장
      → WebSocket 전송
        → 학생 (ChatPage/PracticePage) 실시간 수신
```

### 페이지 구조

```
학생:
  - ChatPage: AI 대화 + 튜터 피드백 통합 표시
  - PracticePage: 문장 연습 + 튜터 피드백 통합 표시
  - StatsPage: 학습 통계

튜터:
  - DashboardPage: 학생 모니터링 + 피드백 전송
  - StudentDetailPage: 학생 상세 분석
```

---

## 3. 구현된 파일

### 3.1 WebSocket Hook

**파일**: `src/hooks/useWebSocket.js`

**핵심 기능**:
- WebSocket 연결 관리
- 자동 재연결 (5초 간격)
- 메시지 파싱 및 콜백 호출

**사용법**:
```javascript
const handleWebSocketMessage = (message) => {
  if (message.type === 'feedback') {
    // 피드백 처리
  }
};

const { isConnected, error } = useWebSocket(userEmail, handleWebSocketMessage);
```

---

### 3.2 API 레이어

**파일**: `src/api/tutorFeedback.js`

**함수**:
- `sendFeedback(feedbackData)`: 튜터가 피드백 전송
- `getFeedbackHistory(studentEmail, limit)`: 과거 피드백 조회

---

### 3.3 학생 페이지 - ChatPage (AI 대화 + 피드백)

**파일**: `src/pages/student/ChatPage.jsx`

**주요 기능**:
- AI 대화 진행
- 튜터 피드백 실시간 수신 및 표시
- WebSocket 연결 상태 표시
- 브라우저 알림

**피드백 표시 UI**:
- 채팅 상단에 오렌지색 카드로 최근 3개 피드백 표시
- 튜터 아바타 + 메시지 + TTS 오디오 (있을 경우)
- 타임스탬프 표시

**핵심 코드**:
```jsx
const handleWebSocketMessage = (message) => {
  if (message.type === 'feedback') {
    setFeedbacks((prev) => [message, ...prev]);
    setSnackbar({
      open: true,
      message: `튜터 피드백: ${message.message}`,
      severity: 'success',
    });

    if (Notification.permission === 'granted') {
      new Notification('튜터 피드백', {
        body: message.message,
        icon: '/tutor-icon.png',
      });
    }
  }
};

const { isConnected } = useWebSocket(userEmail, handleWebSocketMessage);
```

---

### 3.4 학생 페이지 - PracticePage (문장 연습 + 피드백)

**파일**: `src/pages/student/PracticePage.jsx`

**주요 기능**:
- 문장 연습 (TTS, 녹음, 발음 평가)
- 튜터 피드백 실시간 수신 및 표시
- 최근 피드백 1개만 간략하게 표시

**피드백 표시 UI**:
- 문장 카드 위에 오렌지색 카드로 최신 피드백 1개만 표시
- ChatPage보다 간소화된 디자인

---

### 3.5 튜터 페이지 - DashboardPage

**파일**: `src/pages/tutor/DashboardPage.jsx`

**주요 기능**:
- 전체 학생 목록 표시 (현재 학습 중인 학생 확인 가능)
- 개별 학생에게 피드백 전송
- 빠른 피드백 버튼 (미리 정의된 메시지)

**피드백 전송 다이얼로그**:
- 텍스트 입력 (multiline)
- 빠른 피드백 버튼 3개: "잘하고 있어요!", "힘내세요!", "크게 말해요"
- 전송 중 상태 표시

**피드백 전송 로직**:
```javascript
const handleSendFeedback = async () => {
  if (!selectedStudent || !feedbackMessage.trim()) return;

  setSending(true);
  try {
    await sendFeedback({
      student_email: selectedStudent.email,
      tutor_email: user?.email,
      message: feedbackMessage,
      category: 'general',
    });

    setSnackbar({ 
      open: true, 
      message: '피드백을 전송했습니다.', 
      severity: 'success' 
    });
    closeFeedbackDialog();
  } catch (error) {
    console.error('Failed to send feedback:', error);
    setSnackbar({ 
      open: true, 
      message: '피드백 전송에 실패했습니다.', 
      severity: 'error' 
    });
  } finally {
    setSending(false);
  }
};
```

---

## 4. 환경 변수 설정

**파일**: `.env.local`

```bash
VITE_API_BASE_URL=https://your-api-gateway-url.execute-api.ap-northeast-2.amazonaws.com/Prod
VITE_WEBSOCKET_URL=wss://your-websocket-api-id.execute-api.ap-northeast-2.amazonaws.com/production
```

---

## 5. 메시지 형식

### WebSocket 메시지 (학생 수신)

```json
{
  "type": "feedback",
  "message": "발음이 좋아졌어요!",
  "timestamp": "2024-01-15T10:30:00Z",
  "tutor_email": "tutor@example.com",
  "student_email": "student@example.com",
  "audioUrl": "https://s3.amazonaws.com/feedback-audio/123.mp3",
  "category": "pronunciation"
}
```

### REST API 요청 (튜터 → 백엔드)

```json
{
  "student_email": "student@example.com",
  "tutor_email": "tutor@example.com",
  "message": "발음이 좋아졌어요!",
  "category": "pronunciation",
  "audioUrl": "https://s3.amazonaws.com/feedback-audio/123.mp3"
}
```

---

## 6. 네비게이션 구조

**BottomNav** (학생):
- 연습 (PracticePage)
- 대화 (ChatPage)
- 통계 (StatsPage)

**주의**: 피드백은 별도 탭이 아니라 ChatPage와 PracticePage에 통합됨

---

## 7. 테스트 시나리오

### 7.1 기본 피드백 전송/수신
1. 학생이 ChatPage 또는 PracticePage 접속
2. WebSocket 연결 확인 (상태: "연결됨")
3. 튜터가 DashboardPage에서 해당 학생 선택
4. "피드백 보내기" 클릭 → 메시지 입력 → 전송
5. 학생 화면에 피드백 즉시 표시 + 브라우저 알림

### 7.2 재연결 테스트
1. 학생이 학습 페이지 접속 (WebSocket 연결됨)
2. 네트워크 끊기 (개발자 도구에서 offline 모드)
3. 상태가 "연결 안됨"으로 변경
4. 네트워크 복구
5. 5초 이내 자동 재연결 확인

### 7.3 빠른 피드백
1. 튜터가 학생 카드에서 "피드백" 버튼 클릭
2. "👍 잘하고 있어요!" 버튼 클릭
3. 즉시 전송 (다이얼로그 닫힘)
4. 학생 화면에 "잘하고 있어요!" 메시지 표시

---

## 8. 다음 단계 (미구현 기능)

### 8.1 AWS Polly TTS 통합
- 튜터가 텍스트 피드백 입력 시 자동으로 음성 생성
- S3에 저장 후 URL을 audioUrl로 전달

### 8.2 피드백 필터링
- 카테고리별 필터 (pronunciation, grammar, fluency 등)
- 날짜 범위 필터

### 8.3 피드백 통계
- 받은 피드백 개수 통계
- 카테고리별 분석
- 학생 상세 페이지에 피드백 히스토리 표시

---

## 9. 트러블슈팅

### WebSocket 연결 실패
- 환경 변수 `VITE_WEBSOCKET_URL` 확인
- CORS 설정 확인 (백엔드 template.yaml)
- 브라우저 콘솔에서 WebSocket 연결 로그 확인

### 피드백이 표시되지 않음
- WebSocket 연결 상태 확인 ("연결됨" 표시 확인)
- 백엔드 DynamoDB `WebSocketConnectionsTable`에 연결 정보 저장 확인
- 메시지 형식 확인 (`type: 'feedback'` 필수)

### 재연결이 안됨
- `useWebSocket` hook의 `reconnectTimeoutRef` 로직 확인
- 5초 대기 후 재연결 시도하는지 확인

---

**작성일**: 2024-01-15  
**버전**: 2.0 (학습 페이지 통합, FeedbackPage 제거)
