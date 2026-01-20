# StatsPage와 백엔드 API 연동 가이드

## 📋 목차
- [API 엔드포인트 개요](#api-엔드포인트-개요)
- [현재 UI vs 백엔드 API 호환성](#현재-ui-vs-백엔드-api-호환성)
- [데이터 매핑 가이드](#데이터-매핑-가이드)
- [수정 필요 사항](#수정-필요-사항)
- [구현 예시 코드](#구현-예시-코드)

---

## API 엔드포인트 개요

### 1. 오늘 통계 조회
```http
GET /api/statistics/today?studentEmail={email}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "studentEmail": "student@example.com",
    "date": "2024-01-19",
    "totalRecordingTime": 900000,      // ms
    "totalSpeakingTime": 540000,       // ms
    "sessionsCount": 3,
    "practiceCount": 2,
    "chatTurnsCount": 8,
    "avgPaceRatio": 1.15,
    "avgResponseLatency": 1875,        // ms
    "avgNetSpeakingDensity": 60.0      // %
  }
}
```

### 2. 주간 통계 조회
```http
GET /api/statistics/weekly?studentEmail={email}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "daily": [
      {
        "date": "2024-01-13",
        "totalRecordingTime": 1800000,
        "totalSpeakingTime": 1080000,
        "sessionsCount": 2,
        "practiceCount": 1,
        "chatTurnsCount": 5,
        "avgPaceRatio": 1.1,
        "avgResponseLatency": 1500,
        "avgNetSpeakingDensity": 58.0
      }
      // ... 7일치 데이터
    ],
    "summary": {
      "totalRecordingTime": 6300000,
      "totalSpeakingTime": 3780000,
      "totalSessions": 15,
      "avgPaceRatio": 1.1,
      "avgResponseLatency": 1650,
      "avgNetSpeakingDensity": 62.5
    }
  }
}
```

---

## 현재 UI vs 백엔드 API 호환성

### ✅ 완전 호환 (그대로 사용 가능)

| UI 요소 | 백엔드 필드 | 변환 필요 | 상태 |
|---------|-----------|---------|------|
| 총 학습 시간 (KPI) | `totalRecordingTime` | ms → 분 | ✅ |
| 발음 시간 (KPI) | `totalSpeakingTime` | ms → 분 | ✅ |
| 연습 횟수 (KPI) | `practiceCount` | 없음 | ✅ |
| 발음 비율 (Summary) | `avgNetSpeakingDensity` | 없음 | ✅ |
| 평균 응답 시간 (Summary) | `avgResponseLatency` | ms → 초 | ✅ |
| 속도 비율 (Summary) | `avgPaceRatio` | 없음 | ✅ |

### ⚠️ 부분 호환 (수정 필요)

| UI 요소 | 문제점 | 해결 방안 |
|---------|-------|----------|
| KPI 변화율 (±%) | API에 없음 | 전주 데이터와 비교 계산 |
| 이번 주 총합 | 하드코딩됨 | `summary.totalRecordingTime` 사용 |
| 지난 주 대비 % | 하드코딩됨 | 이전 주 데이터와 비교 계산 |

### ❌ 호환 불가 (백엔드 수정 또는 UI 변경 필요)

#### 1. Learning Trend 차트 (라인 차트)
**현재 UI:**
```javascript
{ name: '월', speaking: 45, listening: 30, practice: 25 }
```

**백엔드 API:**
```javascript
{ date: "2024-01-13", totalRecordingTime: 1800000, totalSpeakingTime: 1080000 }
```

**문제:**
- `listening` (듣기 시간) 데이터 없음 ❌
- `practice` (연습 시간) 데이터 없음 ❌ (practiceCount만 존재)

**해결책 옵션:**
1. **백엔드 수정**: 세션 타입별 시간 추적 추가
2. **UI 단순화**: 2개 라인만 표시 (총 시간, 발음 시간)

#### 2. Activity Comparison (막대 차트)
**현재 UI:**
```javascript
{ name: '1주차', sentence: 45, aiChat: 38 }
```

**문제:**
- 세션 타입별 시간 구분 없음 ❌

**해결책:**
- 백엔드에서 `sessionType` 별로 집계하여 반환

#### 3. Activity Distribution (도넛 차트)
**현재 UI:**
```javascript
[
  { name: '문장 연습', value: 45, color: '#6366f1' },
  { name: 'AI 대화', value: 35, color: '#22c55e' },
  { name: '튜터 피드백', value: 20, color: '#fbbf24' }
]
```

**문제:**
- 활동별 비율 데이터 없음 ❌
- 튜터 피드백 시간 없음 ❌

**해결책:**
- 백엔드에서 세션 타입별 비율 계산
- 튜터 피드백은 별도 API 필요

#### 4. 튜터 피드백 개수
**문제:**
- 현재 하드코딩 (23개)
- API에 해당 데이터 없음 ❌

**해결책:**
- 별도 엔드포인트 필요: `GET /api/feedback/count?studentEmail=...`

---

## 데이터 매핑 가이드

### 1. Today API → KPI 카드 매핑

```javascript
// API 응답
const apiData = {
  totalRecordingTime: 900000,  // 900초 = 15분
  totalSpeakingTime: 540000,   // 540초 = 9분
  practiceCount: 2
};

// UI 데이터로 변환
const kpiData = {
  totalTime: {
    value: Math.floor(apiData.totalRecordingTime / 60000),  // 15
    unit: '분',
    change: 65  // 전주 대비 계산 필요
  },
  speakingTime: {
    value: Math.floor(apiData.totalSpeakingTime / 60000),   // 9
    unit: '분',
    change: 25  // 전주 대비 계산 필요
  },
  practiceCount: {
    value: apiData.practiceCount,  // 2
    unit: '회',
    change: -5  // 전주 대비 계산 필요
  }
};
```

### 2. Today API → Weekly Summary 매핑

```javascript
// API 응답
const apiData = {
  avgNetSpeakingDensity: 60.0,
  avgResponseLatency: 1875,
  avgPaceRatio: 1.15
};

// UI 데이터로 변환
const summaryData = {
  speakingRatio: Math.round(apiData.avgNetSpeakingDensity),      // 60%
  avgResponse: (apiData.avgResponseLatency / 1000).toFixed(1),   // 1.9초
  paceRatio: apiData.avgPaceRatio.toFixed(2),                    // 1.15
  tutorFeedbacks: 23  // 별도 API 필요
};
```

### 3. Weekly API → Learning Trend 차트 매핑

```javascript
// API 응답
const weeklyData = {
  daily: [
    { date: "2024-01-13", totalRecordingTime: 1800000, totalSpeakingTime: 1080000 },
    { date: "2024-01-14", totalRecordingTime: 1500000, totalSpeakingTime: 900000 },
    // ...
  ]
};

// 날짜를 요일로 변환
function formatToWeekday(dateStr) {
  const weekdays = ['일', '월', '화', '수', '목', '금', '토'];
  const date = new Date(dateStr);
  return weekdays[date.getDay()];
}

// UI 차트 데이터로 변환 (단순화 버전)
const chartData = weeklyData.daily.map(day => ({
  name: formatToWeekday(day.date),
  speaking: Math.floor(day.totalSpeakingTime / 60000),    // ms → 분
  total: Math.floor(day.totalRecordingTime / 60000)       // ms → 분
}));
```

### 4. Weekly Summary 계산

```javascript
// API 응답
const summary = {
  totalRecordingTime: 6300000,  // 105분
  totalSpeakingTime: 3780000,   // 63분
  totalSessions: 15,
  avgNetSpeakingDensity: 62.5
};

// UI 데이터로 변환
const weeklyTotal = {
  totalMinutes: Math.floor(summary.totalRecordingTime / 60000),  // 105분
  speakingMinutes: Math.floor(summary.totalSpeakingTime / 60000), // 63분
  sessions: summary.totalSessions,                                // 15
  speakingRatio: Math.round(summary.avgNetSpeakingDensity)       // 63%
};
```

---

## 수정 필요 사항

### 1. 백엔드 수정 필요 (권장)

#### A. 세션 타입별 시간 집계
```javascript
// 필요한 응답 형식
{
  "sessionTypeBreakdown": {
    "sentence": { "time": 2700000, "count": 8 },
    "aiChat": { "time": 1800000, "count": 5 },
    "tutor": { "time": 900000, "count": 2 }
  }
}
```

#### B. 변화율 계산
```javascript
// 필요한 응답 형식
{
  "totalRecordingTime": 900000,
  "totalRecordingTimeChange": 15.5,  // 전주 대비 %
  "totalSpeakingTime": 540000,
  "totalSpeakingTimeChange": -5.2,   // 전주 대비 %
  "practiceCount": 2,
  "practiceCountChange": -10.0       // 전주 대비 %
}
```

#### C. 튜터 피드백 통계
```javascript
// 새 엔드포인트: GET /api/feedback/count
{
  "success": true,
  "data": {
    "totalCount": 23,
    "thisWeekCount": 5,
    "avgPerSession": 1.8
  }
}
```

### 2. 프론트엔드 수정 필요

#### A. 차트 단순화 (단기 해결책)

**Learning Trend 차트:**
```javascript
// 3개 라인 → 2개 라인으로 축소
<Line dataKey="speaking" name="발음" stroke="#6366f1" />
<Line dataKey="total" name="총 시간" stroke="#f43f5e" />
// listening, practice 라인 제거
```

**Activity 차트:**
```javascript
// 데이터 없으면 임시로 숨김 또는 제거
{/* 백엔드 데이터 준비 후 활성화 */}
```

#### B. 변화율 프론트에서 계산

```javascript
// 이전 주 데이터와 비교
function calculateChange(current, previous) {
  if (!previous || previous === 0) return 0;
  return ((current - previous) / previous) * 100;
}

// 사용 예시
const thisWeek = apiData.summary.totalRecordingTime;
const lastWeek = lastWeekData.summary.totalRecordingTime;
const change = calculateChange(thisWeek, lastWeek);
```

---

## 구현 예시 코드

### API 호출 함수 (axios)

```javascript
// src/api/statistics.js
import axios from './axios';

/**
 * 오늘 통계 조회
 */
export async function getTodayStatistics(studentEmail) {
  const res = await axios.get('/api/statistics/today', {
    params: { studentEmail }
  });
  return res.data;
}

/**
 * 주간 통계 조회
 */
export async function getWeeklyStatistics(studentEmail) {
  const res = await axios.get('/api/statistics/weekly', {
    params: { studentEmail }
  });
  return res.data;
}
```

### StatsPage 컴포넌트 연동

```javascript
import { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { getTodayStatistics, getWeeklyStatistics } from '../../api/statistics';

export default function StatsPage() {
  const user = useSelector(state => state.auth.user);
  const [todayStats, setTodayStats] = useState(null);
  const [weeklyStats, setWeeklyStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadStats() {
      if (!user?.email) return;
      
      try {
        setLoading(true);
        const [today, weekly] = await Promise.all([
          getTodayStatistics(user.email),
          getWeeklyStatistics(user.email)
        ]);
        
        setTodayStats(today.data);
        setWeeklyStats(weekly.data);
      } catch (error) {
        console.error('통계 로드 실패:', error);
      } finally {
        setLoading(false);
      }
    }

    loadStats();
  }, [user?.email]);

  // 데이터 변환
  const kpiData = todayStats ? {
    totalTime: {
      value: Math.floor(todayStats.totalRecordingTime / 60000),
      unit: '분',
      change: 0 // TODO: 전주 대비 계산
    },
    speakingTime: {
      value: Math.floor(todayStats.totalSpeakingTime / 60000),
      unit: '분',
      change: 0
    },
    practiceCount: {
      value: todayStats.practiceCount,
      unit: '회',
      change: 0
    }
  } : null;

  const chartData = weeklyStats?.daily.map(day => ({
    name: formatToWeekday(day.date),
    speaking: Math.floor(day.totalSpeakingTime / 60000),
    total: Math.floor(day.totalRecordingTime / 60000)
  })) || [];

  if (loading) return <div>로딩 중...</div>;

  return (
    <StudentLayout todayTime={kpiData?.totalTime.value * 60 || 0}>
      {/* KPI 카드 */}
      <Grid container spacing={2}>
        <Grid item xs={12} sm={4}>
          <KPICard
            icon={<Timer />}
            label="총 학습 시간"
            value={kpiData.totalTime.value}
            unit={kpiData.totalTime.unit}
            change={kpiData.totalTime.change}
          />
        </Grid>
        {/* ... */}
      </Grid>

      {/* 차트 */}
      <ResponsiveContainer width="100%" height={280}>
        <LineChart data={chartData}>
          <Line dataKey="speaking" name="발음" stroke="#6366f1" />
          <Line dataKey="total" name="총 시간" stroke="#f43f5e" />
        </LineChart>
      </ResponsiveContainer>
    </StudentLayout>
  );
}

function formatToWeekday(dateStr) {
  const weekdays = ['일', '월', '화', '수', '목', '금', '토'];
  const date = new Date(dateStr);
  return weekdays[date.getDay()];
}
```

---

## 우선순위 및 일정

### Phase 1: 핵심 기능 (수요일까지)
- [x] StatsPage UI 디자인 완료
- [ ] Today API 연동 (KPI 카드)
- [ ] Weekly API 연동 (Weekly Summary)
- [ ] 차트 단순화 (2개 라인)

### Phase 2: 개선 사항 (목요일)
- [ ] 변화율 계산 로직
- [ ] 에러 처리
- [ ] 로딩 상태 UI

### Phase 3: 추가 기능 (추후)
- [ ] 세션 타입별 차트
- [ ] 활동 분포 차트
- [ ] 튜터 피드백 통계

---

## 참고 사항

### 시간 단위 변환
```javascript
// ms → 초
const seconds = milliseconds / 1000;

// ms → 분
const minutes = Math.floor(milliseconds / 60000);

// ms → 분:초
const mins = Math.floor(milliseconds / 60000);
const secs = Math.floor((milliseconds % 60000) / 1000);
const formatted = `${mins}:${secs.toString().padStart(2, '0')}`;
```

### 날짜 포맷팅
```javascript
// ISO 문자열 → 요일
function formatToWeekday(dateStr) {
  const weekdays = ['일', '월', '화', '수', '목', '금', '토'];
  return weekdays[new Date(dateStr).getDay()];
}

// ISO 문자열 → 월
function formatToMonth(dateStr) {
  const date = new Date(dateStr);
  return `${date.getMonth() + 1}월`;
}
```

---

## 문의 및 이슈

통계 API 연동 관련 문의는 팀 채널에 남겨주세요.

**작성일**: 2026-01-20  
**작성자**: Luke (프론트엔드 담당)
