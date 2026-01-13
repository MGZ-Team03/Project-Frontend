# 📁 components/student

학생 전용 컴포넌트

## 파일 목록

### 1. SpeakingIndicator.jsx
발음 상태 표시 컴포넌트

**Props:**
```javascript
{
  status: 'idle' | 'speaking' | 'processing',
  duration: number,      // 현재 발음 시간 (초)
  ratio: number,         // 발음 비율 (%)
}
```

**기능:**
- 발음 중일 때 애니메이션
- 실시간 시간 카운터
- 진행바 표시

**화면 예시:**
```
🎤 발음 중... (2.3초)
████████░░ 68%
```

---

### 2. FeedbackPopup.jsx
튜터 피드백 수신 팝업

**Props:**
```javascript
{
  message: string,      // 피드백 메시지
  audioUrl: string,     // TTS 음성 URL (optional)
  onClose: function,
}
```

**기능:**
- 튜터가 보낸 피드백 표시
- 텍스트 또는 음성 피드백 재생
- 자동 닫힘 타이머

**WebSocket 수신:**
- `FEEDBACK` 이벤트 시 자동 표시
