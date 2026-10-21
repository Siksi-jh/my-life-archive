# THE YEARS — Complete Restore Guide

이 문서는 **THE YEARS 전체 사이트를 장애/계정 분실/Cloudflare 재구축 상황에서 다시 복원하기 위한 재해복구 매뉴얼**입니다.

> 중요: 이 저장소는 Public입니다. 비밀번호, API Token, Secret Access Key, OAuth Client Secret, rclone 설정 원문 등 **실제 비밀값은 절대 이 문서나 저장소에 적지 않습니다.**

---

## 1. 복구에 필요한 3가지

THE YEARS는 아래 3가지만 확보되어 있으면 다시 구축할 수 있습니다.

1. **GitHub 저장소** — 사이트/Worker 소스코드와 설정 구조
   - Repository: `Siksi-jh/my-life-archive`
2. **Google Drive 월간 백업** — D1 데이터 + R2 사진
   - `THE YEARS BACKUP/YYYY-MM/`
   - `database/the-years-db.sql`
   - `photos/` (사진이 존재하는 경우)
3. **새로 재발급 가능한 비밀값들** — Cloudflare/GitHub/Google OAuth Secrets
   - 기존 Secret을 잃어버렸다면 복구하려 하지 말고 새로 발급해서 연결하면 됩니다.

즉, **코드는 GitHub**, **글 데이터와 사진은 Google Drive**, **비밀키는 필요 시 새로 발급**하는 구조입니다.

---

## 2. 현재 서비스 구조

### Frontend

- Cloudflare Pages URL: `https://my-life-archive-8mc.pages.dev`
- GitHub repository: `Siksi-jh/my-life-archive`
- 사이트 API 설정 파일: `js/config.js`
- 현재 Worker API:
  - `https://the-years-api.jh44022.workers.dev`

`js/config.js`의 `apiBase`는 Worker 재배포 후 주소가 바뀌면 반드시 수정해야 합니다.

### Worker

- Worker name: `the-years-api`
- Worker source: `worker-backend/src/index.js`
- Wrangler config: `worker-backend/wrangler.toml`
- Frontend origin variable:
  - `FRONTEND_ORIGIN = https://my-life-archive-8mc.pages.dev`

### D1

- Database name: `the-years-db`
- Current database ID: `42897cf8-9174-4310-a098-e85a068da7da`
- Binding name: `DB`

> 새 D1을 만들면 database ID가 달라집니다. 그 경우 `worker-backend/wrangler.toml`의 `database_id`를 새 ID로 변경해야 합니다.

### R2

- Bucket name: `the-years-media`
- Worker binding name: `MEDIA`

### Worker runtime secrets

Cloudflare Worker에 아래 Secret이 필요합니다.

- `ADMIN_PASSWORD`
- `SESSION_SECRET`
- `PRIVATE_VIEW_PASSWORD` (선택사항)

`PRIVATE_VIEW_PASSWORD`가 없으면 현재 Worker는 관리자 비밀번호를 PRIVATE 열람 비밀번호로 사용합니다.

실제 값은 GitHub에 기록하지 않습니다.

### Trash cleanup cron

현재 Worker cron:

```toml
[triggers]
crons = ["0 * * * *"]
```

매시간 실행되며, 휴지통에서 7일이 지난 글/사진을 영구 삭제하는 정리 작업에 사용됩니다.

---

## 3. 월간 백업 구조

GitHub Actions workflow:

`.github/workflows/monthly-backup.yml`

매월 1일 09:15 KST 기준으로 실행되도록 설정되어 있습니다.

Google Drive 예시:

```text
THE YEARS BACKUP/
└─ 2026-10/
   ├─ database/
   │  └─ the-years-db.sql
   └─ photos/
      └─ posts/...
```

사진이 한 장도 없으면 `photos` 폴더가 Google Drive에 나타나지 않을 수 있습니다. 이것은 정상입니다.

GitHub Actions에도 동일한 `backup/` 폴더가 Artifact로 30일 동안 임시 보관됩니다.

---

# 전체 복구 절차

## 4. GitHub 소스 확보

먼저 `Siksi-jh/my-life-archive` 저장소를 확보합니다.

새 PC라면:

```bash
git clone https://github.com/Siksi-jh/my-life-archive.git
cd my-life-archive
```

GitHub 저장소 자체를 잃은 경우에는 별도 코드 백업이 없으면 복구가 어려우므로 저장소 삭제는 매우 주의해야 합니다.

---

## 5. Cloudflare D1 새로 만들기

Cloudflare에서 새 D1 database를 생성합니다.

권장 이름:

```text
the-years-db
```

생성 후 새 Database ID를 확인합니다.

`worker-backend/wrangler.toml` 수정:

```toml
[[d1_databases]]
binding = "DB"
database_name = "the-years-db"
database_id = "새_D1_DATABASE_ID"
```

---

## 6. D1 데이터 복원

Google Drive에서 가장 최근 정상 백업을 받습니다.

```text
THE YEARS BACKUP/YYYY-MM/database/the-years-db.sql
```

Wrangler 로그인/인증 후 새 D1에 import 합니다.

예시:

```bash
wrangler d1 execute the-years-db \
  --remote \
  --file=the-years-db.sql \
  --config worker-backend/wrangler.toml
```

복원 후 `posts`, `images` 테이블과 글 개수가 정상인지 확인합니다.

> SQL import 전에 대상 D1이 비어 있는지 확인하는 것이 안전합니다. 중복 데이터가 있는 DB에 그대로 import하지 않습니다.

---

## 7. R2 버킷 새로 만들기

Cloudflare R2에서 버킷을 생성합니다.

```text
the-years-media
```

Worker binding은 다음과 같아야 합니다.

```toml
[[r2_buckets]]
binding = "MEDIA"
bucket_name = "the-years-media"
```

---

## 8. 사진 복원

Google Drive 최신 백업의 `photos/` 전체를 R2의 `the-years-media` 버킷에 다시 업로드합니다.

중요한 점:

- 백업 안의 `posts/...` 경로를 그대로 유지해야 합니다.
- object key가 변경되면 D1의 `images.object_key`와 맞지 않아 사진이 깨집니다.

rclone을 쓴다면 개념상 다음과 같습니다.

```bash
rclone copy ./photos r2:the-years-media --progress
```

R2용 Access Key/Secret은 필요 시 새로 발급합니다.

---

## 9. Worker 재배포

필요 도구:

```bash
npm install -g wrangler
```

`worker-backend/wrangler.toml`에서 아래를 다시 확인합니다.

- Worker name = `the-years-api`
- D1 database ID = 새 ID
- R2 bucket = `the-years-media`
- `FRONTEND_ORIGIN` = 실제 Pages 주소

배포:

```bash
cd worker-backend
npx wrangler deploy
```

배포 후 Worker URL을 확인합니다.

Worker URL이 바뀌었다면 `js/config.js`의:

```js
apiBase: "https://새-worker-url.workers.dev"
```

로 수정 후 GitHub에 commit/push 합니다.

---

## 10. Worker Secrets 재등록

Cloudflare Worker → Settings → Variables and Secrets에서 다음을 다시 생성합니다.

```text
ADMIN_PASSWORD
SESSION_SECRET
PRIVATE_VIEW_PASSWORD   (선택)
```

### SESSION_SECRET

기존 값을 모르면 새 강력한 랜덤 문자열로 만들어도 됩니다.

이 값을 바꾸면 기존 로그인 세션은 무효화되지만 데이터는 손상되지 않습니다.

### ADMIN_PASSWORD

기존 값을 잃어버렸다면 새 관리자 비밀번호를 정해도 됩니다.

### PRIVATE_VIEW_PASSWORD

별도로 설정하지 않으면 관리자 비밀번호와 같은 값으로 동작합니다. 장기적으로는 별도 비밀번호 사용을 권장합니다.

---

## 11. Cloudflare Pages 재구축

GitHub 저장소 `Siksi-jh/my-life-archive`를 Cloudflare Pages에 연결합니다.

정적 사이트이므로 저장소 루트의 HTML/CSS/JS가 배포되어야 합니다.

배포 후 Pages URL이 기존과 달라졌다면 Worker의:

```toml
FRONTEND_ORIGIN = "https://새-pages-url.pages.dev"
```

를 수정하고 Worker를 다시 배포합니다.

동시에 `js/config.js`의 Worker API 주소도 올바른지 확인합니다.

---

## 12. GitHub Actions 백업 Secret 재구축

GitHub repository:

`Settings → Secrets and variables → Actions`

아래 5개 Repository Secret이 필요합니다.

```text
CLOUDFLARE_ACCOUNT_ID
CLOUDFLARE_API_TOKEN
R2_ACCESS_KEY_ID
R2_SECRET_ACCESS_KEY
RCLONE_CONFIG_B64
```

### CLOUDFLARE_API_TOKEN

백업용 전용 토큰을 새로 만들 수 있습니다.

필요 권한:

```text
Account → D1 → Edit
User → Memberships → Read
```

토큰 값만 GitHub Secret에 넣습니다.

- `Bearer ` 접두어 금지
- 따옴표 금지
- 줄바꿈 금지

### R2 credentials

R2용 Account API Token에서 다음 자격증명을 새로 만들 수 있습니다.

```text
R2_ACCESS_KEY_ID
R2_SECRET_ACCESS_KEY
```

권장:

- Object Read only
- `the-years-media` 버킷만

백업은 R2에서 Google Drive로 읽어오기만 하므로 Read only로 충분합니다.

### RCLONE_CONFIG_B64

Google Drive rclone 설정 파일을 Base64로 변환한 값입니다.

Windows 예시:

```powershell
[Convert]::ToBase64String([IO.File]::ReadAllBytes("C:\Users\USERNAME\AppData\Roaming\rclone\rclone.conf"))
```

출력된 한 줄 전체를 `RCLONE_CONFIG_B64` Secret에 넣습니다.

rclone remote 이름은 반드시:

```text
gdrive
```

이어야 현재 workflow와 맞습니다.

---

## 13. Google OAuth / rclone 재구성

Google Drive 연결이 끊겼다면 Google Cloud에서 별도 프로젝트를 만들고 다시 연결합니다.

현재 사용한 프로젝트 개념:

```text
THE YEARS Backup
```

필요 작업:

1. Google Drive API 활성화
2. Google Auth Platform 구성
3. OAuth 사용자 유형: External
4. 테스트 상태라면 본인 Google 계정을 Test user로 추가
5. OAuth Client type: Desktop app
6. rclone에 Client ID / Client Secret 입력
7. remote 이름을 `gdrive`로 생성
8. 생성된 `rclone.conf`를 다시 Base64로 변환
9. GitHub `RCLONE_CONFIG_B64` 갱신

OAuth Client Secret은 절대 GitHub public repository에 적지 않습니다.

---

## 14. 백업 workflow 복구 후 테스트

GitHub:

```text
Actions → Monthly THE YEARS Backup → Run workflow
```

정상 성공 시 확인할 단계:

```text
Checkout repository              Success
Install Wrangler                 Success
Install rclone                   Success
Restore Google Drive connection Success
Export D1 database              Success
Connect to R2                   Success
Backup photos from R2           Success
Upload backup to Google Drive   Success
Keep temporary GitHub backup    Success
```

Google Drive에 새 월 폴더가 생성되고:

```text
database/the-years-db.sql
photos/... (사진이 존재할 경우)
```

가 있으면 정상입니다.

---

# 복원 완료 체크리스트

## 15. 사이트 기능 확인

복원 후 아래를 하나씩 확인합니다.

- HOME 접속 정상
- DIARY / TRAVEL / CAR / STUDY 정상
- PRIVATE 비밀번호 잠금 정상
- ADMIN 로그인 정상
- 기존 글 목록 정상
- 기존 사진 정상
- 새 글 작성 정상
- 공개/비공개 정상
- 글 수정 정상
- 삭제 시 휴지통 이동 정상
- 휴지통 복원 정상
- 휴지통 7일 자동삭제 cron 정상
- 모바일/PWA 접속 정상

---

# 절대 GitHub에 저장하면 안 되는 값

## 16. Secret 목록

아래 실제 값은 이 Public Repository에 commit하지 않습니다.

```text
ADMIN_PASSWORD
SESSION_SECRET
PRIVATE_VIEW_PASSWORD
CLOUDFLARE_API_TOKEN
R2_ACCESS_KEY_ID
R2_SECRET_ACCESS_KEY
RCLONE_CONFIG_B64
Google OAuth Client Secret
rclone.conf 원문
```

실수로 공개 저장소나 채팅/스크린샷에 노출한 Secret은 **즉시 폐기/재발급**합니다.

---

# 가장 중요한 복구 요약

Cloudflare 전체를 잃어도 아래 순서로 돌아옵니다.

```text
GitHub 코드 확보
↓
새 D1 생성
↓
Google Drive의 the-years-db.sql 복원
↓
새 R2 생성
↓
Google Drive photos를 같은 object key로 복원
↓
wrangler.toml의 새 D1 ID 확인
↓
Worker 배포
↓
Worker Secrets 재등록
↓
Cloudflare Pages 재연결
↓
js/config.js의 API URL 확인
↓
GitHub Actions Secrets 재등록
↓
월간 백업 수동 테스트
↓
THE YEARS 복구 완료
```

---

## 유지관리 원칙

- 사이트 소스 변경은 GitHub가 기준입니다.
- 글/사진 원본은 Cloudflare D1 + R2가 운영 데이터입니다.
- Google Drive 월간 백업은 재해복구용 복사본입니다.
- 큰 구조 변경이 생기면 이 `RESTORE-GUIDE.md`도 같이 업데이트합니다.
- 새로운 Secret 값 자체는 절대 이 문서에 적지 않습니다.

**Last documented:** 2026-10-21
