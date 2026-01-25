# SpeakTracker 팀 소개 페이지

SpeakTracker 프로젝트의 공식 소개 페이지입니다. AWS S3 정적 웹사이트 호스팅을 사용하여 배포됩니다.

## 📁 파일 구조

```
introduce-page/
├── index.html              # 메인 소개 페이지
├── assets/
│   ├── logo-1024.png      # 팀 로고 (1024x1024)
│   └── styles.css         # 스타일시트
├── bucket-policy.json     # S3 버킷 정책
└── README.md              # 이 파일
```

## 🎨 디자인 테마

- **컬러**: Purple Gradient (#667eea → #764ba2)
- **폰트**:
  - 한글: Noto Sans KR
  - 영문: Roboto
- **스타일**: Modern, Material Design inspired
- **반응형**: Mobile-first responsive design

## 🚀 로컬 테스트

### 방법 1: 파일 직접 열기
```bash
# introduce-page 디렉토리에서
open index.html
```

### 방법 2: Python Simple HTTP Server
```bash
cd introduce-page
python3 -m http.server 8000
```
브라우저에서 http://localhost:8000 접속

### 방법 3: VS Code Live Server
1. VS Code에서 `index.html` 열기
2. 우클릭 → "Open with Live Server"

## 📤 AWS S3 배포 가이드

### 1단계: S3 버킷 생성

```bash
# AWS CLI로 버킷 생성 (Seoul 리전)
aws s3 mb s3://speaktracker-landing --region ap-northeast-2
```

**또는 AWS Console에서:**
1. S3 콘솔 접속
2. "버킷 만들기" 클릭
3. 버킷 이름: `speaktracker-landing` (또는 원하는 이름)
4. 리전: `ap-northeast-2` (서울)
5. "퍼블릭 액세스 차단" 설정 **모두 해제**
6. 버킷 생성

### 2단계: 정적 웹사이트 호스팅 활성화

**AWS CLI:**
```bash
aws s3 website s3://speaktracker-landing \
  --index-document index.html \
  --error-document index.html
```

**AWS Console:**
1. 버킷 선택 → 속성 탭
2. "정적 웹 사이트 호스팅" → 편집
3. 활성화 선택
4. 인덱스 문서: `index.html`
5. 오류 문서: `index.html`
6. 저장 → 엔드포인트 URL 기록

### 3단계: 버킷 정책 설정

**AWS CLI:**
```bash
# bucket-policy.json 파일이 있는 디렉토리에서
aws s3api put-bucket-policy \
  --bucket speaktracker-landing \
  --policy file://bucket-policy.json
```

**AWS Console:**
1. 버킷 → 권한 탭
2. "버킷 정책" → 편집
3. `bucket-policy.json` 내용 복사/붙여넣기
4. 저장

### 4단계: 파일 업로드

**AWS CLI (권장):**
```bash
# introduce-page 디렉토리에서
aws s3 sync . s3://speaktracker-landing \
  --acl public-read \
  --exclude ".DS_Store" \
  --exclude "README.md" \
  --exclude "bucket-policy.json" \
  --cache-control "max-age=86400"
```

**AWS Console:**
1. 버킷 → 업로드
2. `index.html`, `assets/` 폴더 선택
3. 권한 → "모든 사람에게 읽기 권한 부여" 체크
4. 업로드

### 5단계: 접속 확인

S3 웹사이트 엔드포인트로 접속:
```
http://speaktracker-landing.s3-website.ap-northeast-2.amazonaws.com
```

## 🔄 업데이트 방법

### 전체 업데이트
```bash
cd introduce-page
aws s3 sync . s3://speaktracker-landing \
  --acl public-read \
  --exclude ".DS_Store" \
  --exclude "README.md" \
  --exclude "bucket-policy.json" \
  --delete
```

### HTML만 업데이트
```bash
aws s3 cp index.html s3://speaktracker-landing/ \
  --acl public-read \
  --cache-control "no-cache"
```

### CSS만 업데이트
```bash
aws s3 cp assets/styles.css s3://speaktracker-landing/assets/ \
  --acl public-read \
  --cache-control "max-age=31536000"
```

## 🌐 선택사항: CloudFront + 커스텀 도메인

### CloudFront 배포 (HTTPS 지원)

1. **CloudFront 배포 생성**
   - Origin: S3 버킷 엔드포인트
   - Viewer Protocol Policy: Redirect HTTP to HTTPS
   - Default Root Object: `index.html`

2. **SSL 인증서 요청** (ACM)
   - us-east-1 리전에서 요청 (CloudFront용)
   - 도메인 검증 완료

3. **CloudFront에 도메인 연결**
   - Alternate Domain Names (CNAMEs) 추가
   - SSL Certificate 선택

4. **Route 53에서 도메인 연결**
   - A 레코드 (Alias) 생성
   - CloudFront 배포 선택

### 캐시 무효화 (업데이트 후)
```bash
aws cloudfront create-invalidation \
  --distribution-id YOUR_DISTRIBUTION_ID \
  --paths "/*"
```

## 💰 비용 예상

### S3만 사용 (최소 비용)
- 스토리지: ~10MB → **거의 무료** ($0.0002/월)
- 요청: 10,000회/월 → **$0.05/월**
- 데이터 전송: 20GB/월 → **$1.80/월**
- **총 예상 비용: ~$2/월**

### CloudFront + 도메인 사용
- S3: $2/월
- CloudFront: $1.70/월 (20GB 전송)
- Route 53: $0.50/월 (호스팅 영역)
- 도메인: $1/월 ($12/년)
- **총 예상 비용: ~$5-6/월**

**AWS 프리티어** (첫 12개월):
- S3: 5GB 스토리지, 20,000 GET 요청
- CloudFront: 50GB 전송
- **→ 첫 1년간 거의 무료!**

## 🔒 보안 체크리스트

- [x] 버킷 정책: 읽기만 허용 (쓰기 불가)
- [x] 버전 관리: 활성화 권장 (롤백 가능)
- [x] 민감 정보 없음: API 키, 사용자 데이터 등 미포함
- [x] HTTPS: CloudFront 사용 시 강제 리다이렉트

## 📊 분석 추가 (선택사항)

### Google Analytics
`index.html`의 `</head>` 전에 추가:
```html
<!-- Google Analytics -->
<script async src="https://www.googletagmanager.com/gtag/js?id=GA_MEASUREMENT_ID"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', 'GA_MEASUREMENT_ID');
</script>
```

### AWS CloudWatch (S3 로깅)
```bash
aws s3api put-bucket-logging \
  --bucket speaktracker-landing \
  --bucket-logging-status file://logging.json
```

## 🎯 커스터마이징 가이드

### 로고 교체
1. 새 로고를 `assets/` 폴더에 추가
2. `index.html`에서 경로 수정:
   ```html
   <img src="assets/new-logo.png" alt="Logo">
   ```

### 팀 멤버 사진 추가
`index.html`의 Team Section에 추가:
```html
<div class="team-grid">
  <div class="team-member">
    <img src="assets/member1.jpg" alt="Member 1">
    <h3>이름</h3>
    <p>역할 - 설명</p>
  </div>
</div>
```

`styles.css`에 스타일 추가:
```css
.team-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 30px;
}

.team-member img {
  width: 150px;
  height: 150px;
  border-radius: 50%;
  object-fit: cover;
}
```

### 컬러 테마 변경
`styles.css`의 `:root` 섹션 수정:
```css
:root {
  --primary-start: #your-color-1;
  --primary-end: #your-color-2;
  --primary-gradient: linear-gradient(135deg, #your-color-1 0%, #your-color-2 100%);
}
```

## 🐛 트러블슈팅

### 403 Forbidden 오류
- 버킷 정책이 올바르게 설정되었는지 확인
- 퍼블릭 액세스 차단 설정 확인
- 파일에 public-read ACL 권한이 있는지 확인

### 404 Not Found 오류
- 파일 경로가 정확한지 확인
- S3 버킷에 파일이 업로드되었는지 확인
- 대소문자 구분에 주의

### 스타일이 안 보임
- `assets/styles.css` 경로 확인
- 브라우저 캐시 삭제 (Ctrl+Shift+R / Cmd+Shift+R)
- Content-Type이 `text/css`로 설정되었는지 확인

### CloudFront 업데이트가 안 보임
- 캐시 무효화(Invalidation) 실행
- TTL 시간 대기 (기본 24시간)

## 📞 지원

문제가 발생하면:
1. AWS CloudWatch Logs 확인
2. S3 액세스 로그 확인
3. 브라우저 개발자 도구 콘솔 확인

## 📝 라이선스

© 2026 SpeakTracker Team. All rights reserved.
