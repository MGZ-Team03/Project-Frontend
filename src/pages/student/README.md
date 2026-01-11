# 📁 pages/student

학생용 페이지 컴포넌트

## 파일 목록

### 1. PracticePage.jsx
문장 연습 페이지

**기능:**
- 영어 문장 표시
- Polly TTS로 원어민 발음 재생
- MAR + 음성 감지로 발음 시간 측정
- 이전/다음 문장 네비게이션

**사용 컴포넌트:**
- `Header`
- `BottomNav`
- `AudioButton`
- `SpeakingIndicator`

**API 호출:**
- `GET /api/sentences?category={cat}`
- `POST /api/sessions/start`
- `POST /api/sessions/end`

---

### 2. ChatPage.jsx
AI 대화 페이지

**기능:**
- 주제 선택 (카페 주문, 길 묻기 등)
- Claude API로 AI 대화
- Web Speech API로 음성 인식 (STT)
- Polly TTS로 AI 응답 재생

**사용 컴포넌트:**
- `Header`
- `BottomNav`
- `AudioButton`
- `SpeakingIndicator`

**API 호출:**
- `GET /api/ai/topics`
- `POST /api/ai/chat/start`
- `POST /api/ai/chat/message`
- `POST /api/ai/chat/end`

---

### 3. StatsPage.jsx
학습 통계 페이지

**기능:**
- 오늘 학습 시간 / 발음 시간 / 발음 비율
- 주간 학습량 바 차트
- 학습 유형별 통계 (문장 연습 / AI 대화)

**사용 컴포넌트:**
- `Header`
- `BottomNav`
- `StatCard`

**API 호출:**
- `GET /api/statistics/today`
- `GET /api/statistics/weekly`
