# 📁 components/common

공통 UI 컴포넌트

## 파일 목록

### 1. Header.jsx
페이지 상단 헤더

**Props:**
```javascript
{
  title: string,        // 페이지 제목 (optional)
  showTimer: boolean,   // 학습 시간 표시 여부
}
```

**기능:**
- 로고 표시
- 오늘 학습 시간 표시 (학생용)
- 프로필 드롭다운 (로그아웃)

---

### 2. BottomNav.jsx
학생용 하단 탭 네비게이션

**Props:**
```javascript
{
  activeTab: 'practice' | 'chat' | 'stats'
}
```

**기능:**
- 📖 연습 / 💬 대화 / 📊 통계 탭
- 현재 페이지 하이라이트
- 클릭 시 페이지 이동

---

### 3. StatCard.jsx
통계 카드 컴포넌트

**Props:**
```javascript
{
  title: string,    // 카드 제목
  value: string,    // 표시 값
  icon: string,     // 이모지 아이콘
}
```

---

### 4. AudioButton.jsx
Polly TTS 오디오 재생 버튼

**Props:**
```javascript
{
  audioUrl: string,     // S3 음성 파일 URL
  size: 'small' | 'medium' | 'large',
}
```

**기능:**
- 클릭 시 음성 재생
- 재생 중 상태 표시

---

### 5. ProtectedRoute.jsx ✅ (구현됨)
인증 라우트 가드

**Props:**
```javascript
{
  children: ReactNode,
  allowedRoles: string[],  // ['student'] 또는 ['tutor']
}
```
