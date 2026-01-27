# 대시보드 & 학생 상세 페이지 학생 상태 공유 리덕스 구현 가이드

## 1. 현재 상황 분석

### 1.1 데이터 흐름 (As-Is)

```
DashboardPage                          StudentDetailPage
      │                                       │
      ▼                                       ▼
useTutorStudents()                    useTutorStudents()
(api/useTutorStudents.js)            (api/useTutorStudents.js)
      │                                       │
      ▼                                       ▼
/api/tutor/students ◄──────────────► /api/tutor/students
                    (각각 독립 호출)

❌ 문제점:
- 두 페이지가 독립적으로 API 호출
- 데이터 불일치 가능성
- 불필요한 중복 요청
```

### 1.2 현재 사용 중인 상태

**DashboardPage**:
- `students` - 학생 목록 배열
- `loading` - 로딩 상태
- `error` - 에러 메시지
- `refetch()` - 새로고침 함수

**StudentDetailPage (useStudentDetail)**:
- `students` - 학생 목록에서 찾기
- `student` - 현재 학생 객체
- `studentActivity` - AI 대화/문장 연습 여부
- `studentStatus` - 온라인/오프라인 상태

---

## 2. 리덕스 공유 설계 (To-Be)

### 2.1 목표 아키텍처

```
┌─────────────────────────────────────────────────────────────┐
│                      Redux Store                             │
│                  state.tutorStudents                         │
│                                                              │
│   students: []         ← 학생 목록                           │
│   loading: false       ← 로딩 상태                           │
│   lastUpdate: Date     ← 마지막 업데이트 시간                 │
│   error: null          ← 에러 메시지                         │
└─────────────────────────────────────────────────────────────┘
                          │
          ┌───────────────┼───────────────┐
          │               │               │
          ▼               ▼               ▼
   DashboardPage   StudentDetailPage  (다른 페이지)
    - 읽기/쓰기      - 읽기 전용      - 읽기 전용
    - 60초 폴링
    - API 호출
```

### 2.2 데이터 소유권

| 컴포넌트 | 역할 | Redux 사용 |
|---------|------|-----------|
| **DashboardPage** | 데이터 소유자 (Owner) | 읽기 + 쓰기 (API 호출, Redux 저장) |
| **StudentDetailPage** | 데이터 소비자 (Consumer) | 읽기 전용 (Redux에서 읽기) |
| **기타 페이지** | 데이터 소비자 | 읽기 전용 |

**핵심 원칙**: 
- DashboardPage만 API 호출 및 Redux 업데이트
- 나머지는 Redux에서 읽기만

---

## 3. 리덕스 슬라이스 구조

### 3.1 파일 생성

**파일명**: `src/store/slices/tutorStudentsSlice.js`

```javascript
import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  students: [],           // 학생 목록
  loading: false,         // 로딩 상태
  error: null,           // 에러 메시지
  lastUpdate: null,      // 마지막 업데이트 시간
};

const tutorStudentsSlice = createSlice({
  name: 'tutorStudents',
  initialState,
  reducers: {
    // 로딩 시작
    setLoading: (state, action) => {
      state.loading = action.payload;
    },
    
    // 학생 목록 설정
    setStudents: (state, action) => {
      state.students = action.payload;
      state.lastUpdate = new Date().toISOString();
      state.error = null;
    },
    
    // 에러 설정
    setError: (state, action) => {
      state.error = action.payload;
      state.loading = false;
    },
    
    // 개별 학생 업데이트 (실시간 상태 변경)
    updateStudent: (state, action) => {
      const { email, updates } = action.payload;
      const index = state.students.findIndex(s => s.email === email);
      if (index !== -1) {
        state.students[index] = { ...state.students[index], ...updates };
      }
    },
    
    // 학생 추가
    addStudent: (state, action) => {
      state.students.push(action.payload);
    },
    
    // 학생 제거
    removeStudent: (state, action) => {
      state.students = state.students.filter(s => s.email !== action.payload);
    },
    
    // 초기화
    reset: () => initialState,
  },
});

export const {
  setLoading,
  setStudents,
  setError,
  updateStudent,
  addStudent,
  removeStudent,
  reset,
} = tutorStudentsSlice.actions;

export default tutorStudentsSlice.reducer;
```

### 3.2 Store 등록

**파일**: `src/store/index.js`

```javascript
import { configureStore } from '@reduxjs/toolkit';
import authReducer from './slices/authSlice';
import speakingStatsReducer from './slices/speakingStatsSlice';
import whisperPreloadReducer from './slices/whisperPreloadSlice';
import tutorStatsReducer from './slices/tutorStatsSlice';
import tutorStudentsReducer from './slices/tutorStudentsSlice'; // ← 추가
import ws from '../config/webSocketConfig';

export const store = configureStore({
  reducer: {
    auth: authReducer,
    speakingStats: speakingStatsReducer,
    whisperPreload: whisperPreloadReducer,
    tutorStats: tutorStatsReducer,
    tutorStudents: tutorStudentsReducer, // ← 추가
  },
});

ws.setStore(store);

export default store;
```

---

## 4. 커스텀 훅 구현

### 4.1 DashboardPage용 훅 (쓰기 + 읽기)

**파일**: `src/hooks/tutor/useTutorStudentsRedux.js`

```javascript
import { useEffect, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import api from '../../api/axios';
import { setLoading, setStudents, setError } from '../../store/slices/tutorStudentsSlice';

/**
 * 튜터 학생 목록 관리 (Redux 연동 - DashboardPage 전용)
 * API 호출 + Redux 저장
 */
export default function useTutorStudentsRedux() {
  const dispatch = useDispatch();
  
  // Redux에서 상태 읽기
  const students = useSelector(state => state.tutorStudents.students);
  const loading = useSelector(state => state.tutorStudents.loading);
  const error = useSelector(state => state.tutorStudents.error);
  const lastUpdate = useSelector(state => state.tutorStudents.lastUpdate);

  // API 호출 및 Redux 저장
  const fetchStudents = useCallback(async () => {
    try {
      dispatch(setLoading(true));
      
      const response = await api.get('/api/tutor/students');
      
      if (response.data.success) {
        // API 응답의 studentName을 name으로 매핑
        const mappedStudents = response.data.data.students.map(student => ({
          ...student,
          name: student.studentName || student.name,
          email: student.studentEmail || student.email,
        }));
        
        dispatch(setStudents(mappedStudents));
      } else {
        throw new Error('학생 목록 조회 실패');
      }
    } catch (err) {
      console.error('학생 목록 조회 에러:', err);
      dispatch(setError(err.message || '학생 목록을 불러오는데 실패했습니다.'));
    } finally {
      dispatch(setLoading(false));
    }
  }, [dispatch]);

  // 초기 로드
  useEffect(() => {
    fetchStudents();
  }, [fetchStudents]);

  // 60초 폴링
  useEffect(() => {
    const interval = setInterval(() => {
      fetchStudents();
    }, 60000); // 60초

    return () => clearInterval(interval);
  }, [fetchStudents]);

  return {
    students,
    loading,
    error,
    lastUpdate,
    refetch: fetchStudents,
  };
}
```

### 4.2 StudentDetailPage용 훅 (읽기 전용)

**파일**: `src/hooks/tutor/useStudentDetail.js` (수정)

```javascript
import { useMemo } from 'react';
import { useSelector } from 'react-redux';
import { getStudentStatus } from '../../utils/timeUtils';

/**
 * 학생 상세 정보 및 활동 상태 뱃지 관리 (Redux 읽기 전용)
 */
export default function useStudentDetail(email) {
  // Redux에서 학생 목록 읽기 (읽기 전용)
  const students = useSelector(state => state.tutorStudents.students);
  const loading = useSelector(state => state.tutorStudents.loading);
  
  // 튜터 이메일은 auth에서 가져옴
  const tutorEmail = useSelector(state => state.auth.user?.email);
  
  const student = useMemo(
    () => students.find((s) => s.email === email),
    [students, email]
  );

  // 학생 상태 정보 계산
  const statusInfo = useMemo(() => getStudentStatus(student), [student]);
  
  const studentName = student?.name || '이름 없음';
  const studentStatus = statusInfo.status;
  const studentActivity = statusInfo.status === 'ai' ? 'conversation' 
    : statusInfo.status === 'sentence' ? 'sentence' 
    : null;

  const activityBadge = useMemo(() => {
    if (studentActivity === 'conversation') {
      return {
        label: 'AI 대화',
        icon: 'forum',
        className: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
      };
    }
    if (studentActivity === 'sentence') {
      return {
        label: '문장 연습',
        icon: 'format_quote',
        className: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
      };
    }
    if (studentStatus !== 'offline' && studentStatus !== 'inactive') {
      return {
        label: statusInfo.activity || '접속 중',
        icon: 'wifi',
        className: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
      };
    }
    return {
      label: '오프라인',
      icon: 'cloud_off',
      className: 'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-300',
    };
  }, [studentActivity, studentStatus, statusInfo.activity]);

  return {
    student,
    students,
    studentName,
    studentStatus,
    studentActivity,
    activityBadge,
    loadingStudents: loading,
    tutorEmail,
  };
}
```

---

## 5. 컴포넌트 수정

### 5.1 DashboardPage 수정

```javascript
// Before
import { useTutorStudents } from '../../api/useTutorStudents';

const {
  students,
  loading: loadingStudents,
  error,
  refetch,
} = useTutorStudents();

// After
import useTutorStudentsRedux from '../../hooks/tutor/useTutorStudentsRedux';

const {
  students,
  loading: loadingStudents,
  error,
  refetch,
} = useTutorStudentsRedux();

// 60초 폴링은 훅 내부에서 처리되므로 useEffect 제거
```

### 5.2 StudentDetailPage 수정

```javascript
// 변경 없음 - useStudentDetail 훅이 내부적으로 Redux 사용
```

---

## 6. WebSocket 실시간 업데이트 (선택 사항)

학생 상태가 변경될 때 실시간 업데이트가 필요한 경우:

### 6.1 WebSocket 리스너 추가

**파일**: `src/hooks/tutor/useTutorStudentsRedux.js`

```javascript
import ws from '../../config/webSocketConfig';
import { updateStudent } from '../../store/slices/tutorStudentsSlice';

// 훅 내부에 추가
useEffect(() => {
  const handleWebSocketMessage = (data) => {
    if (data.type === 'student_status_update') {
      dispatch(updateStudent({
        email: data.studentEmail,
        updates: {
          status: data.status,
          room: data.room,
          updated_at: data.timestamp,
        },
      }));
    }
  };

  ws.getSocket();
  const unsubscribe = ws.addMessageListener(handleWebSocketMessage);
  
  return () => unsubscribe();
}, [dispatch]);
```

---

## 7. 장단점 분석

### 7.1 리덕스 공유 사용 시

✅ **장점**:
- 데이터 일관성 보장
- API 호출 중복 제거
- 페이지 간 즉각적인 데이터 동기화
- 학생 상태 실시간 업데이트 용이

⚠️ **단점**:
- 초기 구현 복잡도 증가
- Redux 보일러플레이트 코드
- 페이지 이동 시에도 데이터 유지 (새로고침 시 초기화)

### 7.2 현재 방식 (독립 API 호출)

✅ **장점**:
- 구현 단순
- 각 페이지 독립적
- Redux 의존성 없음

⚠️ **단점**:
- 데이터 불일치 가능성
- 중복 API 호출
- 페이지 간 데이터 공유 어려움

---

## 8. 구현 단계별 체크리스트

### Phase 1: Redux 슬라이스 생성
- [ ] `tutorStudentsSlice.js` 파일 생성
- [ ] `store/index.js`에 reducer 등록
- [ ] Redux DevTools로 state 확인

### Phase 2: 커스텀 훅 생성
- [ ] `useTutorStudentsRedux.js` 생성 (DashboardPage용)
- [ ] `useStudentDetail.js` 수정 (Redux 읽기)
- [ ] 기존 `api/useTutorStudents.js`와 비교 테스트

### Phase 3: 컴포넌트 통합
- [ ] DashboardPage import 변경
- [ ] StudentDetailPage useStudentDetail 확인
- [ ] 데이터 흐름 테스트

### Phase 4: 실시간 업데이트 (선택)
- [ ] WebSocket 리스너 추가
- [ ] 학생 상태 변경 테스트
- [ ] 폴링 + WebSocket 동시 동작 확인

---

## 9. 예상 작업 시간

| 단계 | 예상 시간 |
|------|----------|
| Phase 1: Redux 슬라이스 | 20분 |
| Phase 2: 커스텀 훅 | 30분 |
| Phase 3: 컴포넌트 통합 | 20분 |
| Phase 4: WebSocket (선택) | 30분 |
| 테스트 및 디버깅 | 30분 |
| **총계** | **2시간 10분** |

---

## 10. 대안: 로컬 상태 공유 (React Context)

리덕스가 부담스럽다면 React Context API 사용도 가능:

```javascript
// StudentsContext.js
const StudentsContext = createContext();

export function StudentsProvider({ children }) {
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(false);
  
  // API 호출 로직
  
  return (
    <StudentsContext.Provider value={{ students, loading, refetch }}>
      {children}
    </StudentsContext.Provider>
  );
}

// 사용
const { students } = useContext(StudentsContext);
```

**Context API vs Redux**:
- Context: 간단한 공유에 적합
- Redux: 복잡한 상태 관리, DevTools, 미들웨어 필요 시

---

## 11. 추천 방안

현재 프로젝트 상황을 고려한 추천:

### 추천: **Redux 방식**

**이유**:
1. 이미 Redux 사용 중 (auth, speakingStats 등)
2. 학생 상태는 여러 곳에서 참조 가능
3. WebSocket 실시간 업데이트와 잘 어울림
4. Redux DevTools로 디버깅 용이

### 구현 순서:
1. `tutorStudentsSlice.js` 생성
2. `useTutorStudentsRedux.js` 생성 (DashboardPage용)
3. `useStudentDetail.js` 수정 (Redux 읽기)
4. DashboardPage import 변경
5. 테스트 후 WebSocket 추가 (필요 시)
