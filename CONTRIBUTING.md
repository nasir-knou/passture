# 문제 데이터 기여 가이드

PASSture에 새 과목이나 문제 세트를 추가하는 방법입니다. 필드·식별자·장 배정 규칙의 기준은 [docs/data-schema.md](docs/data-schema.md), 빌드 실패 조건은 [docs/architecture.md §3](docs/architecture.md)입니다.

## 목차

1. [처음 기여할 때: 절차](#1-처음-기여할-때-절차)
2. [새 과목 추가](#2-새-과목-추가)
3. [새 출처 추가](#3-새-출처-추가)
4. [문제 작성](#4-문제-작성)
5. [지문 작성](#5-지문-작성)
6. [다이어그램 예시](#6-다이어그램-예시)
7. [이미지](#7-이미지)
8. [빌드와 체크리스트](#8-빌드와-체크리스트)
9. [자주 막히는 지점](#9-자주-막히는-지점)

## 1. 처음 기여할 때: 절차

저장소를 처음 받은 사람이 문제 세트 하나를 추가해 PR을 내기까지의 순서다. 각 단계의 세부 규칙은 §2 이후와 [docs/data-schema.md](docs/data-schema.md)에 있다.

### 1-1. 시작 전 확인

- **원본 자료**: 기출·강의·교재·워크북 중 무엇인지, 인쇄 정답(정답표·LMS 정답 표시)이 있는지 확인한다. 정답이 없는 자료는 입력하지 않는다.
- **권리**: 원본 PDF·스캔·캡처는 저장소에 올리지 않는다. 로컬 `origin/` 아래에 두면 gitignore로 제외된다.
- **이미 있는지**: [docs/source-coverage.md](docs/source-coverage.md)에서 과목·출처 현황을 본다. `입력 완료`인 출처는 다시 입력하지 않는다. 컴퓨터구조는 기출만 유지하는 과목이라 추가 자료를 받지 않는다.

### 1-2. 환경 준비

```bash
# Node 22 (.nvmrc), pnpm
pnpm install
pnpm data:build   # YAML → public/data JSON, 검증 포함
pnpm dev          # http://localhost:5173
```

`pnpm dev`는 catalog·문제·syllabus를 원본 YAML에서 **검증 없이** 직접 읽는다. 데이터를 고칠 때마다 `pnpm data:build`를 따로 돌려 오류를 확인한다.

### 1-3. 어디에 무엇을 두는가

| 경로                                 | 역할                                                  |
| ------------------------------------ | ----------------------------------------------------- |
| `data/catalog.yaml`                  | 과목·출처 목록. 여기에 없는 파일은 앱에 나오지 않는다 |
| `data/subjects/{과목}/{출처}.yaml`   | 문제·지문 원본 (직접 작성)                            |
| `data/subjects/{과목}/syllabus.yaml` | 교재 목차와 강→장 대응 (챕터별 풀이 과목만)           |
| `public/images/subjects/{과목}/…`    | 문제에 쓰는 crop 이미지                               |
| `public/data/**.json`                | 빌드 산출물. 직접 편집하지 않는다                     |
| `origin/`                            | 원본 자료(비공개, gitignore)                          |

### 1-4. 기여 유형별 순서

**A. 기존 과목에 출처 추가** (가장 흔한 경우)

1. `data/catalog.yaml`의 해당 과목 `sources`에 항목을 추가한다 (§3).
2. `data/subjects/{과목}/{출처}.yaml`을 만들고 헤더(`subjectId`·`sourceId`·`kind`·`year`)를 catalog와 맞춘다 (§4).
3. 문제를 입력한다. 원본 그대로 옮기고, 정답은 인쇄 정답을 따르며, 해설은 선택지별 이유 + `핵심 개념`으로 쓴다 (§4-1).
4. 공유 지문·코드·표·그림은 `passages`로 분리한다 (§5, §6). 이미지는 마지막 수단이다 (§7).
5. 과목에 `syllabus`가 있으면 장 배정을 한다 (§4-3). 빌드가 장이 없는 문제를 거부한다.
6. 검증하고 문서를 갱신한 뒤 제출한다 (1-5, 1-6).

**B. 새 과목 추가**

1. `data/subjects/{과목-id}/` 디렉토리와 catalog 과목 항목을 만든다 (§2).
2. 챕터별 풀이를 지원하려면 `syllabus.yaml`을 만들고 catalog에 `syllabus:`를 적는다 (§4-3). 교재 목차가 없거나 목차 없이 시작하면 `syllabus`를 생략한다. 이때는 문제에 `chapter`를 적을 수 없다.
3. 2학기 과목이면 [docs/source-coverage.md](docs/source-coverage.md)에 행을 추가한다.
4. 이후는 A와 같다.

**C. 챕터별 풀이 과목에 추가할 때 주의**

- 기출은 문제마다 `chapter: N`을 적는다. 현재 교재에 없는 주제는 `outdated: true`로 두고 [docs/outdated.md](docs/outdated.md)에 키와 근거를 적는다(빌드가 둘을 대조한다).
- 워크북·기본서는 ID의 장 번호, 강의는 강 번호 → `syllabus.lectures`로 장이 정해진다. ID 번호가 장이 아닌 출처(예: C프로그래밍 워크북의 10문제 단위 순번)는 문제마다 `chapter`를 적는다.

### 1-5. 검증

```bash
pnpm data:build    # 스키마·ID·정답·수식·이미지·장 배정 검증. 실패하면 메시지의 파일·필드를 고친다
pnpm test
pnpm format:check  # 실패하면 pnpm format
```

빌드가 통과한 뒤 [docs/review-checklist.md](docs/review-checklist.md)로 원본 대조를 한다. 최소한 문항 수, 정답 전부, 이미지·표가 든 문항 몇 개를 화면에서 확인한다. 오류 메시지별 원인은 §9.

### 1-6. 문서 갱신과 제출

- `docs/source-coverage.md`의 해당 칸을 `입력 완료 (…문제)`로 바꾼다. outdated가 있으면 `docs/outdated.md`에 추가한다. `WORK.md` 진행 기록에 한 줄을 남긴다.
- 브랜치는 `feat/{과목-또는-출처}`, 커밋은 출처 하나를 한 단위로 한다. 스테이징은 파일을 이름으로 지정한다(`git add -A`를 쓰지 않는다). `origin/`·`.omc/`·`public/data/`는 올리지 않는다.
- PR 본문에 출처·문제 수·정답 대조 결과(불일치 건수와 처리)를 적는다. CI는 `format:check`·`tsc`·`data:build`·`test`를 돌린다.

### 1-7. 데이터 흐름

```text
data/catalog.yaml                  ← 과목·출처 목록
data/subjects/{과목}/{출처}.yaml   ← 문제 원본
data/subjects/{과목}/syllabus.yaml ← 교재 목차 (챕터별 풀이 과목만)
       ↓  pnpm data:build (dev·build 전 자동 실행)
public/data/**.json                ← 직접 편집하지 않음
```

## 2. 새 과목 추가

`data/subjects/{과목-id}/`를 만들고(영어 소문자·하이픈, 예: `data-structures`) `data/catalog.yaml`의 `subjects`에 등록한다.

```yaml
- id: data-structures # 디렉토리 이름과 같게, 저장소 전체에서 유일
  title: 자료구조 # 화면 표시 이름
  semester: 2 # 필수, 1 또는 2
  sources:
    - id: past-exams-2019
      title: 2019 기말
      path: subjects/data-structures/past-exams-2019.json
      kind: exam
      year: 2019
```

2학기 과목이면 [docs/source-coverage.md](docs/source-coverage.md)에 행을 추가한다.

## 3. 새 출처 추가

과목의 `sources`에 항목을 추가한다. `id`는 과목 안에서 유일, `path`는 `.json`으로 끝나고(빌드가 같은 경로의 `.yaml`을 읽음), `year`는 `exam`만 적는다. `kind`별 분류와 출처명은 [data-schema.md §2](docs/data-schema.md)를 따른다.

```yaml
- id: workbook
  title: 워크북 문제
  path: subjects/algorithms/workbook.json
  kind: workbook
```

## 4. 문제 작성

파일 `data/subjects/{과목}/{출처}.yaml`. 헤더의 `subjectId`/`sourceId`/`kind`/`year`는 catalog와 같아야 한다. ID 형식은 [data-schema.md §4](docs/data-schema.md)(기출 `e19-01`, 기본서 `t03-07`, 워크북 `b03-07`, 강의 `l07-08`, 특강 `i02-03`).

```yaml
subjectId: algorithms
sourceId: past-exams-2020
title: 알고리즘 2020 기말
kind: exam
year: 2020

questions:
  - id: e20-01
    type: multiple-choice
    prompt: 다음 중 분할 정복 알고리즘에 해당하지 않는 것은?
    choices:
      - { id: '1', text: '퀵 정렬' }
      - { id: '2', text: '병합 정렬' }
      - { id: '3', text: '버블 정렬' }
      - { id: '4', text: '이진 탐색' }
    answers: ['3']
    explanation: |
      선택지 1: 퀵 정렬은 피벗 기준으로 분할 후 재귀 정렬하므로 분할 정복이다.
      선택지 2: 병합 정렬은 반씩 나눠 정렬 후 병합하므로 분할 정복이다.
      선택지 3: 버블 정렬은 인접 원소를 반복 비교·교환하는 방식으로 분할 정복이 아니다.
      선택지 4: 이진 탐색은 범위를 절반씩 줄여 탐색하므로 분할 정복 기법이다.

      핵심 개념:
      분할 정복은 문제를 작은 부분으로 나누고(분할), 각각 재귀 해결 후(정복) 결합하는 패러다임이다.

  - id: e20-02
    type: ox
    prompt: 퀵 정렬의 최악 시간 복잡도는 $O(n \log n)$이다.
    choices:
      - { id: 'O', text: 'O' }
      - { id: 'X', text: 'X' }
    answers: ['X']
    explanation: 최악의 경우(피벗이 항상 최솟값·최댓값) $O(n^2)$이다.

  - id: e20-03
    type: multi-answer
    prompt: 다음 중 안정 정렬을 모두 고르시오.
    choices:
      - { id: '1', text: '버블 정렬' }
      - { id: '2', text: '선택 정렬' }
      - { id: '3', text: '삽입 정렬' }
    answers: ['1', '3']
    answerKey: B # 원본 알파벳 표기 보존 (대응표: data-schema §6)
    explanation: ...
```

### 4-1. 정답과 해설

- `answers` 작성과 정답표 대조 규칙은 [data-schema.md §6](docs/data-schema.md).
- 해설은 선택지별 이유 + `핵심 개념` 요약 구조로 쓰고, 약어는 첫 언급에 풀폼을 붙인다([data-schema.md §7](docs/data-schema.md)).
- 원본은 고치지 않는다. 원본 표기 오류나 인쇄 정답 논란은 해설에 `※` 줄로 적고, 해설에서 선택지는 번호가 아니라 내용으로 지칭한다([data-schema.md §7](docs/data-schema.md)).

### 4-2. 리치 텍스트

수식 `$…$`, 강조 `==…==`, 인라인 코드, 글자 그대로의 `\$`, 여러 줄 선택지, 쉼표가 든 flow 값 따옴표 규칙은 [data-schema.md §4.2](docs/data-schema.md)를 따른다.

### 4-3. 교재 장 배정 (챕터별 풀이)

catalog에 `syllabus`가 있는 과목(대상: [docs/source-coverage.md](docs/source-coverage.md))은 모든 문제가 교재 장 하나에 배정되어야 한다. 규칙 전체는 [data-schema.md §4.4](docs/data-schema.md).

1. `syllabus.yaml`에 `chapters`와 `lectures`(강 → 장)를 적고 catalog 과목에 `syllabus: subjects/{과목}/syllabus.json`을 추가한다. 교재 장이 없는 강은 `lectures`에서 뺀다.
2. 기출은 `chapter: N`(주 장 하나, 절 단위 없음)을 적는다. 현재 교재에 없는 주제면 `outdated: true`를 적고 [docs/outdated.md](docs/outdated.md)에 키와 근거를 추가한다.
3. 기본서·워크북은 ID 그룹(`b03-07` → 3장), 강의는 강 번호와 `syllabus.lectures`로 장이 정해진다. ID 그룹이 장이 아닌 출처(C프로그래밍 워크북)나 다른 장으로 옮길 문제는 `chapter`를 적는다(ID보다 우선).

## 5. 지문 작성

공유되거나 코드·표·그림인 지문은 `passages`로 분리하고 `passageRefs`로 참조한다. ID는 `g` 접두. 타입과 규칙은 [data-schema.md §5](docs/data-schema.md).

```yaml
passages:
  - id: g20-text-01
    type: text
    body: |
      다음 재귀식을 보고 물음에 답하시오.
      $T(n) = 2T(n/2) + \Theta(n)$
  - id: g20-code-01
    type: code
    language: java # c, python, java, text 등
    highlights: ['return'] # 원본에서 굵게 표시된 문자열 (선택)
    body: |
      if (arr[mid] == target) return mid;
  - id: g20-img-01
    type: image
    image:
      path: images/subjects/algorithms/past-exams/2020/g20-graph.png
      alt: 2020년 알고리즘 기출 그래프 지문

questions:
  - id: e20-04
    passageRefs: [g20-code-01] # passages.id 배열
    prompt: 위 코드에 대한 설명으로 옳은 것은?
```

## 6. 다이어그램 예시

아래 각 항목은 `passages[].diagram` 또는 `choices[].diagram`의 값이다. 필드 목록은 [data-schema.md §5](docs/data-schema.md). SVG 라벨에는 수식 문자열을 넣지 않는다.

```yaml
# simple-graph: 일반 그래프·트리·오토마타·E-R
- type: simple-graph
  width: 400
  height: 260
  directed: true
  nodes:
    - { id: A, label: A, x: 200, y: 30 }
    - { id: B, label: B, x: 100, y: 120, shape: box }
  edges:
    - { from: A, to: B, label: '5' }
    - { from: B, to: B, curve: 1 } # 자기 루프

# resource-allocation-graph: 요청 간선 프로세스→자원, 할당 간선 자원→프로세스
- type: resource-allocation-graph
  width: 400
  height: 300
  nodes:
    - { id: p1, kind: process, label: p_1, x: 100, y: 150 }
    - { id: r1, kind: resource, label: r_1, x: 200, y: 80, units: 2 }
  edges:
    - { from: p1, to: r1 }
    - { from: r1, to: p1, style: dashed }

# memory-free-list
- type: memory-free-list
  width: 620
  height: 400
  blocks:
    - { id: os, kind: os, label: 운영체제 }
    - { id: free1, kind: free, label: 공백 1 (40MB), size: 40 }

# data-table: 빈 칸은 ' ', 백틱·$를 그대로 보이려면 cellFormat: code
- type: data-table
  columns: ['프로세스', '도착시간', '버스트시간']
  rows:
    - ['P1', '0', '6']
    - ['P2', ' ', '$O(n^2)$']

# clock-page-replacement
- type: clock-page-replacement
  width: 300
  height: 300
  pointerIndex: 1
  entries:
    - { page: A, referenceBit: 1 }
    - { page: B, referenceBit: 0 }

# ui-window: Java AWT/Swing 창
- type: ui-window
  width: 300
  height: 200
  title: MyFrame
  components:
    - { kind: checkbox, label: '항목 1', x: 30, y: 60, checked: true }
    - { kind: label, label: '라벨 텍스트', x: 30, y: 140 }
```

## 7. 이미지

diagram으로 재현하기 어렵거나 원본 시각 정보 자체가 문제 조건일 때만 crop 이미지를 쓴다. 규칙은 [data-schema.md §8](docs/data-schema.md).

```yaml
images:
  - path: images/subjects/algorithms/past-exams/2020/e20-05.png # public/ 기준
    alt: 2020년 알고리즘 기출 5번 그래프
```

- 경로: `public/images/subjects/{과목}/{past-exams/{year} | sourceId}/{문제 ID 포함 파일명}`
- 자르기: `pnpm image:crop <input> <output> <x> <y> <width> <height>`
- 이미지·diagram 선택지는 `text: ''`, `alt`에 정답 단서를 넣지 않는다([data-schema.md §4.3](docs/data-schema.md)).

## 8. 빌드와 체크리스트

```bash
pnpm data:build   # YAML → JSON 변환 및 검증
pnpm test         # 단위 테스트
pnpm format:check # Prettier 형식 검사 (CI와 같음)
pnpm dev          # 개발 서버 (catalog·문제·syllabus를 원본 YAML에서 검증 없이 직접 읽음)
pnpm build        # 프로덕션 빌드
```

오류가 나면 메시지의 파일과 필드를 고친 뒤 다시 빌드한다. `pnpm dev` 실행 중 고친 데이터는 검증되지 않으므로 `pnpm data:build`를 다시 돌린다. 새 출처를 입력한 뒤에는 [docs/review-checklist.md](docs/review-checklist.md) 기준으로 검증한다.

- [ ] catalog에 과목·출처를 등록했고 파일 헤더가 catalog와 일치한다
- [ ] 문제 ID가 출처 형식을 따르고 파일 안에서 유일하다
- [ ] `passageRefs`가 실제 `passages`를 가리킨다
- [ ] 해설이 선택지별 이유 + 핵심 개념 구조이고, 원본 문제는 `※` 줄로만 알린다
- [ ] 이미지 파일이 `public/images/` 아래 있고 `alt`가 있다
- [ ] (syllabus 과목) 모든 문제의 장이 정해지고, 기출은 `chapter` 또는 `outdated: true`이며 outdated는 `docs/outdated.md`에 기록했다
- [ ] (2학기 과목) `docs/source-coverage.md`를 갱신했다
- [ ] `pnpm data:build`, `pnpm test`, `pnpm format:check`가 통과한다

## 9. 자주 막히는 지점

빌드 오류 메시지와 원인. 메시지 앞의 `questionFile.questions[3]` 같은 경로가 문제 위치다.

| 메시지                                                                | 원인과 조치                                                                                                                    |
| --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `has unknown keys (…)`                                                | 문제·선택지에 허용되지 않는 키. 오타(`passages` → `passageRefs`)이거나 flow mapping의 쉼표가 든 값을 따옴표로 감싸지 않은 경우 |
| `must be a non-empty string`                                          | 빈 문자열. 표(`data-table`)의 빈 칸은 `' '`(공백 한 칸), 그래프 노드 `label`은 비울 수 없다(숨기려면 `hideLabel: true`)        |
| `.text must be non-empty when image or diagram is missing`            | 선택지 `text: ''`는 `image`나 `diagram`이 있을 때만 허용                                                                       |
| `.answers[…] does not match any choices.id`                           | 정답 id가 선택지 id와 다름. `'1'`처럼 문자열인지 확인                                                                          |
| `answers must have exactly 1 answer …` / `duplicates answer`          | 유형별 정답 수: `multiple-choice` 1개, `multi-answer` 2개 이상, `ox` 선택지 2개·정답 1개. 중복 금지                            |
| `.explanation references missing choice "…" in a 선택지 line`         | 해설의 `선택지 N:` 줄이 없는 선택지 id를 가리킴                                                                                |
| `has no chapter`                                                      | syllabus 과목인데 장이 정해지지 않음. 기출은 `chapter`/`outdated`, 강의는 강 번호가 `syllabus.lectures`에 있어야 함            |
| `uses chapter/outdated but the subject has no syllabus`               | catalog에 `syllabus:`가 없는 과목에는 `chapter`를 적을 수 없다                                                                 |
| `docs/outdated.md is missing … / lists questions not marked outdated` | `outdated: true` 문제와 `docs/outdated.md`의 키 목록이 다름. 양쪽을 맞춘다                                                     |
| `has invalid math`                                                    | `$…$` 안의 KaTeX 오류. 글자 그대로의 달러는 `\$`, 코드 지문·`cellFormat: code` 표에서는 `$`를 그대로 쓴다                      |
| `.path file does not exist`                                           | 이미지 경로는 `public/` 기준(`images/subjects/…`). 파일을 함께 커밋했는지 확인                                                 |
| `must end with .json`                                                 | catalog의 `path`·`syllabus`는 `.json`으로 적는다(빌드가 같은 경로의 `.yaml`을 읽는다)                                          |

빌드는 통과하지만 화면이 이상할 때:

- **백틱이 사라진다**: 백틱 쌍은 항상 인라인 코드로 렌더링된다. 백틱 문자 자체를 보여야 하면 코드 지문이나 `cellFormat: code` 표에 넣는다.
- **`==`가 강조로 바뀐다**: 한 문자열에 `==`가 두 번 이상 나오면 강조로 묶인다. 코드형 텍스트는 인라인 코드로 감싼다.
- **`sections.no`가 숫자로 읽힌다**: syllabus의 절 번호는 `'1.1'`처럼 따옴표를 붙인다.
- **문제가 혼자 풀리지 않는다**: 발문이 가리키는 그림·표·코드·조건이 모두 `passageRefs`로 연결되어야 한다. 선택지를 섞어도 성립하는지 본다.
- **폰에서 표가 잘린다**: 열이 많은 표는 행·열을 바꾸거나(영역을 행으로) 선택지마다 작은 표로 나눈다.
