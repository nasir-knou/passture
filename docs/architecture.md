# Architecture

방통대 기말고사 대비 사이트의 기술 스택, 디렉토리 구조, 빌드·배포 파이프라인.

## 1. 기술 스택

### 사이트 형태

- 배포: GitHub Pages (Actions로 자동 배포), 커스텀 도메인 `passture.logonme.click`
- 데이터 저장: 저장소 내 정적 JSON 파일 (YAML 원본을 빌드 시 변환)
- 사용자 개인 상태 저장: 브라우저 `localStorage`
- 현재 풀이 세션/선택 옵션 저장: 브라우저 `sessionStorage`
- 서버 API: 사용하지 않음

### 프론트엔드

**Vite + TypeScript SPA**.

- 패키지 매니저/런타임: pnpm + Node 22 LTS (`.nvmrc`)
- Vite: 빠른 개발 서버, 정적 빌드 산출물이 GitHub Pages와 호환
- TypeScript: 문제 데이터 타입 안정성, IDE 자동완성, 빌드 단계 정합성 검증
- 라우팅: 자체 미니 해시 라우터 (`window.location.hash` listener + 페이지 매핑). 정적 호스팅에서 새로고침/딥링크 안전
- 스타일: 단일 `src/styles.css`
- 코드 스타일: Prettier만 (eslint 보류)
- 마크다운/수식/코드: 아직 별도 렌더러 없음. 현재는 문제/해설 문자열을 HTML escape 후 표시한다.

### 빌드 도구 (문제 데이터)

- `js-yaml`: YAML 파싱
- `tsx`: 빌드 스크립트 실행
- 직접 작성한 TS 검증기: 스키마 검증
- `vitest`: 데이터 빌드, 라우터, 채점, 세션, 저장소, 백업 단위 테스트

## 2. 디렉토리 구조

```text
/
  index.html
  vite.config.ts
  tsconfig.json
  package.json
  pnpm-lock.yaml
  .nvmrc                                # Node 22
  .prettierrc
  src/
    main.ts
    app.ts
    router.ts
    styles.css
    pages/
      home.ts
      select.ts
      quiz.ts
      result.ts
      history.ts
      mock-exam.ts
      backup.ts
    lib/
      data-loader.ts
      quiz-session.ts
      shuffle.ts
      scorer.ts
      storage.ts
      backup.ts
    types/
      question.ts
      catalog.ts
      user-data.ts
  data/                                 # YAML 원본 (사람이 작성, commit)
    catalog.yaml
    subjects/
      operating-systems/
        past-exams-2017.yaml
        past-exams-2018.yaml
        past-exams-2019.yaml
        workbook.yaml
        lecture-exercises.yaml
      algorithms/
      artificial-intelligence/
      java-programming/
  public/                               # Vite가 dist 루트로 자동 복사
    CNAME                               # passture.logonme.click
    data/                               # 빌드 산출물 (gitignore)
      catalog.json
      subjects/
        operating-systems/
          past-exams-2017.json
          ...
  scripts/
    build-data.ts
    crop-png.mjs
  tests/                                # vitest
    build-data.test.ts
    backup.test.ts
    quiz-session.test.ts
    router.test.ts
    scorer.test.ts
    storage.test.ts
  .github/
    workflows/
      deploy.yml
      validate.yml
```

`catalog.yaml`이 사이트 전체의 과목·출처 목록을 담는다. 새 과목 추가 시 앱 코드를 건드리지 않고 `catalog.yaml`과 문제 YAML만 추가하면 UI에 반영된다. 빌드 시 `public/data/`로 JSON이 출력되고 Vite가 dist 루트로 그대로 복사하므로, 브라우저는 `/data/...` 경로로 JSON만 fetch 한다. 개발 서버에서 JSON 산출물이 없고 Vite HTML fallback을 받은 경우에만 원본 YAML을 직접 읽는 fallback이 있다.

현재 해시 라우트는 `#/`, `#/select`, `#/mock-exam`, `#/quiz`, `#/result`, `#/history`, `#/backup`이다. 과거 `#/bookmarks` 라우트는 호환용으로 남겨 두고 `#/history`로 이동시킨다.

## 3. 데이터 빌드 파이프라인

`scripts/build-data.ts`가 다음을 수행한다.

1. `data/**/*.yaml` 전부 파싱
2. 스키마 검증 (필수 필드, 타입, 식별자 형식)
3. 무결성 검증
   - 같은 파일 내 `id` 중복 없음
   - `passageRefs`가 실제 `passages`에 존재
   - `answers` 항목이 `choices.id` 안에 존재
   - `images.path` 파일이 저장소에 실제 존재
   - 출처 종류별 문제 ID 형식 검증 (`e{yy}-{nn}`, `b{chapter}-{nn}`, `l{lecture}-{nn}`)
4. `public/data/{subject}/{source}.json` 산출
5. `public/data/catalog.json` 산출
6. 실패 시 빌드 중단, GitHub Actions에서도 동일 실행

`public/data/`는 gitignore. `package.json`의 `predev`/`prebuild` 훅에서 `data:build`가 자동 실행되어 로컬 dev/CI 빌드 모두 항상 최신 JSON을 사용한다. 검증 로직은 `tests/build-data.test.ts`에서 vitest로 단위 테스트한다.

## 4. 로컬 개발

```bash
pnpm install
pnpm data:build           # YAML → JSON 변환 + 검증 (predev에서 자동 실행)
pnpm dev                  # Vite 개발 서버
pnpm test                 # vitest
pnpm format               # Prettier
```

## 5. GitHub Actions

### deploy.yml (push to main)

1. `actions/setup-node@v4` (Node 22) + `pnpm/action-setup@v4`
2. `pnpm install --frozen-lockfile`
3. `pnpm build` (`prebuild`가 `pnpm data:build`를 먼저 실행)
4. Vite 정적 빌드 (`public/data/`가 dist로 복사됨)
5. `actions/deploy-pages`로 GitHub Pages 배포 (`public/CNAME`이 도메인을 결정)

### validate.yml (PR)

1. `pnpm install --frozen-lockfile`
2. `pnpm data:build`로 데이터 무결성 검증
3. `pnpm test`로 빌드 스크립트 단위 테스트 실행
4. 이미지 경로 누락, ID 중복 등 발견 시 PR 차단

## 6. 베이스 경로와 도메인

- 커스텀 도메인 `passture.logonme.click` 사용으로 확정. `vite.config.ts`의 `base = "/"` (서브패스 없음).
- 라우터, 이미지 경로, fetch 경로는 모두 `import.meta.env.BASE_URL` 기준으로 해석하여, 추후 도메인/서브패스 전환 시에도 코드 수정이 필요 없도록 한다.
- `public/CNAME` 파일에 `passture.logonme.click` 한 줄. Vite가 dist 루트로 복사하면 GitHub Pages가 도메인을 인식한다.
- DNS: 도메인 등록업체에서 `passture` 호스트를 `nasir-knou.github.io.`로 가리키는 CNAME 레코드 추가. 추가로 `nasir-knou` 계정 settings → Pages → Verified domains에서 `logonme.click` TXT verify 권장 (도메인 takeover 방지).
- Repo Settings → Pages → Custom domain `passture.logonme.click` 입력 + Enforce HTTPS 체크.
