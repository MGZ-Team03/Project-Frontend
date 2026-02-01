# SpeakTracker Frontend

AI 기반 1:N 외국어 발음 학습 플랫폼 프론트엔드 클라이언트

---

## 프로젝트 개요

**SpeakTracker**는 AI 기반 얼굴인식과 음성 감지를 활용한 외국어 발음 학습 플랫폼입니다. 학생이 외국어를 학습할 때 실제로 발음하는 시간을 자동 측정하고, 튜터가 다수의 학생을 모니터링하며 피드백을 제공하는 웹 애플리케이션입니다.

### 핵심 기능

- **발음 시간 자동 측정**: MediaPipe를 활용한 입 움직임(MAR) 감지 + Web Audio API 음성 감지
- **AI 회화 연습**: Claude/ChatGPT API와 대화하며 발음 시간 측정
- **모니터링**: WebSocket을 통한 튜터-학생 간 상태 공유
- **음성 피드백**: AWS Polly TTS를 활용한 튜터 피드백 음성 변환

---

## Tech Stack

| Category            | Technology                              |
|---------------------|-----------------------------------------|
| Language            | JavaScript (ES6+)                       |
| Framework           | React 18.2                              |
| Build Tool          | Vite 5.0                                |
| State Management    | Redux Toolkit 2.11                      |
| UI Library          | Material-UI (MUI) 7.3                   |
| Styling             | Tailwind CSS 3.4                        |
| HTTP Client         | Axios 1.6                               |
| Routing             | React Router DOM 6.20                   |
| AI/ML               | MediaPipe Tasks Vision 0.10 (얼굴 인식)    |
| Speech Processing   | Xenova Transformers 2.17 (Whisper STT)  |
| Charts              | Recharts 3.6                            |
| Date Handling       | date-fns 4.1                            |
| Real-time           | WebSocket (Native API)                  |

---

## Documentation

| Document                                                          | Description                        |
|-------------------------------------------------------------------|------------------------------------|
| [기능 명세](./docs/실시간%20외국어%20발음%20학습%20플랫폼%20(SpeakTracker).md) | 학생/튜터 기능 상세 설명                   |
| [Redux 상태 관리](./docs/Redux_Student_State_Sharing_Guide.md)      | Redux를 통한 학생 상태 공유 가이드           |
| [통계 페이지 API 연동](./docs/StatsPage_API_Integration_Guide.md)    | 통계 페이지 API 통합 가이드                |
| [튜터 피드백 구현](./docs/튜터_피드백_프론트엔드_구현_가이드.md)              | 튜터 피드백 기능 구현 가이드                 |
| [알림 시스템](./docs/학생_알림_시스템_통합_구현_계획.md)                   | WebSocket 기반 실시간 알림 시스템 구현 계획    |
| [알림 속도 분석](./docs/알림_속도_차이_분석.md)                          | WebSocket vs Polling 성능 비교 분석      |

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              Browser (Client)                                │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                         React Application                              │  │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐   │  │
│  │  │   Pages     │  │ Components  │  │    Hooks    │  │   Workers   │   │  │
│  │  │             │  │             │  │             │  │  (Whisper)  │   │  │
│  │  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘   │  │
│  │         │                │                │                │          │  │
│  │         └────────────────┴────────────────┴────────────────┘          │  │
│  │                                   │                                    │  │
│  │  ┌────────────────────────────────┴────────────────────────────────┐  │  │
│  │  │              Redux Store (State Management)                     │  │  │
│  │  │  • authSlice (사용자 인증)                                        │  │  │
│  │  │  • tutorStudentsSlice (튜터-학생 상태)                            │  │  │
│  │  │  • tutorStatsSlice (통계 데이터)                                  │  │  │
│  │  │  • whisperPreloadSlice (Whisper 모델 상태)                       │  │  │
│  │  └────────────────────────────────┬────────────────────────────────┘  │  │
│  │                                   │                                    │  │
│  │  ┌────────────────────────────────┴────────────────────────────────┐  │  │
│  │  │                    API Layer (Axios)                            │  │  │
│  │  │  • JWT Token 자동 첨부 (Interceptor)                            │  │  │
│  │  │  • Error Handling                                               │  │  │
│  │  │  • Request/Response Logging                                     │  │  │
│  │  └────────────────────────────────┬────────────────────────────────┘  │  │
│  │                                   │                                    │  │
│  │  ┌────────────────────────────────┴────────────────────────────────┐  │  │
│  │  │                 WebSocket Connection                            │  │  │
│  │  │  • 학생 상태 업데이트                                      │  │  │
│  │  │  • 튜터 피드백 실시간 수신                                        │  │  │
│  │  │  • 알림 실시간 푸시                                               │  │  │
│  │  └────────────────────────────────┬────────────────────────────────┘  │  │
│  │                                   │                                    │  │
│  │  ┌────────────────────────────────┴────────────────────────────────┐  │  │
│  │  │              AI/ML Processing (Browser)                         │  │  │
│  │  │  • MediaPipe: 얼굴/입 움직임 감지 (MAR)                          │  │  │
│  │  │  • Whisper STT: 음성 → 텍스트 변환 (Web Worker)                 │  │  │
│  │  │  • Web Audio API: 음성 레벨 감지                                 │  │  │
│  │  └─────────────────────────────────────────────────────────────────┘  │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────┼──────────────────────────────────────┘
                                       │
                    ┌──────────────────┴──────────────────┐
                    │                                     │
                    ▼                                     ▼
┌─────────────────────────────────┐   ┌─────────────────────────────────┐
│   AWS API Gateway (REST)        │   │   AWS API Gateway (WebSocket)   │
│   https://xxx.execute-api.../   │   │   wss://yyy.execute-api.../     │
└─────────────────────────────────┘   └─────────────────────────────────┘
                    │                                     │
                    └──────────────────┬──────────────────┘
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           Backend Lambda Functions                           │
│                    (Auth, Sessions, Statistics, Feedback, etc.)              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Features / Pages

### 학생 (Student) 페이지

| Page                | Route                      | Description                                    |
|---------------------|----------------------------|------------------------------------------------|
| **HomePage**        | `/student/home`            | 학생 홈 (튜터 매칭 상태, 빠른 시작)                      |
| **PracticePage**    | `/student/practice`        | 문장 연습 (TTS 음성 듣기 → 따라 읽기 → 발음 시간 측정)        |
| **ChatPage**        | `/student/chat`            | AI 대화 (Claude/ChatGPT와 자유 대화 + 발음 시간 측정)     |
| **StatsPage**       | `/student/stats`           | 학습 통계 (일별/주별/월별 발음 시간, 차트)                   |
| **ProfilePage**     | `/student/profile`         | 프로필 관리 (정보 수정, 튜터 매칭 요청 내역)                  |

### 튜터 (Tutor) 페이지

| Page                  | Route                      | Description                                    |
|-----------------------|----------------------------|------------------------------------------------|
| **DashboardPage**     | `/tutor/dashboard`         | 튜터 대시보드 (담당 학생 목록, 상태 모니터링)            |
| **StudentDetailPage** | `/tutor/students/:id`      | 학생 상세 (학습 통계, 피드백 전송, 상태 기록)                 |
| **ProfilePage**       | `/tutor/profile`           | 튜터 프로필 관리 (정보 수정, 학생 수락 설정)                  |

### 공통 (Public) 페이지

| Page            | Route           | Description          |
|-----------------|-----------------|----------------------|
| **LoginPage**   | `/login`        | 로그인 (Cognito 인증)   |
| **SignUpPage**  | `/signup`       | 회원가입 (역할 선택)       |

---

## Project Structure

```
Project-Frontend/
├── index.html                  # HTML 엔트리 포인트
├── package.json                # 의존성 및 스크립트
├── vite.config.js              # Vite 설정 (프록시, 플러그인)
├── tailwind.config.cjs         # Tailwind CSS 설정
├── postcss.config.cjs          # PostCSS 설정
├── env.local                   # 환경 변수 (로컬)
├── docs/                       # 문서
├── introduce-page/             # 소개 페이지 (랜딩)
│
└── src/
    ├── main.jsx                # React 엔트리 포인트
    ├── App.jsx                 # 메인 앱 컴포넌트 (라우팅)
    ├── index.css               # 글로벌 스타일
    │
    ├── api/                    # API 호출 모듈
    │   ├── axios.js            # Axios 인스턴스 설정
    │   ├── auth.js             # 인증 API (로그인, 회원가입, 프로필)
    │   ├── aiLevel.js          # AI 난이도 레벨 API
    │   ├── notifications.js    # 알림 API
    │   ├── tutorFeedback.js    # 튜터 피드백 API
    │   └── ...
    │
    ├── components/             # 재사용 컴포넌트
    │   ├── ChatInterface.jsx   # AI 대화 인터페이스
    │   ├── FeedbackDisplay.jsx # 피드백 표시 컴포넌트
    │   ├── NotificationBell.jsx # 알림 벨 아이콘
    │   ├── StudentCard.jsx     # 학생 카드 (튜터용)
    │   ├── StatsChart.jsx      # 통계 차트
    │   └── ...
    │
    ├── config/                 # 설정 파일
    │   ├── awsConfig.js        # AWS Cognito 설정
    │   └── webSocketConfig.js  # WebSocket 설정
    │
    ├── data/                   # 정적 데이터
    │   └── sentences.js        # 연습 문장 목록
    │
    ├── hooks/                  # 커스텀 훅
    │   ├── student/
    │   │   ├── useStudentNotifications.js  # 학생 알림 훅
    │   │   └── useTutorFeedback.js         # 튜터 피드백 수신 훅
    │   ├── tutor/
    │   │   └── useNotificationHandler.js   # 튜터 알림 처리 훅
    │   ├── useFaceDetection.js             # MediaPipe 얼굴 감지 훅
    │   ├── useSpeechRecognition.js         # 음성 인식 훅
    │   ├── useTTSAudio.js                  # TTS 오디오 재생 훅
    │   ├── useVoiceDetection.js            # 음성 레벨 감지 훅
    │   └── useWebSocket.js                 # WebSocket 연결 훅
    │
    ├── pages/                  # 페이지 컴포넌트
    │   ├── LoginPage.jsx       # 로그인 페이지
    │   ├── SignUpPage.jsx      # 회원가입 페이지
    │   ├── student/
    │   │   ├── HomePage.jsx    # 학생 홈
    │   │   ├── PracticePage.jsx # 문장 연습
    │   │   ├── ChatPage.jsx    # AI 대화
    │   │   ├── StatsPage.jsx   # 통계
    │   │   └── ProfilePage.jsx # 프로필
    │   └── tutor/
    │       ├── DashboardPage.jsx      # 튜터 대시보드
    │       ├── StudentDetailPage.jsx  # 학생 상세
    │       └── ProfilePage.jsx        # 튜터 프로필
    │
    ├── store/                  # Redux Store
    │   ├── store.js            # 스토어 설정
    │   └── slices/
    │       ├── authSlice.js             # 인증 상태
    │       ├── tutorStudentsSlice.js    # 튜터-학생 상태
    │       ├── tutorStatsSlice.js       # 통계 상태
    │       └── whisperPreloadSlice.js   # Whisper 모델 로딩 상태
    │
    ├── utils/                  # 유틸리티 함수
    │   ├── storageKeys.js      # LocalStorage 키 관리
    │   ├── formatTime.js       # 시간 포맷팅
    │   └── ...
    │
    └── workers/                # Web Workers
        └── whisperWorker.js    # Whisper STT 워커 (백그라운드 처리)
```

---

## Getting Started

### Prerequisites

- Node.js 18.x 이상
- npm 또는 yarn

### Installation

```bash
# 의존성 설치
npm install
```

### Environment Variables

`.env.local` 파일 생성:

```env
VITE_API_URL=https://your-api-gateway-url.execute-api.region.amazonaws.com/Dev
VITE_WS_URL=wss://your-websocket-url.execute-api.region.amazonaws.com/Dev
VITE_COGNITO_USER_POOL_ID=your-user-pool-id
VITE_COGNITO_CLIENT_ID=your-client-id
VITE_COGNITO_REGION=ap-northeast-2
```

### Development

```bash
# 개발 서버 시작 (http://localhost:3000)
npm run dev
```

### Build

```bash
# 프로덕션 빌드
npm run build

# 빌드 결과 미리보기
npm run preview
```

---

## Key Technologies

### 1. MediaPipe Face Detection

얼굴 랜드마크를 감지하여 입 움직임(MAR - Mouth Aspect Ratio)을 계산합니다.

- **라이브러리**: `@mediapipe/tasks-vision`
- **용도**: 학생이 실제로 발음하는지 입 모양으로 감지
- **위치**: `hooks/useFaceDetection.js`

### 2. Whisper STT (Speech-to-Text)

브라우저에서 음성을 텍스트로 변환합니다.

- **라이브러리**: `@xenova/transformers`
- **모델**: `Xenova/whisper-tiny` (경량 모델)
- **실행 방식**: Web Worker에서 백그라운드 처리
- **위치**: `workers/whisperWorker.js`

### 3. Web Audio API

마이크 입력을 분석하여 음성 레벨을 감지합니다.

- **용도**: 학생이 말하고 있는지 음성 레벨로 감지
- **위치**: `hooks/useVoiceDetection.js`

### 4. WebSocket

튜터와 학생 간 상태 공유 및 피드백 전송

- **연결**: AWS API Gateway WebSocket
- **메시지 타입**:
  - `statusUpdate`: 학생 상태 업데이트 (발음 중, 대기 중)
  - `feedback`: 튜터 → 학생 피드백
  - `notification`: 실시간 알림
- **위치**: `config/webSocketConfig.js`, `hooks/useWebSocket.js`

### 5. Redux Toolkit

전역 상태 관리

- **authSlice**: 사용자 인증 상태 (로그인, 로그아웃, 토큰)
- **tutorStudentsSlice**: 튜터가 담당하는 학생들의 상태
- **tutorStatsSlice**: 학생별 통계 데이터
- **whisperPreloadSlice**: Whisper 모델 로딩 상태

---

## Environment & Deployment

### Development

- Vite Dev Server: `http://localhost:3000`
- Hot Module Replacement (HMR) 지원
- API/WebSocket 프록시 설정으로 CORS 회피

### Production Build

```bash
npm run build
# dist/ 폴더에 빌드 결과 생성
```

**배포**:
- AWS S3 + CloudFront
- Netlify
- Vercel

---

## Browser Support

- Chrome/Edge 90+
- Firefox 88+
- Safari 14+

**주요 브라우저 기능 요구사항**:
- WebRTC (getUserMedia)
- Web Workers
- WebAssembly (Whisper STT)
- WebSocket

---

## Team

**3조**: 안창완, 강형원, 황성준

---

## License

This project is licensed under the MIT License.
