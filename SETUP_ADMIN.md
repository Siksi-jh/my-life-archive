# THE YEARS v2 설치 순서

## A. 먼저 사이트 디자인만 교체
이 ZIP의 `worker-backend` 폴더를 제외한 루트 파일들을 기존 GitHub 저장소 `my-life-archive`에 업로드하고 Commit changes 합니다.
Cloudflare Pages가 자동 재배포합니다.

### 개선된 Life Index
- 현재 연도는 크게 표시
- 30대/40대/50대... 탭으로 나눠서 표시
- 모든 연도를 한 화면에 길게 늘어놓지 않음
- `2026 · 37세`처럼 한 줄 고정
- 모바일은 2열

---

## B. 관리자 글쓰기 기능 연결
관리자 기능은 별도 Cloudflare Worker API + D1 + R2를 사용합니다.

### 1. Node.js가 PC에 설치되어 있어야 합니다
설치 후 터미널에서:
`node -v`

### 2. worker-backend 폴더에서
`npm install`
`npx wrangler login`

### 3. D1 데이터베이스 만들기
`npx wrangler d1 create the-years-db`

출력되는 `database_id`를 `worker-backend/wrangler.toml`의
`REPLACE_WITH_D1_DATABASE_ID` 자리에 붙여넣습니다.

### 4. D1 테이블 생성
`npx wrangler d1 execute the-years-db --remote --file=./migrations/0001_schema.sql`

### 5. 사진용 R2 버킷 만들기
`npx wrangler r2 bucket create the-years-media`

### 6. 관리자 비밀번호와 세션 비밀키 등록
절대로 GitHub 소스에 비밀번호를 쓰지 마세요.

`npx wrangler secret put ADMIN_PASSWORD`
→ 원하는 관리자 비밀번호 입력

`npx wrangler secret put SESSION_SECRET`
→ 길고 랜덤한 문자열 입력

Cloudflare 공식 방식처럼 Secret으로 저장됩니다.

### 7. Worker 배포
`npx wrangler deploy`

성공하면:
`https://the-years-api.<계정>.workers.dev`
같은 주소가 나옵니다.

### 8. 사이트에 API 주소 연결
사이트 루트의 `js/config.js`를 열고:
`apiBase: ""`
를
`apiBase: "https://the-years-api.<계정>.workers.dev"`
로 변경 후 GitHub Commit.

### 9. 관리자 사용
사이트 주소 뒤에 `/admin/`
예:
`https://my-life-archive-8mc.pages.dev/admin/`

관리자 비밀번호로 로그인 → 날짜/카테고리/제목/본문 → 사진 여러 장 선택 → 게시하기.

---

## C. 보안 메모
- ADMIN_PASSWORD와 SESSION_SECRET은 GitHub에 넣지 않음
- Cloudflare Worker Secret으로만 저장
- 관리자 토큰은 브라우저 sessionStorage에 저장되어 창을 닫으면 사라짐
- 사진 한 장 15MB 제한, 한 게시글 최대 20장
- FRONTEND_ORIGIN은 현재 Pages 주소로 설정되어 있음. 개인 도메인을 붙인 뒤 그 주소로 바꾸면 됨.

## D. 백업
- GitHub: 사이트 코드
- D1: 글 데이터
- R2: 사진
- Google Drive/외장 SSD: 정기 백업 권장
