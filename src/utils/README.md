# 📁 utils

유틸리티 함수 및 상수

## 파일 목록

### 1. constants.js ✅ (구현됨)
상수 정의

**내용:**
- `API_BASE_URL` - API Gateway URL
- `WS_URL` - WebSocket URL
- `COGNITO_CONFIG` - Cognito 설정
- `USER_ROLES` - 사용자 역할
- `SPEAKING_STATUS` - 발음 상태
- `SESSION_TYPES` - 세션 타입

---

### 2. helpers.js
유틸리티 함수

**함수:**

```javascript
// 시간 포맷팅 (초 → "MM:SS")
export const formatTime = (seconds) => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

// 시간 포맷팅 (초 → "X분 Y초")
export const formatDuration = (seconds) => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (mins === 0) return `${secs}초`;
  if (secs === 0) return `${mins}분`;
  return `${mins}분 ${secs}초`;
};

// 퍼센트 포맷팅
export const formatPercent = (ratio) => {
  return `${Math.round(ratio)}%`;
};

// 학생 상태 판단
export const getStudentStatus = (speakingRatio, lastActivity) => {
  if (!lastActivity || lastActivity > 5 * 60 * 1000) return 'inactive';
  if (speakingRatio < 40) return 'warning';
  return 'active';
};

// 날짜 포맷팅
export const formatDate = (date) => {
  return new Intl.DateTimeFormat('ko-KR', {
    month: 'numeric',
    day: 'numeric',
    weekday: 'short',
  }).format(new Date(date));
};
```
