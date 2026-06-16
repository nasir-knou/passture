# Data Schema

문제 데이터의 포맷, 카탈로그 구조, 식별자 규칙, 공통 지문 처리, 정답 표현, 이미지 처리.

## 1. 포맷 결정 (YAML 저작 → JSON 런타임)

문제 원본은 **YAML로 작성**하고, 빌드 시점에 **JSON으로 변환**하여 런타임에 사용한다.

### YAML 채택 사유 (저작)

- 멀티라인 문자열, 주석 지원 → 코드 지문/긴 해설에 유리
- 따옴표·이스케이프 부담이 적어 입력 속도가 빠름
- 작업자가 손으로 직접 작성·검토하는 비중이 높음

### JSON 채택 사유 (런타임)

- 브라우저에서 `fetch()` 후 즉시 파싱 가능 (런타임 의존성 0)
- GitHub Pages 정적 배포와 완전 호환
- TypeScript 타입과 직접 작성한 검증기로 빌드 시 검증 용이

빌드 파이프라인 동작은 [architecture.md §3](./architecture.md) 참고.

## 2. catalog.yaml

현재 `data/catalog.yaml`에는 8개 과목이 등록되어 있다.

| 학기  | 과목                                                   |
| ----- | ------------------------------------------------------ |
| 1학기 | 운영체제, 이산수학, 알고리즘, 인공지능, Java프로그래밍 |
| 2학기 | 선형대수, 컴퓨터과학개론, 컴퓨터구조                   |

카탈로그 항목 예:

```yaml
# data/catalog.yaml
version: 1
subjects:
  - id: computer-architecture
    title: 컴퓨터구조
    semester: 2
    sources:
      - id: past-exams-2019
        title: 2019 기말
        path: subjects/computer-architecture/past-exams-2019.json
        kind: exam
        year: 2019
      - id: past-exams-2018
        title: 2018 기말
        path: subjects/computer-architecture/past-exams-2018.json
        kind: exam
        year: 2018
      - id: past-exams-2017
        title: 2017 기말
        path: subjects/computer-architecture/past-exams-2017.json
        kind: exam
        year: 2017
```

런타임용 `public/data/catalog.json`에는 빌드 시 각 출처의 `questions.length`를 계산한 `questionCount`가 추가된다. 선택 화면과 홈의 출처 목록은 이를 사용해 `2019 기말 (25문제)`처럼 표시한다. 원본 `catalog.yaml`에는 수동으로 문제 수를 적지 않는다.

과목의 학기 정보는 `subjects[].semester`에 단일값으로 저장한다.

- `semester: 1` → 1학기 과목
- `semester: 2` → 2학기 과목
- 모든 과목은 `semester`를 반드시 가져야 하며, 값은 `1` 또는 `2`만 허용한다.
- 학기 정보는 과목 단위 메타데이터이므로 출처나 문제 파일에는 중복 저장하지 않는다.
- `subjectId`는 북마크, 오답 기록, 풀이 세션 키에 쓰이므로 학기 구분을 위해 변경하지 않는다.

화면의 큰 분류는 `기출 / 교재 / 강의` 3개로 유지한다.

- `kind: exam` → 기출 분류, 출처명은 `2019 기말`처럼 표시한다.
- `kind: textbook` → 교재 분류, 출처명은 `기본서 문제`를 사용한다.
- `kind: workbook` → 교재 분류, 출처명은 `워크북 문제`를 사용한다.
- `kind: lecture` → 강의 분류, 출처명은 `연습문제`를 사용한다.
- `kind: intensive` → 강의 분류, 출처명은 `특강 문제`를 사용한다.

`kind` 값(`exam` | `textbook` | `workbook` | `lecture` | `intensive`)은 출처 라벨과 ID 검증에 사용한다. 현재 UI는 탭이 아니라 선택된 과목의 출처 체크리스트를 표시한다.

## 3. 문제 파일 구조 (YAML 저작 기준)

문제 출처별 단일 YAML 파일로 관리한다.

예: `data/subjects/operating-systems/past-exams-2019.yaml`

```yaml
subjectId: operating-systems
sourceId: past-exams-2019
title: 운영체제 2019 기말
kind: exam
year: 2019

passages:
  - id: g19-code-01
    type: code
    language: c
    highlights: ['int main(void)'] # 선택. 코드 지문에서 강조할 문자열
    body: |
      int main(void) {
        int a = 1;
        printf("%d\n", a);
        return 0;
      }

questions:
  - id: e19-01
    type: multiple-choice
    prompt: 운영체제의 주된 역할로 가장 적절한 것은?
    images: []
    choices:
      - id: '1'
        text: 사용자와 하드웨어 사이의 인터페이스 제공
      - id: '2'
        text: 문서 편집 기능 제공
      - id: '3'
        text: 웹 검색 결과 제공
      - id: '4'
        text: 전자우편 송수신 전용 기능 제공
    answers: ['1']
    explanation: |
      운영체제는 사용자와 하드웨어 사이에서 자원을 관리하고 인터페이스를 제공한다.
    tags: [intro, role]

  - id: e19-02
    type: multiple-choice
    passageRefs: [g19-code-01]
    prompt: 위 코드의 출력 결과는?
    choices:
      - { id: '1', text: '0' }
      - { id: '2', text: '1' }
      - { id: '3', text: '2' }
      - { id: '4', text: '컴파일 오류' }
    answers: ['2']
    explanation: 변수 `a`의 값 1이 출력된다.

  - id: e19-03
    type: ox
    prompt: 프로세스와 스레드는 동일한 개념이다.
    choices:
      - { id: 'O', text: 'O' }
      - { id: 'X', text: 'X' }
    answers: ['X']
    explanation: 프로세스와 스레드는 자원 공유 범위와 독립성에서 다르다.

  - id: e19-04
    type: multi-answer # 복수정답 문제
    prompt: 다음 중 운영체제의 기능으로 옳은 것을 모두 고르시오.
    choices:
      - { id: '1', text: '프로세스 관리' }
      - { id: '2', text: '메모리 관리' }
      - { id: '3', text: '전자결제 처리' }
      - { id: '4', text: '장치 관리' }
    answers: ['1', '2', '4']
    answerKey: F # 출제표기 보존(선택)
    explanation: 운영체제 핵심 기능은 프로세스/메모리/장치 관리이다.
```

빌드 후 동일 구조의 JSON으로 변환된다.

## 4. 식별자 규칙

문제 `id`는 파일 안에서 유일해야 한다. 출처 종류별 접두사를 명시적으로 둔다.

- 기출: `e{yy}-{nn}` → `e17-01`, `e18-25`, `e19-23`
- 기본서 문제: `t{chapter}-{nn}` → `t01-03`, `t07-08`
- 워크북: `b{chapter}-{nn}` → `b01-03`, `b07-08`
- 강의 문제: `l{lecture}-{nn}` → `l01-03`, `l07-08`
- 특강 문제: `i{unit}-{nn}` → `i01-03`, `i07-08`

기출에 `e` 접두를 붙이는 이유:

- 순수 숫자 ID(`17-01`)는 챕터 ID `b17-01`과 시각적으로 헷갈릴 수 있다.
- URL, 검색, 로그에서 출처 종류를 즉시 식별하기 쉽다.
- 향후 모의고사 등 새 출처가 생겨도 동일한 1글자 접두 컨벤션을 유지하기 쉽다.

공통 지문(passage) ID는 `g` 접두를 사용한다.

- 기출 코드 지문: `g19-code-01`
- 교재 도식 지문: `gb03-fig-02`

앱 내부에서 북마크와 풀이 기록을 저장할 때는 충돌 방지를 위해 다음 복합 키를 사용한다.

```text
{subjectId}:{sourceId}:{questionId}
```

예:

```text
operating-systems:past-exams-2019:e19-01
algorithms:textbook:t03-07
algorithms:workbook:b03-07
```

## 4.1 모의시험 분산 기준

모의시험은 과목별로 하나의 출처만 사용한다. 25문항 구성은 출처 종류에 따라 다르게 처리한다.

- 기출(`kind: exam`): 출처가 25문항이면 그대로 사용하고, 35문항이면 무작위로 25문항을 추출한다.
- 교재(`kind: textbook`), 워크북(`kind: workbook`), 강의(`kind: lecture`), 특강(`kind: intensive`): 문제 ID의 첫 숫자 그룹을 기준으로 전체 그룹 범위를 파악하고, 25문항을 가능한 균등하게 분산 추출한다.

ID 그룹 예:

```text
t03-08 -> 03
b07-12 -> 07
l11-04 -> 11
i02-03 -> 02
```

그룹 범위는 실제 존재하는 문제의 최대 그룹 번호를 기준으로 한다. 최대 그룹이 `07`이면 각 그룹에서 3~4문항, 최대 그룹이 `11`이면 2~3문항, 최대 그룹이 `15`이면 1~2문항을 배정한다. 특정 그룹의 보유 문항이 배정량보다 적으면 가능한 만큼만 뽑고, 부족분은 아직 선택되지 않은 전체 후보에서 무작위로 채운다.

## 4.2 수식 렌더링

문제 본문, 선택지, 텍스트 지문, 해설은 KaTeX 문법의 인라인/블록 수식을 지원한다.

- 인라인 수식: `$T(n)=O(n\log n)$`
- 블록 수식: `$$ ... $$`
- 수식이 없는 일반 텍스트는 HTML escape 후 그대로 표시한다.
- 수식 렌더링 실패 시 원문 수식 문자열을 안전하게 표시한다.
- 긴 수식은 모바일에서 가로 스크롤될 수 있도록 UI에서 처리한다.
- 원본 문제에서 굵게 표시된 핵심 문구는 문제 본문, 선택지, 해설에서 `==강조==`로 감싸면 하이라이트로 렌더링한다.

수식 선택지 예:

```yaml
choices:
  - id: '1'
    text: '$T(n)=T(n/2)+\Theta(1),\ T(1)=\Theta(1)$'
  - id: '2'
    text: |
      $$
      LCS(i,j)=
      \begin{cases}
      0 & i=0 \text{ 또는 } j=0 \\
      LCS(i-1,j-1)+1 & x_i=y_j \\
      \max\{LCS(i,j-1), LCS(i-1,j)\} & x_i \ne y_j
      \end{cases}
      $$
```

YAML 큰따옴표 안에서는 `\` 이스케이프가 필요하므로, 복잡한 수식은 작은따옴표 또는 블록 문자열(`|`)을 우선 사용한다.

## 4.3 선택지 이미지/다이어그램

선택지 자체가 그림인 문제도 도표화/코드화가 가능하면 `choices[].diagram`으로 작성한다. diagram으로 재현하기 어려운 경우에만 `choices[].image`에 선택지별 crop 이미지를 연결한다. 선택지 텍스트는 접근성과 정답 표시를 위해 비워두지 않고 `①`, `그래프 1`처럼 짧게 유지한다.

```yaml
choices:
  - id: '1'
    text: '①'
    image:
      path: images/subjects/algorithms/textbook/ch04/q07-choice-1.png
      alt: 알고리즘 교재 4장 7번 선택지 1 그래프
  - id: '2'
    text: '②'
    image:
      path: images/subjects/algorithms/textbook/ch04/q07-choice-2.png
      alt: 알고리즘 교재 4장 7번 선택지 2 그래프
```

선택지 도표가 구조화 렌더링 가능한 형태라면 `choices[].diagram`을 사용한다. 예를 들어 자원할당 그래프 선택지는 crop 이미지 대신 `resource-allocation-graph` 데이터로 작성한다.

```yaml
choices:
  - id: '1'
    text: 그래프 1
    diagram:
      type: resource-allocation-graph
      width: 260
      height: 190
      nodes:
        - { id: p1, kind: process, label: p_1, x: 45, y: 95 }
        - { id: r1, kind: resource, label: r_1, x: 88, y: 35 }
      edges:
        - { from: p1, to: r1 }
```

도표가 문제 본문에만 필요한 경우에는 `question.images`, `passages.type: image`, 또는 `passages.type: diagram`을 사용한다. 선택지마다 다른 그림을 골라야 하는 경우에는 `choices[].image`나 `choices[].diagram`을 사용한다.

## 5. 공통 지문 처리

공통 지문은 별도 `passages` 배열로 분리하고, 문제에서 `passageRefs` 배열로 참조한다.

이유:

- 같은 지문이 여러 문제에 반복 저장되는 것을 피할 수 있다.
- 지문 수정 시 한 곳만 고치면 된다.
- 코드 지문, 이미지 지문, 다이어그램 지문, 긴 설명을 구조화하기 쉽다.
- 문제 1개에 여러 지문이 함께 묶이는 경우(코드 + 입출력 표)도 배열이라 자연스럽게 처리된다.
- 도표, 그래프, 표처럼 원본 이미지가 의미를 갖는 공통 지문은 텍스트로 해석해 `body`에 옮기지 않는다.
- 브라우저에서 구조적으로 그릴 수 있는 도표는 `type: diagram`과 `diagram` 필드를 사용해 이미지 대신 코드 렌더링한다.
- diagram으로 재현하기 어렵거나 원본의 세부 시각 형태 자체가 문제 조건인 불가피한 경우에만 `type: image`와 `image.path`로 원본 crop 이미지를 참조한다.
- 코드 지문에서 원본의 굵게 표시를 보존해야 하면 `highlights`에 강조할 원문 문자열을 기록한다.
- `passages.id`는 데이터 참조용 식별자이며, 실제 문제 화면에는 노출하지 않는다.

`passageRefs`가 비어있거나 없으면 단독 문제로 취급한다.

이미지 공통 지문 예:

```yaml
passages:
  - id: g17-rag-01
    type: image
    image:
      path: images/subjects/operating-systems/past-exams/2017/e17-rag.png
      alt: 2017년 운영체제 기출 40번 자원할당 그래프

questions:
  - id: e17-05
    passageRefs: [g17-rag-01]
    prompt: 다음 자원할당 그래프에 대한 설명으로 바른 것은?
```

다이어그램 공통 지문 예:

```yaml
passages:
  - id: g07-avoidance-rag-04
    type: diagram
    diagram:
      type: resource-allocation-graph
      width: 520
      height: 180
      nodes:
        - { id: p1, kind: process, label: p_1, x: 170, y: 90 }
        - { id: p2, kind: process, label: p_2, x: 350, y: 90 }
        - { id: r1, kind: resource, label: r_1, x: 260, y: 38 }
        - { id: r2, kind: resource, label: r_2, x: 260, y: 142 }
      edges:
        - { from: r1, to: p1 }
        - { from: p1, to: r2, style: dashed }
        - { from: p2, to: r1, style: dashed }
        - { from: p2, to: r2, style: dashed }

questions:
  - id: b07-04
    passageRefs: [g07-avoidance-rag-04]
    prompt: 변형된 자원할당 그래프에서 운영체제가 수용할 경우 불안전상태가 되는 요청은?
```

현재 지원하는 `diagram.type`:

- `resource-allocation-graph`: 운영체제 자원할당 그래프
- `simple-graph`: 일반 그래프, 방향 그래프, 트리, 오토마타 등 노드/간선 도표
- `ui-window`: Java AWT/Swing 실행 화면처럼 창과 단순 컨트롤 배치가 필요한 도표
- `memory-free-list`: 운영체제 빈 공간 리스트
- `data-table`: 표 형태의 공통 지문
- `clock-page-replacement`: 클럭 페이지 교체 알고리즘의 원형 큐

SVG 기반 `diagram` 라벨 작성 규칙:

- `simple-graph.nodes[].label`, `simple-graph.edges[].label`처럼 SVG `<text>` 안에 직접 들어가는 라벨에는 KaTeX 수식 문자열을 넣지 않는다.
- 예를 들어 노드 라벨은 `$v_1$` 대신 `v1`, `v2`처럼 일반 텍스트를 사용한다.
- SVG 내부 텍스트는 HTML 기반 KaTeX 렌더링 대상이 아니므로 `$...$`, `\(...\)`, `\begin{...}` 같은 수식 문자열이 그대로 보이거나 렌더링이 깨질 수 있다.
- 수식 표기가 반드시 필요하면 diagram 라벨에 넣지 말고, `passages.type: text`의 `body`, 문제 `prompt`, 선택지 `text`, 해설에 별도로 작성한다.
- `data-table` 셀은 SVG가 아니라 HTML 표로 렌더링하므로 KaTeX 인라인 수식을 사용할 수 있다.

`resource-allocation-graph` 필드:

- `width`, `height`: SVG `viewBox` 크기
- `nodes`: 프로세스/자원 노드 배열
- `nodes[].kind`: `process` 또는 `resource`
- `nodes[].label`: 화면에 표시할 라벨. `p_1`, `r_2`처럼 `_1`, `_2`, `_3` 하첨자 표기를 사용할 수 있다.
- `nodes[].x`, `nodes[].y`: 다이어그램 내부 좌표
- `nodes[].units`: 자원 노드 위에 표시할 단위자원 개수. 필요할 때만 둔다.
- `edges`: 방향 간선 배열
- `edges[].from`, `edges[].to`: `nodes[].id`를 참조한다.
- `edges[].style`: 생략하면 실선, `dashed`를 주면 점선으로 렌더링한다.

`simple-graph` 필드:

- `width`, `height`: SVG `viewBox` 크기
- `directed`: 전체 그래프의 기본 방향성. 필요할 때만 둔다.
- `nodes`: 일반 노드 배열
- `nodes[].id`: 간선 참조용 노드 ID
- `nodes[].label`: 화면에 표시할 라벨. KaTeX 수식 문자열은 넣지 않는다.
- `nodes[].x`, `nodes[].y`: 다이어그램 내부 좌표
- `nodes[].hideLabel`: 라벨을 숨길 때 사용한다. 필요할 때만 둔다.
- `nodes[].hideNode`: 노드 도형을 숨기고 라벨만 표시할 때 사용한다. 필요할 때만 둔다.
- `nodes[].shape`: `circle` 또는 `box`. 필요할 때만 둔다.
- `nodes[].radius`, `nodes[].width`, `nodes[].height`: 노드 크기 보정. 필요할 때만 둔다.
- `nodes[].labelDx`, `nodes[].labelDy`: 라벨 위치를 보정한다. 필요할 때만 둔다.
- `nodes[].fontSize`, `nodes[].fillColor`, `nodes[].strokeColor`, `nodes[].strokeWidth`, `nodes[].textColor`, `nodes[].tone`: 노드 표시 스타일 보정. 필요할 때만 둔다.
- `edges`: 간선 배열
- `edges[].from`, `edges[].to`: `nodes[].id`를 참조한다.
- `edges[].label`: 간선 라벨. KaTeX 수식 문자열은 넣지 않는다. 필요할 때만 둔다.
- `edges[].directed`: 개별 간선의 방향성을 지정한다. 필요할 때만 둔다.
- `edges[].curve`: 간선 곡률을 조정한다. 필요할 때만 둔다.

`ui-window` 필드:

- `width`, `height`: SVG `viewBox` 크기
- `title`: 창 제목
- `components`: 창 내부에 표시할 컨트롤 배열
- `components[].kind`: `checkbox`, `radio`, `label`
- `components[].label`: 표시 텍스트
- `components[].x`, `components[].y`: 컨트롤 좌표
- `components[].checked`: 체크박스/라디오 선택 상태. 필요할 때만 둔다.
- `components[].focused`: 키보드 포커스 표시. 필요할 때만 둔다.

`memory-free-list` 필드:

- `width`, `height`: SVG `viewBox` 크기
- `blocks`: 위에서 아래 순서로 표시할 메모리 블록 배열
- `blocks[].kind`: `os`, `allocated`, `free`
- `blocks[].label`: 화면에 표시할 라벨
- `blocks[].size`: 빈 공간 블록의 상대 높이를 계산할 때 사용하는 MB 크기. 필요할 때만 둔다.

`data-table` 필드:

- `columns`: 표 머리글 배열
- `cellFormat`: 선택 필드. 기본값은 `text`이며, 코드형 표는 `code`를 사용한다.
- `rows`: 행 배열. 각 행의 셀 개수는 `columns` 개수와 같아야 한다.
- 셀 문자열에는 일반 텍스트와 KaTeX 인라인 수식을 사용할 수 있다.
- `cellFormat: code`일 때 셀 문자열은 공백과 줄바꿈을 보존하는 코드 블록으로 렌더링된다.

`clock-page-replacement` 필드:

- `width`, `height`: SVG `viewBox` 크기
- `pointerIndex`: 포인터가 가리키는 `entries` 배열 인덱스
- `entries`: 원형 큐 항목 배열
- `entries[].page`: 페이지 라벨
- `entries[].referenceBit`: 참조 비트. `0` 또는 `1`

빌드 시 검증 규칙:

- `passageRefs`의 모든 ID가 동일 파일의 `passages.id`에 존재해야 한다.
- 어떤 문제도 참조하지 않는 `passages` 항목이 있으면 경고만 출력한다 (작업 중 임시 보존 가능).

## 6. 정답 표현

정답은 항상 배열로 저장한다.

```yaml
answers: ["1"]            # 단일 정답
answers: ["1", "3"]       # 복수 정답
answers: ["O"]            # OX
```

문제 타입별 처리:

| `type`            | UI                      | 정답 판정                                                |
| ----------------- | ----------------------- | -------------------------------------------------------- |
| `multiple-choice` | 라디오 버튼             | 사용자 선택 1개가 `answers[0]`과 일치하면 정답           |
| `multi-answer`    | 체크박스                | 사용자 선택 집합이 `answers` 집합과 정확히 일치하면 정답 |
| `ox`              | 라디오 버튼 (O/X 두 개) | `multiple-choice`와 동일                                 |

`multi-answer`이거나 `answers.length > 1`이면 자동으로 체크박스 UI를 사용한다.

`answerKey`(예: A, B, C, F)는 출제 원본 표기를 보존하기 위한 선택 필드이며, 채점에는 사용하지 않는다.

중복정답 대조표에서 알파벳 표기가 사용되는 경우 `answerKey`는 원본 알파벳을 보존하고, `answers`에는 실제 선택지 ID 배열을 기록한다.

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

콘텐츠 입력 단계에서 공식 정오표/정답표를 아직 확인하지 못한 경우에도 `answers`는 비워두지 않는다. 문제 이미지 또는 원문을 판독해 직접 풀이한 임시 정답을 기재하고, 풀이 근거를 `explanation`에 남긴다. 공식 정답표나 정답 대조표가 있는 기출은 세트 입력 완료 후 `answers` 문자열을 원본 정답과 대조한다.

## 7. 해설 작성

`explanation`은 단순 정답 문장이 아니라 학습자가 다시 풀 때 판단 근거를 확인할 수 있는 형태로 작성한다.

작성 기준:

- 각 선택지별로 왜 정답 또는 오답인지 이유를 정리한다.
- 정답 선택지는 핵심 판단 근거를 명확히 적는다.
- 오답 선택지는 단순히 "틀렸다"가 아니라, 해당 선택지가 가리키는 개념이 무엇인지 설명하고 왜 문제의 조건 또는 질문과 맞지 않는지 적는다.
- 문항의 핵심 개념에 대해 4~5줄 분량의 요약 설명을 함께 제공한다.
- 공식 정답 검증 전 임시 해설도 같은 구조로 작성하고, 공식 정답 대조 후 필요한 경우 보정한다.

권장 형식:

```yaml
explanation: |
  선택지 1: ...
  선택지 2: ...
  선택지 3: ...
  선택지 4: ...

  핵심 개념:
  ...
```

## 8. 이미지 처리

문제 이미지는 저장소에 파일로 두고, 데이터에는 상대 경로를 기록한다. 문제 1개에만 붙는 이미지는 `questions[].images`에 두고, 여러 문제가 공유하는 도표/표 이미지는 `passages[].image`에 둔다.

```yaml
images:
  - path: images/subjects/operating-systems/past-exams/e19-01.png
    alt: 2019년 1번 문제 참고 이미지
```

규칙:

- 파일명에 문제 ID를 포함해 추적성을 확보한다 (`e19-01.png`, `b03-07-fig1.png`).
- 빌드 단계에서 `path` 파일이 실제 존재하는지 검증한다.
- 시험지 전체 이미지는 공개 자산으로 쓰지 않는다.
- 이미지 지문은 OCR/해석 텍스트로 대체하지 않는다.
- 자원할당 그래프처럼 앱의 다이어그램 렌더러가 지원하는 구조화 도표는 `passages.type: diagram`으로 작성한다.
- 도표화/코드화가 불가능하거나 원본 이미지의 세부 시각 정보 자체가 채점 단서인 불가피한 경우에만 crop 이미지 경로를 저장하고 앱에서 이미지를 렌더링한다.
- `scripts/crop-png.mjs`는 원본 이미지에서 필요한 영역을 PNG로 잘라내는 보조 도구다.
- 이미지 최적화는 초기에는 적용하지 않는다. 용량 이슈 발생 시 빌드 단계에서 WebP 변환을 추가한다.
