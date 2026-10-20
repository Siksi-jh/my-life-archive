# THE YEARS v3

추가 기능
- 관리자 글 수정
- 관리자 글 삭제
- 기존 사진 개별 삭제
- 수정 시 새 사진 추가
- iPhone PWA 홈 화면 앱
- PWA 아이콘 및 오프라인 캐시

## 적용
기존 GitHub `my-life-archive` 저장소에 ZIP의 내용을 전체 덮어쓰고 Commit changes 합니다.
Pages와 `the-years-api` Worker가 각각 자동 재배포됩니다.

## iPhone 설치
Safari에서 사이트 접속 → 공유 → `홈 화면에 추가` → `추가`.


## v4 UI change
- Removed public BACKUP information
- Removed decorative VISIT counter from the home sidebar
- Replaced ABOUT/BACKUP/VISIT with a minimal personal archive profile card
- More Notion/blog-like, quieter sidebar


## 중요: 연결값 유지
이 패키지는 현재 연결값을 이미 포함합니다.
- API: https://the-years-api.jh44022.workers.dev
- D1 database_id: 42897cf8-9174-4310-a098-e85a068da7da
- R2 bucket: the-years-media

따라서 전체 덮어쓰기 후에도 관리자 연결이 끊기지 않습니다.
