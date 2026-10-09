# Data Schema

문제 데이터의 포맷, 카탈로그, 식별자, 장 배정, 공통 지문·다이어그램, 정답, 해설, 이미지 규칙. 작성 절차와 예시는 [CONTRIBUTING.md](../CONTRIBUTING.md), 빌드 실패 조건 목록은 [architecture.md §3](./architecture.md).

## 1. 포맷 (YAML 저작 → JSON 런타임)

문제 원본은 손으로 쓰기 쉬운 YAML로 작성하고, 빌드가 브라우저용 JSON으로 변환한다. `public/data/`의 JSON은 직접 편집하지 않는다.

## 2. catalog.yaml

`data/catalog.yaml`이 과목·출처 목록이다. 등록 과목 현황은 [source-coverage.md](./source-coverage.md).

```yaml
version: 1
subjects:
  - id: linear-algebra
    title: 선형대수
    semester: 2
    syllabus: subjects/linear-algebra/syllabus.json # 챕터별 풀이 과목만
    sources:
      - id: past-exams-2019
        title: 2019 기말
        path: subjects/linear-algebra/past-exams-2019.json
        kind: exam
        year: 2019
```

- `semester`는 과목마다 필수이고 `1` 또는 `2`만 허용한다. 출처·문제 파일에는 중복 저장하지 않는다.
- 과목 `id`와 `source.id`는 사용자 데이터 키에 들어가므로 공개 후 바꾸지 않는다(§4).
- `source.path`와 `syllabus`는 `.json`으로 끝나야 하며, 빌드는 같은 경로의 `.yaml`을 읽는다.
- 문제 수는 적지 않는다. 빌드가 `catalog.json`에 출처별 `questionCount`를 채워 `2019 기말 (25문제)`처럼 표시한다.
- `syllabus`가 있는 과목만 챕터별 풀이를 제공한다(§4.4).

`kind`와 화면 분류(큰 분류는 `기출 / 교재 / 강의` 3개, 출처명은 `kind`가 아니라 `title`을 그대로 표시):

| `kind`      | 분류 | 출처명 예                    | 비고                                                               |
| ----------- | ---- | ---------------------------- | ------------------------------------------------------------------ |
| `exam`      | 기출 | `2019 기말`, `2018 출석대체` | 출석대체도 `exam`                                                  |
| `textbook`  | 교재 | `기본서 문제`                |                                                                    |
| `workbook`  | 교재 | `워크북 문제`                |                                                                    |
| `lecture`   | 강의 | `연습문제`                   | 이산수학 `기초특강`(`basic-intensive`)도 `lecture`와 `l` ID로 등록 |
| `intensive` | 강의 | `특강 문제`                  | 현재 쓰는 출처 없음                                                |

`kind`는 출처 라벨, ID 검증(§4), 장 결정(§4.4), 모의시험 추출(§4.1)에 쓴다.

## 3. 문제 파일 구조

출처마다 YAML 하나: `data/subjects/{subjectId}/{sourceId}.yaml`.

```yaml
subjectId: operating-systems # catalog와 일치
sourceId: past-exams-2019 # catalog와 일치
title: 운영체제 2019 기말
kind: exam # catalog와 일치
year: 2019 # exam만

passages:
  - id: g19-code-01
    type: code
    language: c
    highlights: ['int main(void)'] # 선택. 원본에서 굵게 표시된 문자열
    body: |
      int main(void) { printf("%d\n", 1); return 0; }

questions:
  - id: e19-02
    type: multiple-choice # multiple-choice | multi-answer | ox
    passageRefs: [g19-code-01]
    prompt: 위 코드의 출력 결과는?
    images: [] # 선택
    choices:
      - { id: '1', text: '0' }
      - { id: '2', text: '1' }
    answers: ['2']
    answerKey: H # 선택. 출제 원본 표기 보존
    explanation: 변수 값 1이 출력된다.
    tags: [intro] # 선택
    chapter: 4 # 선택. §4.4
```

- 문항에는 `id`, `type`, `passageRefs`, `prompt`, `images`, `choices`, `answers`, `answerKey`, `explanation`, `tags`, `chapter`, `outdated`만, 선택지에는 `id`, `text`, `image`, `diagram`만 둘 수 있다. `passageRefs`를 `passages`로 쓰거나, flow mapping에서 쉼표가 든 `text`를 따옴표 없이 써서 값이 잘리면 모르는 키로 빌드가 실패한다.
- 모르는 키 검사는 문항과 선택지에만 한다. `passages` 항목과 diagram 객체의 오타 필드는 오류 없이 조용히 무시된다.
- `tags`는 선택 필드로, 현재 앱(검색 포함)에서는 쓰지 않는다. 교재 장은 태그가 아니라 `chapter`와 syllabus로 정한다.

## 4. 식별자 규칙

문제 `id`는 파일 안에서 유일하고, 빌드가 출처 `kind`에 맞는 접두와 두 자리 숫자 두 그룹(`^t\d{2}-\d{2}$` 등)을 검사한다.

| 출처        | 형식              | 예                 |
| ----------- | ----------------- | ------------------ |
| 기출        | `e{yy}-{nn}`      | `e17-01`, `e19-23` |
| 기본서 문제 | `t{chapter}-{nn}` | `t01-03`, `t07-08` |
| 워크북      | `b{chapter}-{nn}` | `b01-03`, `b07-08` |
| 강의 문제   | `l{lecture}-{nn}` | `l01-03`, `l07-08` |
| 특강 문제   | `i{unit}-{nn}`    | `i01-03`, `i07-08` |

- 기출 `{yy}`는 catalog 출처 `year`의 끝 두 자리와 같아야 한다(`attendance-exams-2018`도 `e18-…`).
- 기출 `{nn}`은 원본 문항 번호와 상관없이 세트마다 01부터 매긴다(예: UNIX시스템 원본 36~60번 → `e17-01`~`e17-25`).
- 예외: C프로그래밍 워크북은 장 구분 없는 연속 번호 n을 `b{⌈n/10⌉:02}-{((n−1) mod 10)+1:02}`(25 → `b03-05`, 107 → `b11-07`)로 10문제씩 묶어 모의시험 분산(§4.1)에 쓴다. 첫 숫자가 장이 아니므로 모든 문제에 `chapter`를 적는다(§4.4). 이 워크북은 원본에 표시된 기출 출제 연도를 `tags`에 `y{yyyy}` 형식으로 적는다(예: `tags: [y2014, y2018]`).
- 공통 지문 ID는 `g`로 시작하고 파일 안에서 유일해야 한다(빌드 검사는 이 두 가지뿐). 실제로는 `g19-code-01`, `gb03-fig-02`, `gl02-…`, `gcp006-…`처럼 `g` 뒤를 출처별로 다르게 쓴다.
- 북마크·오답 기록(과 이를 모아 보여주는 학습 기록)의 키는 `{subjectId}:{sourceId}:{questionId}`다(예: `algorithms:workbook:b03-07`). 공개 후 출처 id를 바꾸거나 문제 ID 번호를 다시 매기면 기존 기록이 어떤 문제와도 연결되지 않으므로 세 값 모두 고정으로 취급한다.

## 4.1 모의시험 분산 기준

모의시험은 과목별로 출처 하나를 쓰고, 문항 구성은 `무작위 25문제`(기본) 또는 `전체 풀기`다.

- 출처가 25문항 이하이면 그대로 쓴다.
- 기출(`exam`): 25문항을 무작위로 뽑는다.
- 교재·워크북·강의·특강: 문제 ID의 첫 숫자 그룹(`b07-12` → 07)을 기준으로, 1부터 최대 그룹까지 그룹마다 `floor(25 / 최대 그룹)`문항을 배정하고 나머지는 작은 그룹부터 1문항씩 더한다(최대 그룹 07 → 3~4문항, 15 → 1~2문항). 보유 문항이 모자란 그룹은 가능한 만큼 뽑고, 부족분은 남은 전체 후보에서 무작위로 채운다.

## 4.2 리치 텍스트 (수식·강조·인라인 코드)

문제 본문, 선택지, 텍스트 지문, 해설, `data-table` 셀에 적용한다.

- 수식: KaTeX 인라인 `$…$`, 블록 `$$…$$`. 빌드는 인라인 코드 밖 모든 수식 구간을 파싱해 보고 실패하면 멈춘다(해설은 줄 단위). 런타임 실패 시 원문을 그대로 보인다.
- 글자 그대로의 `$`(입력 끝 표시 등)는 `\$`로 쓴다. 한 문자열에 `$`가 둘 이상이면 그 사이가 수식이 되므로 반드시 이스케이프하고, 전각 `＄`로 대신하지 않는다. 백슬래시가 유지되도록 작은따옴표나 `|` 블록을 쓴다(큰따옴표 안에서는 `\\$`). 코드 지문과 `cellFormat: code` 표에서는 `$`를 그대로 쓴다.
- 복잡한 수식은 작은따옴표나 `|` 블록으로 쓴다(큰따옴표 안에서는 `\` 이스케이프 필요).
- 강조: 원본에서 굵게 표시된 핵심 문구는 `==강조==`. 한 문자열에서 `==`가 두 번 나오면 그 사이가 강조가 되고 이스케이프 방법이 없으므로 `if(i==4)` 같은 코드는 인라인 코드로 감싼다.
- 인라인 코드: `` `…` `` 안쪽은 HTML escape만 하고 수식·강조·`\$` 처리와 빌드 수식 검증을 하지 않는다. 짝 없는 백틱 하나는 글자 그대로 보인다. 백틱 글자 자체를 보여야 하면(셸 명령 치환 등) 코드 지문이나 `cellFormat: code` 표로 옮긴다.
- 여러 줄 선택지: 수식 밖에 줄바꿈이 있는 `text`(`|` 블록 코드 선택지)는 고정폭으로 공백·들여쓰기를 보존하고, `|`가 붙이는 끝 줄바꿈 하나는 버린다. `$$…$$`만 있는 여러 줄 선택지는 수식으로 렌더링한다.

## 4.3 선택지 이미지/다이어그램

- 선택지 자체가 그림이면 가능한 한 `choices[].diagram`으로 코드화하고, 어려울 때만 `choices[].image`에 선택지별 crop 이미지를 연결한다.
- 이미지·diagram 선택지는 `text: ''`로 비운다(빈 `text`는 이 경우에만 허용). `①`처럼 번호를 텍스트로 적으면 섞었을 때 번호가 두 개 보인다.
- `alt`에는 `선택지 1`처럼 선택지 식별자와 그림 종류만 적고, 정답 여부나 풀이 핵심(게이트 이름, 판정 조건 등)은 드러내지 않는다.
- 본문에만 필요한 도표는 `question.images` 또는 `passages`(`image`/`diagram`)를 쓴다.

## 4.4 교재 장(syllabus)과 챕터별 풀이

챕터별 풀이는 문제를 복사하지 않고 기존 출처의 문제를 **교재 장** 기준으로 모은다. 강의는 장에 연결하고, 문제 하나는 **주 장 하나**에만 속하며 절 단위는 분류하지 않는다.

### syllabus 파일

`data/subjects/{subjectId}/syllabus.yaml` (빌드 후 `syllabus.json`)

```yaml
subjectId: introduction-to-computer-science
title: 컴퓨터과학개론
textbook: # 선택. 사람이 참고
  authors: [이관용, 정광식]
  publisher: 한국방송통신대학교출판문화원
  publishedAt: '2021-07-25' # 따옴표 필수 (없으면 YAML Date)
parts: # 선택. 부 구분이 있는 교재(선형대수)
  - { no: 1, title: 일차연립방정식과 행렬, chapters: [1, 2] }
chapters:
  - no: 1
    title: 컴퓨터와 데이터
    sections: # 참고용. 분류에 쓰지 않음
      - { no: '1.1', title: 컴퓨터와 컴퓨터과학 }
lectures:
  - { no: 1, title: '컴퓨터와 자료 (1)', chapters: [1] }
  - { no: 14, title: 의미분석과 중간언어, chapters: [6, 7], note: '…' } # 첫 장이 주 장
```

- `chapters[].no`, `lectures[].no`, `parts[].no`는 파일 안에서 유일한 양의 정수다.
- `chapters`는 비어 있으면 안 된다. `parts[].chapters`, `lectures[].chapters`는 비어 있지 않고 존재하는 장만 참조한다.
- `parts`가 있으면 모든 장이 정확히 한 부에 속해야 한다.
- `lectures[].sections`, `lectures[].note`는 참고용 선택 필드다.
- 교재 장이 없는 강은 `lectures`에서 뺀다(C프로그래밍 15강 C++ 개요). 강의 출처에서 빠진 강의 문제는 `chapter`를 적지 않으면 빌드가 실패한다.

### 문제의 장 결정 규칙

| 출처 종류                            | 장 결정 방법                                             | 문제 파일에 적을 것                                  |
| ------------------------------------ | -------------------------------------------------------- | ---------------------------------------------------- |
| 기출 (`exam`)                        | `chapter` 필드                                           | `chapter: N` 또는 `outdated: true` (둘 중 하나 필수) |
| 교재·워크북 (`textbook`, `workbook`) | ID 첫 숫자 그룹 = 장 (`b03-07` → 3장)                    | 없음 (ID 그룹이 장이 아니면 `chapter: N`)            |
| 강의 (`lecture`)                     | ID 첫 숫자 그룹 = 강 → `syllabus.lectures[].chapters[0]` | 없음 (강이 syllabus에 있어야 함)                     |
| 특강 (`intensive`)                   | `chapter` 필드 (특강 단원 번호는 교재 장·강과 무관)      | `chapter: N`                                         |

- `chapter`를 적으면 어느 종류든 ID보다 우선한다. 다음 경우에 쓴다: ID 그룹이 장이 아닌 워크북(C프로그래밍), 교재 장과 다른 단위의 부록 장(시뮬레이션 워크북 10장 응용사례 → `chapter: 2`), 여러 장을 다루는 강의 특정 문제, 기출과 같은 유형인 강의 문제를 기출과 같은 장으로 맞출 때.
- 여러 장에 걸친 문제는 실제로 묻는 핵심 개념의 장 하나를 주 장으로 정한다.

### outdated 문제

현재 교재 목차에 주제가 없는 기출(교재 개정으로 빠진 내용)은 `chapter` 대신 `outdated: true`를 적고 [outdated.md](./outdated.md)에 ``- `{subjectId}:{sourceId}:{questionId}` — 주제 — 근거`` 형식으로 기록한다.

- 챕터별 풀이에서만 제외하고, 연도별 풀이와 모의 시험에는 그대로 나온다.
- 기출에만 쓸 수 있다. 강의·교재 문제는 현재 교재 기준이므로 장이 없으면 데이터 오류다.

### 빌드 검증

- syllabus가 있는 과목: 모든 문제(outdated 제외)의 장이 정해지고 `syllabus.chapters`에 있어야 한다. `outdated: true` 문제와 `docs/outdated.md` 목록이 정확히 일치해야 한다.
- syllabus가 없는 과목: `chapter`, `outdated`를 쓰면 실패한다.
- `chapter`와 `outdated`를 한 문제에 함께 쓰면 실패한다.

## 5. 공통 지문과 다이어그램

공통 지문은 `passages` 배열로 분리하고 문제에서 `passageRefs` 배열로 참조한다(중복 저장 방지, 한 문제에 코드 + 표처럼 여러 지문 연결 가능). `passageRefs`가 없으면 단독 문제다.

- `passages.type`: `text`(수식 가능), `code`(`language`, `body`, 선택 `highlights`), `image`(`image.path`, `image.alt`), `diagram`(`diagram`).
- `passages.id`는 참조용이며 화면에 노출하지 않는다. 빌드는 참조 여부와 상관없이 모든 지문을 검사하지만(ID 접두, `type`, 수식, 이미지, diagram), 어떤 문제도 참조하지 않는 지문인지는 확인하지 않는다.
- 도표·그래프·표처럼 시각 정보가 의미를 갖는 지문은 텍스트로 해석해 `body`에 옮기지 않는다. 구조적으로 그릴 수 있으면 `diagram`, 재현이 어렵거나 세부 시각 형태 자체가 문제 조건일 때만 crop `image`를 쓴다.

### diagram 타입

모든 SVG 타입은 `width`, `height`(viewBox 크기)를 가진다. "선택"은 필요할 때만 둔다.

- SVG `<text>`에 들어가는 라벨(`simple-graph`·`resource-allocation-graph`의 노드·간선 라벨)에는 KaTeX 수식 문자열(`$v_1$`, `\(...\)`)을 넣지 않고 `v1`처럼 일반 텍스트를 쓴다. 수식이 꼭 필요하면 text 지문·발문·선택지·해설에 쓴다.
- 노드 `label`은 비울 수 없다. 숨기려면 `hideLabel: true`.

| 타입                        | 필드                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `resource-allocation-graph` | `nodes[]`: `id`, `kind`(`process` 원 / `resource` 사각형), `label`(`p_1`처럼 `_1`~`_3`은 하첨자), `x`, `y`, 선택 `units`(단위자원 수). 빌드는 선택 `shape`(`circle`·`box`만), `hideLabel`, `hideNode`, `fontSize`, `radius`, `width`, `height`, `labelDx`/`labelDy`도 허용하지만 현재 렌더러는 이 값들을 쓰지 않는다. `edges[]`: `from`, `to`(노드 id), 선택 `style`(`solid` 기본·`dashed`), `label`, `labelDx`, `labelDy`                                                                                                          |
| `simple-graph`              | 선택 `directed`(전체 기본 방향). `nodes[]`: `id`, `label`, `x`, `y`, 선택 `hideLabel`, `hideNode`(라벨만 표시), `shape`(`circle` 기본·`box`·`diamond`·`ellipse`; `diamond`·`ellipse`는 `width`·`height`로 크기를 정하고 간선이 윤곽선에서 끝남), `radius`/`width`/`height`, `underline`(E-R 키 속성), `labelDx`/`labelDy`, `fontSize`, `fillColor`, `strokeColor`, `strokeWidth`, `textColor`, `tone`(`filled`만). `edges[]`: `from`, `to`, 선택 `label`, `directed`, `curve`(자기 루프 `curve: 1`), `style`(`solid` 기본·`dashed`) |
| `ui-window`                 | `title`, `components[]`(비어 있으면 안 됨): `kind`(`checkbox`·`radio`·`label`), `label`, `x`, `y`, 선택 `checked`, `focused`                                                                                                                                                                                                                                                                                                                                                                                                        |
| `memory-free-list`          | `blocks[]`(위→아래): `id`(유일), `kind`(`os`·`allocated`·`free`), `label`, 선택 `size`(빈 공간 상대 높이, MB)                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `data-table`                | `columns`(비어 있으면 안 됨), `rows`(비어 있으면 안 되고 행마다 셀 수 = `columns` 수), 선택 `cellFormat`(`text` 기본 / `code`)                                                                                                                                                                                                                                                                                                                                                                                                      |
| `clock-page-replacement`    | `pointerIndex`(가리키는 `entries` 인덱스), `entries[]`(비어 있으면 안 됨): `page`, `referenceBit`(`0`/`1`)                                                                                                                                                                                                                                                                                                                                                                                                                          |

`data-table` 셀:

- HTML 표라 리치 텍스트(수식·인라인 코드·`==강조==`)를 쓸 수 있고 빌드가 셀마다 수식을 검사한다.
- 셀은 빈 문자열일 수 없다. 빈 칸은 `' '`(공백 한 칸).
- `cellFormat: code`면 셀이 공백·줄바꿈을 보존하는 `<pre><code>`(끝 공백 제거)로 렌더링되고 리치 텍스트 처리와 수식 검증을 하지 않는다. 백틱이나 `$`를 글자 그대로 보일 때 쓴다. 머리글은 항상 리치 텍스트다.

## 6. 정답 표현

정답은 항상 `choices.id` 배열이다: `['1']`(단일), `['1', '3']`(복수), `['O']`(OX).

| `type`            | UI                      | 정답 판정                                                |
| ----------------- | ----------------------- | -------------------------------------------------------- |
| `multiple-choice` | 라디오 버튼             | 사용자 선택 1개가 `answers[0]`과 일치하면 정답           |
| `multi-answer`    | 체크박스                | 사용자 선택 집합이 `answers` 집합과 정확히 일치하면 정답 |
| `ox`              | 라디오 버튼 (O/X 두 개) | `multiple-choice`와 동일                                 |

`multi-answer`이거나 `answers.length > 1`이면 체크박스 UI를 쓴다. `answerKey`는 출제 원본의 알파벳 표기를 보존하는 선택 필드로 채점에 쓰지 않으며, `answers`에는 실제 선택지 ID를 적는다.

| `answerKey` | `answers`              |
| ----------- | ---------------------- |
| A           | `["1", "2"]`           |
| B           | `["1", "3"]`           |
| C           | `["1", "4"]`           |
| D           | `["2", "3"]`           |
| E           | `["2", "4"]`           |
| F           | `["3", "4"]`           |
| G           | `["1", "2", "3"]`      |
| H           | `["1", "2", "4"]`      |
| I           | `["1", "3", "4"]`      |
| J           | `["2", "3", "4"]`      |
| K           | `["1", "2", "3", "4"]` |

`answers`는 비워 두지 않는다. 공식 정답표를 확인하기 전이면 원문을 판독해 직접 푼 임시 정답과 근거를 적고, 정답표가 있는 기출은 세트 입력 후 `answers`를 원본 정답과 대조해 다르면 `answers`와 해설을 고친다.

## 7. 해설 작성

`explanation`은 다시 풀 때 판단 근거를 확인할 수 있게 쓴다.

```yaml
explanation: |
  선택지 1: ...
  선택지 2: ...

  핵심 개념:
  ...
```

- 선택지마다 정답·오답 이유를 적는다. 오답은 "틀렸다"로 끝내지 않고 그 선택지가 가리키는 개념과 문제 조건에 맞지 않는 이유를 적는다.
- 핵심 개념을 4~5줄로 요약한다.
- 약어가 핵심 판단에 나오면 첫 설명에서 풀폼을 함께 적는다(예: `RTOS(Real-Time Operating System)`).
- 임시 해설도 같은 구조로 쓰고, 공식 정답 대조 후 필요하면 보정한다.

### 원본 유지와 `※` 표시

발문·선택지·지문은 원본(`origin/`의 스캔·PDF·캡처)을 글자 그대로 옮기고 인쇄 정답(공식 정답표)을 우선한다. 원본에 문제가 있어도 이 부분은 고치지 않고 해설에 `※` 줄로 표시한다.

- 풀이에 영향을 주는 오탈자·기호 오류는 `※ 원본 표기: ...` 한 줄로 알린다. 영향이 없으면 적지 않는다.
- 원본 서술이 사실과 다르거나 인쇄 정답이 표준·실제 동작 기준으로 논란이 있으면 `※` 줄에 원본 내용, 실제로 맞는 내용, 인쇄 정답을 유지한다는 점을 적는다.
- 해설 문장(`선택지 N:` 줄, 핵심 개념)은 작성자의 글이므로 원본 해설의 오류를 옮기지 않고 사실대로 쓴다. 인쇄 정답 선택지 해설이 `※` 내용과 부딪히면 그 줄에서 `※ 참고`처럼 `※` 줄을 가리킨다.
- 공통 지문 머리말의 원본 문항 범위(예: `(52~53)`)는 원본대로 두고, 앱 문항 번호와 다르면 해설 `※` 줄에 대응 번호를 적는다.
- `※` 줄은 핵심 개념 뒤에 빈 줄을 두고 적는다. 렌더러는 `※`로 시작하는 줄을 위치와 상관없이 해설 끝 안내 블록에 한 줄씩 표시하고 이어지는 줄은 묶지 않으므로, 항목 하나는 한 줄로 쓴다.
- 데이터 작업 메모("그대로 옮겼다")나 추측("~로 보인다", "확인이 필요하다")은 해설에 쓰지 않는다.

### 선택지 지칭

선택지는 섞일 수 있고 화면 번호는 표시 순서로 매겨진다([ux.md §2](./ux.md)). 해설 본문과 `※` 줄에서는 선택지를 `①`, `선택지 3과 같은`처럼 번호로 가리키지 않고 내용으로 지칭한다(예: `"정수형 자료에 대해서만 가능하다" 선택지`). 줄 머리의 `선택지 N:`은 렌더러가 `choice.id`로 연결하므로 그대로 쓴다.

다른 문항을 번호로 참조하는 발문(예: `위의 문제 15번`)은 원본대로 두되 필요한 표·지문을 `passageRefs`로 연결해 단독으로 풀 수 있게 한다. 앞 문항 발문에만 있는 조건(예: `$X_0 = 1$ 일 때`)이 필요한 뒤 문항은 그 문구를 원문 그대로 작은 text 지문으로 떼어 뒤 문항에만 연결한다.

## 8. 이미지 처리

- 파일은 `public/images/subjects/{subjectId}/` 아래 두고 데이터에는 `public/` 기준 상대 경로(`images/subjects/...`)를 적는다. 폴더는 기출이면 `past-exams/{year}/`, 그 외는 `sourceId`(`workbook/`, `textbook/`, `lecture-exercises/`).
- 문제 하나에만 붙는 이미지는 `questions[].images`, 여러 문제가 공유하면 `passages[].image`.
- 파일명에 문제 ID를 넣는다(`e19-01.png`, `b03-07-fig1.png`).
- 빌드는 `path` 파일 존재(`public/` 또는 저장소 루트 기준)와 비어 있지 않은 `alt`를 검사한다.
- 시험지 전체 이미지는 공개 자산으로 쓰지 않고, 이미지 지문을 OCR/해석 텍스트로 대체하지 않는다.
- 구조화 가능한 도표(자원할당 그래프, 빈 공간 리스트, 표, 클럭 큐 등)는 diagram으로 쓰고, 불가능하거나 세부 시각 정보 자체가 채점 단서일 때만 `pnpm image:crop`(`scripts/crop-png.mjs`)으로 잘라 쓴다.
- 이미지 최적화(WebP)는 용량 문제가 생기면 빌드에 추가한다.
