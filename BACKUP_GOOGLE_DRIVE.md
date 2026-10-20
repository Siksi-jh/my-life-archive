# Google Drive 월간 자동 백업 설정

현재 저장 위치:
- 글/날짜/카테고리/공개설정: Cloudflare D1
- 사진: Cloudflare R2
- 사이트 코드: GitHub

이 프로젝트에는 `.github/workflows/monthly-backup.yml`이 포함되어 있습니다.
한 번만 인증을 설정하면 매월 Google Drive의 `THE YEARS BACKUP/YYYY-MM` 폴더에 D1 + R2 사진을 자동 복사합니다.

## GitHub Secrets에 필요한 값
Repository → Settings → Secrets and variables → Actions → New repository secret

1. `CLOUDFLARE_ACCOUNT_ID`
   - Cloudflare Account ID

2. `CLOUDFLARE_API_TOKEN`
   - Cloudflare에서 백업 전용 API Token 생성
   - D1 읽기/Export에 필요한 최소 권한만 부여

3. `R2_ACCESS_KEY_ID`
4. `R2_SECRET_ACCESS_KEY`
   - R2 → Manage R2 API Tokens에서 읽기 전용 토큰 생성 권장

5. `RCLONE_CONFIG_B64`
   - PC에서 rclone으로 Google Drive(gdrive) 연결 후 rclone.conf를 base64로 인코딩한 값
   - 이 값에는 Google Drive 인증 토큰이 들어 있으므로 절대 공개 저장소 파일에 직접 넣지 말고 GitHub Secret에만 넣습니다.

## rclone Google Drive 최초 연결
PC에 rclone 설치 후:
`rclone config`

- n: New remote
- name: `gdrive`
- storage: Google Drive
- 브라우저 로그인으로 본인 Google 계정 연결

완료 후:
`rclone config file`
명령으로 config 파일 위치를 확인합니다.

Windows PowerShell에서 base64 만들기 예:
`[Convert]::ToBase64String([IO.File]::ReadAllBytes("$env:APPDATA\\rclone\\rclone.conf"))`

출력 전체를 GitHub Secret `RCLONE_CONFIG_B64`에 저장합니다.

## 자동 실행
GitHub Actions는 UTC cron을 사용합니다.
현재 설정은 한국시간 기준 매월 2일 새벽 3시 15분 전후입니다.
Actions 탭에서 `Monthly THE YEARS Backup` → `Run workflow`로 수동 테스트도 가능합니다.
