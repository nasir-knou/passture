# Architecture

기술 스택, 디렉토리 구조, 데이터 빌드·배포 파이프라인.

## 1. 기술 스택

- 형태: 서버 API 없는 정적 SPA. 문제 데이터는 YAML 원본을 빌드한 정적 JSON, 사용자 상태는 `localStorage`, 현재 풀이 세션/선택 옵션은 `sessionStorage`
- 프론트엔드: Vite + TypeScript, pnpm + Node 22 LTS(`.nvmrc`), 단일 `src/styles.css`
- 라우팅: 자체 해시 라우터(`window.location.hash` listener). 정적 호스팅에서 새로고침/딥링크 안전
- 코드 스타일: Prettier만 사용(`pnpm format`, `pnpm format:check`)
- 리치 텍스트: 문제 본문·선택지·텍스트 지문·해설에 KaTeX 수식, `` `…` `` 인라인 코드, `==강조==` (`src/pages/rendering.ts`; 수식·인라인 코드 구간 분리는 빌드 검증과 공유하는 `src/lib/math-tokens.ts`)
- 지문: `code`는 `<pre><code>`, `diagram`은 SVG/HTML, 재현이 어려운 도표만 crop `image`
- 빌드 도구: `js-yaml`(파싱), `tsx`(스크립트 실행), 직접 작성한 TS 검증기, `vitest`(데이터 빌드·라우터·채점·세션·챕터·렌더링·학기·저장소·백업 단위 테스트)

## 2. 디렉토리 구조

```text
/
  index.html, vite.config.ts, tsconfig.json, package.json, .nvmrc, .prettierrc
  src/
    main.ts, app.ts, router.ts, styles.css
    pages/
      home.ts, select.ts, quiz.ts, result.ts, history.ts, backup.ts
      select-chapters.ts                # 선택 화면의 챕터별 모드 패널
      mock-exam.ts, mock-exam-test.ts, mock-exam-result.ts
      rendering.ts                      # 리치 텍스트, 지문, 이미지, diagram, 해설 렌더링
      shared.ts                         # 상단바, 푸터, 학기 라벨·기본 학기, 출처 분류 라벨
    lib/
      data-loader.ts
      chapter.ts                        # 출처 분류, ID 그룹 파싱, 문제 → 교재 장 결정
      chapter-practice.ts               # 챕터 인덱스, 챕터별 세션 입력, 챕터 선택 저장
      quiz-session.ts, mock-exam-session.ts, shuffle.ts, scorer.ts, storage.ts, backup.ts
      math-tokens.ts                    # 수식·인라인 코드 구간 분리 (렌더러와 빌드 검증 공유)
      explanation.ts                    # 해설 `선택지 N:`·핵심 개념·`※` 줄 파싱 (렌더러와 빌드 검증 공유)
    types/                              # question, catalog, syllabus, user-data, katex.d.ts
  data/                                 # YAML 원본 (commit)
    catalog.yaml
    subjects/{subjectId}/
      {sourceId}.yaml                   # past-exams-2019, workbook, lecture-exercises 등
      syllabus.yaml                     # 교재 장·강의 목록 (챕터별 풀이 과목만)
  public/                               # Vite가 dist 루트로 복사
    CNAME                               # passture.logonme.click
    images/subjects/                    # 문제·선택지·지문 crop 이미지 (commit)
    data/                               # 빌드 산출물 (gitignore)
  scripts/
    build-data.ts
    crop-png.mjs                        # pnpm image:crop
  tests/                                # vitest
  .github/workflows/
    deploy.yml, validate.yml
```

`catalog.yaml`이 과목·출처 목록과 과목별 학기를 담으며(현황: [source-coverage.md](./source-coverage.md)), 새 과목은 앱 코드 수정 없이 `catalog.yaml`과 문제 YAML만 추가하면 UI에 반영된다. 프로덕션 브라우저는 `/data/...` JSON만 fetch한다. 개발 서버(`import.meta.env.DEV`)에서는 `data-loader.ts`의 `loadCatalog`·`loadQuestionFile`·`loadSyllabus`가 처음부터 원본 YAML(`data/catalog.yaml`, 문제 파일, syllabus)을 직접 읽고 JSON은 쓰지 않는다. 그래서 dev catalog에는 `questionCount`가 없고, 선택·모의 시험 화면은 출처마다 문제 파일을 불러와 `(N문제)`를 나중에 채운다. `predev`는 서버 시작 전에 한 번만 검증하므로 `pnpm dev` 실행 중 고친 데이터는 검증 없이 화면에 반영된다. 데이터를 고친 뒤에는 `pnpm data:build`를 다시 돌려 검증한다. 챕터 계산처럼 런타임에 필요한 값은 빌드 산출물에 의존하지 않고 브라우저에서 계산한다.

해시 라우트: `#/`, `#/select`, `#/mock-exam`, `#/mock-exam/test`, `#/mock-exam/result`, `#/quiz`, `#/result`, `#/history`, `#/backup`. 과거 `#/bookmarks`는 `#/history`로 이동시킨다.

## 3. 데이터 빌드 파이프라인

`scripts/build-data.ts`(`pnpm data:build`, `predev`/`prebuild` 훅에서 자동 실행)는 `data/catalog.yaml`과 catalog가 가리키는 문제·syllabus YAML만 읽고(catalog에 없는 YAML은 무시), 검증 후 `public/data/subjects/{subject}/{source}.json`, `syllabus.json`, 출처별 `questionCount`를 채운 `public/data/catalog.json`을 낸다. 하나라도 실패하면 빌드가 멈춘다. 검증 로직은 `tests/build-data.test.ts`가 테스트한다. 세부 규칙은 [data-schema.md](./data-schema.md).

빌드 실패 조건:

- catalog: `version`이 숫자가 아님, `subject.id`·`source.id` 중복, `semester`가 `1`/`2`가 아님, `kind`가 `exam`/`textbook`/`workbook`/`lecture`/`intensive`가 아님, `source.path`·`syllabus` 경로가 `.json`으로 끝나지 않음
- 문제 파일: `subjectId`/`sourceId`/`kind`/`year`가 catalog와 다름, `title`이 없음, 문항·선택지에 모르는 키(예: `passageRefs`를 `passages`로 씀, 따옴표 없는 flow 값이 쉼표에서 잘림), 필수 문자열이 빔(빈 문자열은 이미지·diagram 선택지의 `text`만 허용)
- 식별자: 파일 안 문제 `id`·`passages.id` 중복, 문항 안 `choices.id` 중복, 출처 종류별 ID 형식 위반(기출 `yy`는 출처 `year`와 일치), 지문 ID가 `g`로 시작하지 않음
- 참조: `passageRefs`가 없는 지문을 가리킴, `answers`가 비었거나 `choices.id`에 없는 항목, 해설의 `선택지 N:` 줄이 없는 `choices.id`를 가리킴
- 정답 수: `multiple-choice`는 정답 1개, `multi-answer`는 2개 이상, `ox`는 선택지 2개·정답 1개가 아님, `answers` 안 중복
- 이미지·diagram: `path` 파일이 저장소 루트나 `public/` 아래에 없음, `alt`가 빔, diagram 타입별 필수 필드·노드/간선 참조 오류
- 수식: 인라인 코드 밖 수식 구간이 KaTeX로 파싱되지 않음(해설은 줄 단위, `data-table`은 셀 단위)
- syllabus: `subjectId`가 catalog 과목 `id`와 다름, `title`이 없음, `no`가 양의 정수가 아니거나 중복, `chapters[].sections[].no`가 문자열이 아님(`'1.1'`처럼 따옴표), 빈 `chapters`, 없는 장 참조, 어느 부에도 속하지 않는 장([data-schema.md §4.4](./data-schema.md))
- 장 배정: `chapter`가 양의 정수가 아님, `outdated`가 `true` 외의 값, syllabus 과목에서 장이 정해지지 않거나 목차에 없음, `outdated`가 기출이 아닌 문제에 있거나 [outdated.md](./outdated.md)와 불일치, `chapter`와 `outdated`를 함께 씀, syllabus 없는 과목에서 둘 중 하나를 씀
- `passages`는 참조 여부와 상관없이 모두 검사한다(ID 접두, `type`, 수식, 이미지, diagram). 각 지문을 어떤 문제가 참조하는지는 검사하지 않는다.

## 4. GitHub Actions

- `deploy.yml` (push to main): Node 22 + pnpm 설정 → `pnpm install --frozen-lockfile` → `pnpm format:check` → `pnpm test` → `pnpm build`(`prebuild`가 데이터 빌드, `public/data/`가 dist로 복사) → `actions/deploy-pages`로 배포
- `validate.yml` (push to main, PR): `pnpm install --frozen-lockfile` → `pnpm format:check` → `pnpm exec tsc --noEmit` → `pnpm data:build` → `pnpm test`. 하나라도 실패하면 check가 실패한다.

## 5. 베이스 경로와 도메인

- 커스텀 도메인 `passture.logonme.click`, `vite.config.ts`의 `base = "/"`. `public/CNAME`(도메인 한 줄)이 dist 루트로 복사되어 GitHub Pages가 도메인을 인식한다.
- fetch는 `import.meta.env.BASE_URL` 기준, 라우터는 해시, 이미지는 `images/...` 상대 경로라서 도메인/서브패스가 바뀌어도 코드 수정이 필요 없다.
- DNS: 등록업체에서 `passture` 호스트 → `nasir-knou.github.io.` CNAME. `nasir-knou` 계정 Pages → Verified domains에서 `logonme.click` TXT verify(도메인 takeover 방지).
- Repo Settings → Pages: Source `GitHub Actions`, Custom domain `passture.logonme.click`, Enforce HTTPS.
