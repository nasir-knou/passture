# 방통대 기말고사 대비 사이트 작업문서

## 서비스명

**passture** — pasture(목초지) + pass(합격)의 합성. "양치기" 학습법에서 컨셉을 가져왔다.

> 양치기: 공부 없이 문제풀이 반복만으로 시험을 대비하는 한국식 학습 속어. 양떼를 몰듯 문제를 갈아넣는다는 어감.

passture는 그 양떼가 풀을 뜯는 목초지를 뜻한다. 사용자가 문제를 떼로 몰아 풀고, 그 과정에서 합격(pass)에 도달하는 공간이라는 의미.

## 1. 목표

방통대 기말고사 대비 문제풀이 사이트를 GitHub Pages 기반 정적 사이트로 제작한다.

- 서버·DB 없이 정적 파일만으로 운영 (운영비 0)
- 과목별·출처별 문제 선택, 문제·선택지 순서 셔플로 익숙함 제거
- 오답·즐겨찾기 북마크와 재학습
- 새 과목/출처를 코드 수정 없이 추가할 수 있는 확장 구조
- 사람이 작성하기 쉬운 데이터 포맷 + 빌드 시 검증·최적화

## 2. 결정 사항 요약

- 프론트엔드: **Vite + TypeScript** SPA, 자체 미니 **해시 라우터**(`#/select`, `#/quiz/...`)
- 패키지 매니저/런타임: **pnpm** + **Node 22 LTS** (`.nvmrc`)
- 코드 스타일: **Prettier만** (eslint 보류)
- 테스트: **vitest** — 빌드 스크립트 검증 로직 단위 테스트 우선, UI 테스트는 보류
- 데이터: **YAML 저작 → JSON 빌드** (런타임은 JSON만 fetch)
- 데이터 산출 경로: **`public/data/`** 직접 출력 + gitignore (Vite가 dist로 자동 복사)
- 카탈로그: `catalog.yaml`(빌드 후 `catalog.json`)에서 과목/출처 관리
- 문제 파일: 출처별 단일 YAML/JSON
- 공통 지문: `passages` 분리 + `passageRefs` 배열 참조
- 정답: 단일/복수/OX 모두 `answers` 배열로 통일
- 식별자 컨벤션
  - 기출: `e{yy}-{nn}` (예: `e19-01`)
  - 교재: `b{chapter}-{nn}` (예: `b03-07`)
  - 강의: `l{lecture}-{nn}` (예: `l07-08`)
  - 공통지문: `g` 접두 (예: `g19-code-01`)
- 사용자 데이터: `localStorage`(`pt.` 키 prefix)
- 백업/복원: JSON 파일 내보내기·가져오기 (병합/덮어쓰기)
- 문제 선택 UI: 과목별 출처 체크리스트
- 데이터 무결성 검증은 빌드 단계 강제, GitHub Actions로 PR마다 실행
- 배포: GitHub Pages, **커스텀 도메인 `passture.logonme.click`**, `vite.config.ts`의 `base = "/"`
- 계정/레포: 신규 계정 **`nasir-knou`** + 레포 `nasir-knou/passture` (이메일·gh 인증·SSH 키 분리)
- DNS: 도메인 등록업체에서 `passture` 호스트 → `nasir-knou.github.io.` CNAME, `nasir-knou` 계정에서 `logonme.click` TXT verify
- 라이선스: 코드 **MIT**. 데이터(기출/교재 인용)는 README·푸터에 비영리 학습 목적 + 권리자 요청 시 삭제 표기

## 3. 문서 인덱스


| 문서                                           | 내용                                           |
| -------------------------------------------- | -------------------------------------------- |
| [docs/architecture.md](docs/architecture.md) | 기술 스택, 디렉토리 구조, 빌드/배포 파이프라인                  |
| [docs/data-schema.md](docs/data-schema.md)   | YAML 스키마, catalog, 문제 파일, 식별자, 공통지문, 정답, 이미지 |
| [docs/ux.md](docs/ux.md)                     | 주요 화면, 랜덤화 정책, localStorage, 백업/복원           |
| [docs/roadmap.md](docs/roadmap.md)           | 구현 단계, 검증 항목, 우선순위                           |


## 4. 미결정 / 추후 논의

1. 문제 입력 보조 도구를 별도 페이지로 만들지(브라우저 내 YAML 폼 → 다운로드) — 3차 개선 후보
2. 시간제한 모드(타이머) 도입 시점 — 2차 이후
3. 학습 통계 깊이 (태그별 정답률, 주차별 추세) — 3차 개선 후보
4. 다크 모드/접근성 우선순위 — M10 마무리에서 결정

## 5. 다음 액션

1. **M0 인프라**: `nasir-knou` 계정 생성, 이메일·gh·SSH 분리, 빈 레포 `nasir-knou/passture` 생성, DNS CNAME(`passture` → `nasir-knou.github.io.`) 등록, `logonme.click` 도메인 verify
2. **M1 스캐폴딩 + 첫 배포**: Vite+TS init(pnpm), `.nvmrc`(22), `.prettierrc`, `public/CNAME`, `vite.config.ts` `base="/"`, GHA `deploy.yml`(pnpm setup) → `https://passture.logonme.click/` hello world 노출
3. **M2 데이터 파이프라인**: `scripts/build-data.ts`(YAML → `public/data/` JSON + 검증), `predev`/`prebuild` 훅, vitest 단위 테스트, GHA `validate.yml`
4. 운영체제 2019 기출 1문항 + 공통지문 1개로 end-to-end 통과 확인 (M3~M4 진입 직전 체크포인트)

## 6. 마일스톤

| M  | 이름                | DoD (Definition of Done)                                                                              |
|----|---------------------|--------------------------------------------------------------------------------------------------------|
| M0 | 인프라 셋업         | nasir-knou 계정·이메일·gh·SSH 분리, `nasir-knou/passture` 레포, DNS CNAME, 도메인 verify              |
| M1 | 스캐폴딩 + 첫 배포  | Vite+TS+pnpm, `base="/"`, `public/CNAME`, GHA deploy, `https://passture.logonme.click/` hello world    |
| M2 | 데이터 파이프라인   | `scripts/build-data.ts`, `public/data/` 산출, vitest 1~2건, GHA PR 검증                                |
| M3 | 타입/로더/라우터    | `types/*`, `data-loader.ts`, 해시 라우터, 페이지 6개 골격                                              |
| M4 | 풀이 MVP            | 선택 → 풀이(셔플/채점) → 결과, 운영체제 2019 5문항 end-to-end                                          |
| M5 | 북마크/백업         | `pt.bookmarks` + JSON 내보내기/가져오기 (병합·덮어쓰기·검증)                                           |
| M6 | 콘텐츠 1차          | 운영체제 2019 기출 25문항 + 공통지문 + 이미지 1개 이상                                                 |
| M7 | 콘텐츠 확장         | 운영체제 2017/2018 기출, 워크북·강의 1세트씩, 카탈로그 자동 반영 검증                                  |
| M8 | 오답기록·필터       | `pt.wrongAnswers`, 오답만/북마크만 풀기, 연도·챕터 필터                                                |
| M9 | 다른 과목 확장      | 이산수학/알고리즘/Java 중 1과목 카탈로그 등록 (확장성 검증)                                            |
| M10| 마무리              | 모바일 반응형, 접근성, README/라이선스/저작권 표기                                                     |