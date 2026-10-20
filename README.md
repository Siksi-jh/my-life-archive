# my-life-archive 시작 파일

## 업로드
1. ZIP 압축 해제
2. GitHub 저장소에서 Add file → Upload files
3. 압축 푼 폴더 안의 파일/폴더 전체를 업로드
4. Commit changes

중요: ZIP 자체가 아니라 안의 내용물을 저장소 최상단에 올리세요.

## 구조
- index.html: 홈
- diary/: 2026~2089 연도별 일기
- travel/: 여행
- photos/: 사진
- car/: 자동차
- study/: 공부
- archive/: 자료보관
- css/, js/, assets/: 디자인/기능/이미지

## 일기 쓰기
`diary/2026/2026-10-20.html`을 복사해 새 날짜 파일로 만들고,
`diary/2026/index.html`에 새 글 링크를 추가하면 됩니다.

## 백업
- GitHub: 수시
- Google Drive: 월 1회 ZIP
- 외장 SSD/HDD: 3~6개월
- 연말: 연도별 최종본

## 제목/문구 직접 바꾸는 방법
`js/config.js` 파일만 수정하면 됩니다.

```js
window.SITE_CONFIG = {
  title: "PARK ARCHIVE",
  subtitle: "기록은 쌓이고, 시간은 남는다.",
  startText: "2026 — ongoing"
};
```

- title: 홈페이지 큰 제목
- subtitle: 제목 아래 설명
- startText: 시작 연도 문구

GitHub에서 `js/config.js`를 열고 연필(Edit) 버튼으로 수정한 뒤 Commit changes 하면,
Cloudflare Pages가 자동 재배포합니다.
