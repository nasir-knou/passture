# 문제 데이터 기여 가이드

PASSture에 새 과목이나 문제 세트를 추가하는 방법을 설명합니다.

---

## 목차

1. [전체 흐름](#1-전체-흐름)
2. [새 과목 추가](#2-새-과목-추가)
3. [새 출처(문제 파일) 추가](#3-새-출처문제-파일-추가)
4. [문제 파일 작성법](#4-문제-파일-작성법)
5. [지문(passage) 작성법](#5-지문passage-작성법)
6. [다이어그램 타입 레퍼런스](#6-다이어그램-타입-레퍼런스)
7. [식별자 규칙](#7-식별자-규칙)
8. [해설 작성 기준](#8-해설-작성-기준)
9. [이미지 처리](#9-이미지-처리)
10. [빌드 및 검증](#10-빌드-및-검증)
11. [체크리스트](#11-체크리스트)

---

## 1. 전체 흐름

```
data/catalog.yaml           ← 과목·출처 목록 관리
data/subjects/{과목}/{출처}.yaml  ← 문제 원본
       ↓  pnpm data:build
public/data/catalog.json
public/data/subjects/{과목}/{출처}.json
```

- 문제는 **YAML로 작성**, 빌드 시 **JSON으로 변환**된다.
- 런타임에는 JSON만 사용하므로 `public/data/` 안의 파일은 직접 편집하지 않는다.
- 빌드 명령: `pnpm data:build` (개발·빌드 전 훅에서도 자동 실행됨)

---

## 2. 새 과목 추가

### 2-1. 디렉토리 생성

```
data/subjects/{새-과목-id}/
```

`{새-과목-id}`는 영어 소문자와 하이픈만 사용한다.  
예: `computer-architecture`, `data-structures`

### 2-2. catalog.yaml에 과목 등록

`data/catalog.yaml`의 `subjects` 배열에 항목을 추가한다.

```yaml
subjects:
  # ... 기존 과목 ...
  - id: computer-architecture      # 디렉토리 이름과 일치해야 함
    title: 컴퓨터구조               # 화면에 표시할 한글 제목
    sources:
      - id: past-exams-2019
        title: 2019 기말
        path: subjects/computer-architecture/past-exams-2019.json
        kind: exam
        year: 2019
```

`id`는 저장소 전체에서 유일해야 한다. 기존 과목 ID와 중복되면 빌드가 실패한다.

---

## 3. 새 출처(문제 파일) 추가

기존 과목에 새 출처를 추가하는 경우, catalog.yaml의 해당 과목 `sources` 배열에 항목을 추가한다.

### 출처 종류(kind)

| kind | 의미 | 화면 분류 | 출처명 예시 |
|------|------|-----------|-------------|
| `exam` | 기출 | 기출 | `2019 기말` |
| `textbook` | 기본서 문제 | 교재 | `기본서 문제` |
| `workbook` | 워크북 문제 | 교재 | `워크북 문제` |
| `lecture` | 강의 연습문제 | 강의 | `연습문제` |
| `intensive` | 특강 문제 | 강의 | `특강 문제` |

### catalog.yaml 예시

```yaml
- id: algorithms
  title: 알고리즘
  sources:
    - id: past-exams-2020        # 과목 안에서 유일한 ID
      title: 2020 기말
      path: subjects/algorithms/past-exams-2020.json   # .json 확장자
      kind: exam
      year: 2020                 # exam일 때만 필요
    - id: workbook
      title: 워크북 문제
      path: subjects/algorithms/workbook.json
      kind: workbook
      # year: 생략 (exam이 아니므로)
```

`path`는 `.json`으로 끝나야 한다. 빌드 스크립트가 같은 경로의 `.yaml` 파일을 자동으로 읽는다.

---

## 4. 문제 파일 작성법

파일 위치: `data/subjects/{과목}/{출처}.yaml`

### 4-1. 파일 헤더

```yaml
subjectId: algorithms          # catalog.yaml의 subject.id와 일치
sourceId: past-exams-2020      # catalog.yaml의 source.id와 일치
title: 알고리즘 2020 기말       # 파일 설명용 제목
kind: exam                     # catalog.yaml의 source.kind와 일치
year: 2020                     # exam일 때만 작성
```

### 4-2. 문제 타입

| type | UI | 정답 판정 |
|------|----|-----------|
| `multiple-choice` | 라디오 버튼 | `answers[0]`와 선택이 일치 |
| `multi-answer` | 체크박스 | 선택 집합이 `answers` 집합과 완전 일치 |
| `ox` | O / X 라디오 | `answers[0]`와 선택이 일치 |

### 4-3. 기본 문제 예시 (multiple-choice)

```yaml
questions:
  - id: e20-01
    type: multiple-choice
    prompt: 다음 중 분할 정복 알고리즘에 해당하지 않는 것은?
    choices:
      - id: '1'
        text: 퀵 정렬
      - id: '2'
        text: 병합 정렬
      - id: '3'
        text: 버블 정렬
      - id: '4'
        text: 이진 탐색
    answers: ['3']
    explanation: |
      선택지 1: 퀵 정렬은 피벗 기준으로 분할 후 재귀 정렬하므로 분할 정복이다.
      선택지 2: 병합 정렬은 반씩 나눠 정렬 후 병합하므로 분할 정복이다.
      선택지 3: 버블 정렬은 인접 원소를 반복 비교·교환하는 방식으로 분할 정복이 아니다.
      선택지 4: 이진 탐색은 범위를 절반씩 줄여 탐색하므로 분할 정복 기법이다.

      핵심 개념:
      분할 정복은 문제를 더 작은 부분으로 나누고(분할), 각각 재귀 해결 후(정복) 결합(병합)하는 패러다임이다.
    tags: [divide-and-conquer, sorting]
```

### 4-4. OX 문제

```yaml
  - id: e20-02
    type: ox
    prompt: 퀵 정렬의 최악 시간 복잡도는 $O(n \log n)$이다.
    choices:
      - { id: 'O', text: 'O' }
      - { id: 'X', text: 'X' }
    answers: ['X']
    explanation: |
      퀵 정렬의 평균은 $O(n \log n)$이지만, 피벗이 항상 최솟값이나 최댓값으로 선택되는 최악의 경우 $O(n^2)$이다.
    tags: [quick-sort, time-complexity]
```

### 4-5. 복수 정답 문제

```yaml
  - id: e20-03
    type: multi-answer
    prompt: 다음 중 안정 정렬(stable sort)에 해당하는 것을 모두 고르시오.
    choices:
      - { id: '1', text: '버블 정렬' }
      - { id: '2', text: '선택 정렬' }
      - { id: '3', text: '삽입 정렬' }
      - { id: '4', text: '병합 정렬' }
    answers: ['1', '3', '4']
    answerKey: G    # 출제 원본의 알파벳 표기 보존(선택 필드)
    explanation: |
      안정 정렬은 동일한 키 값을 가진 원소의 상대 순서를 보존하는 정렬이다.
      버블, 삽입, 병합 정렬은 안정 정렬이고 선택 정렬은 불안정 정렬이다.
    tags: [stable-sort]
```

`answerKey` 알파벳 대응표 (출제 원본에서 복수정답을 알파벳으로 표기할 때 참고):

| 알파벳 | answers |
|--------|---------|
| A | `["1", "2"]` |
| B | `["1", "3"]` |
| C | `["1", "4"]` |
| D | `["2", "3"]` |
| E | `["2", "4"]` |
| F | `["3", "4"]` |
| G | `["1", "2", "3"]` |
| H | `["1", "2", "4"]` |
| I | `["1", "3", "4"]` |
| J | `["2", "3", "4"]` |
| K | `["1", "2", "3", "4"]` |

### 4-6. 지문을 참조하는 문제

```yaml
  - id: e20-04
    type: multiple-choice
    passageRefs: [g20-code-01]       # passages.id 배열로 참조
    prompt: 위 코드의 시간 복잡도는?
    choices:
      - { id: '1', text: '$O(n)$' }
      - { id: '2', text: '$O(n \log n)$' }
      - { id: '3', text: '$O(n^2)$' }
      - { id: '4', text: '$O(2^n)$' }
    answers: ['3']
    explanation: |
      이중 루프로 n^2번 비교하므로 $O(n^2)$이다.
    tags: [time-complexity]
```

### 4-7. 수식 작성

- 인라인 수식: `$T(n) = O(n \log n)$`
- 블록 수식: `$$ ... $$`
- YAML 큰따옴표 안에서는 `\\`로 이스케이프 필요. **복잡한 수식은 작은따옴표(`'`)나 블록 문자열(`|`)을 사용**한다.
- 강조: `==핵심 문구==` → 하이라이트 렌더링

### 4-8. 태그 규칙

- 교재·워크북·강의 출처는 **`chapter:NN` 태그를 반드시 포함**한다.

```yaml
tags: [chapter:03, binary-search-tree]
```

- 기출(`kind: exam`) 문제는 `chapter` 태그가 없어도 된다.
- `chapter` 태그는 모의 시험 25문항을 장별로 균등 추출하는 데 쓰인다.

---

## 5. 지문(passage) 작성법

같은 지문을 여러 문제가 공유하거나, 코드·다이어그램·표 형태의 지문은 `passages` 배열로 분리한다.

```yaml
passages:
  - id: g20-code-01       # 'g' 접두 + 고유 식별자
    type: code
    language: python
    body: |
      def bubble_sort(arr):
          n = len(arr)
          for i in range(n):
              for j in range(n - i - 1):
                  if arr[j] > arr[j + 1]:
                      arr[j], arr[j + 1] = arr[j + 1], arr[j]
```

### passage 타입

| type | 용도 |
|------|------|
| `text` | 일반 텍스트 지문 (수식 가능) |
| `code` | 코드 지문 (`language`, `body` 필드 사용) |
| `image` | 이미지 지문 (`image.path`, `image.alt` 필드 사용) |
| `diagram` | 구조화 다이어그램 (`diagram` 필드 사용) |

#### text 지문

```yaml
  - id: g20-text-01
    type: text
    body: |
      다음 재귀식을 보고 물음에 답하시오.
      $T(n) = 2T(n/2) + \Theta(n),\ T(1) = \Theta(1)$
```

#### code 지문

```yaml
  - id: g20-code-02
    type: code
    language: java           # c, python, java, text 등
    highlights: ['return']   # 원본에서 굵게 표시된 문자열 (선택)
    body: |
      public static int binarySearch(int[] arr, int target) {
          int left = 0, right = arr.length - 1;
          while (left <= right) {
              int mid = (left + right) / 2;
              if (arr[mid] == target) return mid;
              else if (arr[mid] < target) left = mid + 1;
              else right = mid - 1;
          }
          return -1;
      }
```

#### image 지문

```yaml
  - id: g20-img-01
    type: image
    image:
      path: images/subjects/algorithms/past-exams/2020/g20-graph.png
      alt: 2020년 알고리즘 기출 그래프 지문
```

---

## 6. 다이어그램 타입 레퍼런스

다이어그램은 `passages[].diagram` 또는 `choices[].diagram`에 작성한다.

### simple-graph (일반 그래프·트리·방향 그래프)

```yaml
  - id: g20-graph-01
    type: diagram
    diagram:
      type: simple-graph
      width: 400
      height: 260
      directed: true          # 방향 그래프 전체 기본값 (선택)
      nodes:
        - { id: A, label: A, x: 200, y: 30 }
        - { id: B, label: B, x: 100, y: 120 }
        - { id: C, label: C, x: 300, y: 120 }
      edges:
        - { from: A, to: B }
        - { from: A, to: C }
        - { from: B, to: C, label: '5', directed: false }  # 개별 간선 무방향
        - { from: B, to: B, curve: 1 }                     # 자기 루프
```

**노드 필드:**

| 필드 | 필수 | 설명 |
|------|------|------|
| `id` | 필수 | 간선 참조용 ID |
| `label` | 필수 | 화면 표시 텍스트 (수식 문자열 불가) |
| `x`, `y` | 필수 | SVG 좌표 |
| `hideNode` | 선택 | 노드 도형을 숨기고 라벨만 표시 |
| `hideLabel` | 선택 | 라벨을 숨김 |
| `labelDx`, `labelDy` | 선택 | 라벨 위치 보정 |

**간선 필드:**

| 필드 | 필수 | 설명 |
|------|------|------|
| `from`, `to` | 필수 | 노드 id 참조 |
| `label` | 선택 | 간선 라벨 (수식 불가) |
| `directed` | 선택 | 개별 간선의 방향성 재정의 |
| `curve` | 선택 | 곡률 조정 (자기 루프에는 `curve: 1`) |
| `style` | 선택 | `dashed` = 점선 |

### resource-allocation-graph (자원할당 그래프)

```yaml
  - id: g20-rag-01
    type: diagram
    diagram:
      type: resource-allocation-graph
      width: 400
      height: 300
      nodes:
        - { id: p1, kind: process, label: p_1, x: 100, y: 150 }
        - { id: p2, kind: process, label: p_2, x: 300, y: 150 }
        - { id: r1, kind: resource, label: r_1, x: 200, y: 80, units: 2 }
        - { id: r2, kind: resource, label: r_2, x: 200, y: 220, units: 1 }
      edges:
        - { from: p1, to: r1 }          # 요청 간선
        - { from: r1, to: p2 }          # 할당 간선
        - { from: p2, to: r2, style: dashed }  # 선언 간선 (변형 RAG)
```

- `kind: process` → 원, `kind: resource` → 사각형으로 렌더링
- `units`: 자원 노드 안에 표시할 단위자원 수 (선택)
- 요청 간선: 프로세스 → 자원, 할당 간선: 자원 → 프로세스
- 라벨 `p_1`, `r_2`처럼 `_숫자` 형식은 하첨자로 렌더링됨

### memory-free-list (빈 공간 리스트)

```yaml
  - id: g20-freelist-01
    type: diagram
    diagram:
      type: memory-free-list
      width: 620
      height: 400
      blocks:
        - { id: os, kind: os, label: 운영체제 }
        - { id: used1, kind: allocated, label: 사용 중 }
        - { id: free1, kind: free, label: 공백 1 (40MB), size: 40 }
        - { id: used2, kind: allocated, label: 사용 중 }
        - { id: free2, kind: free, label: 공백 2 (20MB), size: 20 }
```

- `kind`: `os`, `allocated`, `free`
- `size`: 빈 공간 블록의 상대 높이 (MB 단위)

### data-table (표)

```yaml
  - id: g20-table-01
    type: diagram
    diagram:
      type: data-table
      columns: ['프로세스', '도착시간', '버스트시간']
      rows:
        - ['P1', '0', '6']
        - ['P2', '2', '4']
        - ['P3', '4', '2']
```

- 셀에 KaTeX 인라인 수식 사용 가능: `'$O(n^2)$'`
- `cellFormat: code` 지정 시 셀이 코드 블록으로 렌더링됨

### clock-page-replacement (클럭 페이지 교체 원형 큐)

```yaml
  - id: g20-clock-01
    type: diagram
    diagram:
      type: clock-page-replacement
      width: 300
      height: 300
      pointerIndex: 2          # 포인터가 가리키는 entries 인덱스
      entries:
        - { page: A, referenceBit: 1 }
        - { page: B, referenceBit: 0 }
        - { page: C, referenceBit: 1 }
        - { page: D, referenceBit: 0 }
```

### ui-window (Java AWT/Swing 창 UI)

```yaml
  - id: g20-ui-01
    type: diagram
    diagram:
      type: ui-window
      width: 300
      height: 200
      title: MyFrame
      components:
        - { kind: checkbox, label: '항목 1', x: 30, y: 60, checked: true }
        - { kind: radio, label: '선택 A', x: 30, y: 100, checked: false }
        - { kind: label, label: '라벨 텍스트', x: 30, y: 140 }
```

---

## 7. 식별자 규칙

### 문제 ID

| 출처 | 형식 | 예시 |
|------|------|------|
| 기출 | `e{yy}-{nn}` | `e20-01`, `e20-25` |
| 기본서 | `t{chapter}-{nn}` | `t03-07`, `t11-02` |
| 워크북 | `b{chapter}-{nn}` | `b03-07`, `b11-02` |
| 강의 문제 | `l{lecture}-{nn}` | `l07-08`, `l11-04` |
| 특강 문제 | `i{unit}-{nn}` | `i02-03`, `i05-01` |

### 지문(passage) ID

`g` 접두를 붙인다. 파일 안에서 유일해야 한다.

```
기출 지문:  g20-rag-01, g20-code-01
교재 지문:  gb03-fig-02, gb07-table-01
```

### 파일 내 유일성

- 문제 `id`는 같은 YAML 파일 안에서 중복되면 빌드가 실패한다.
- `passages.id`도 같은 파일 안에서 유일해야 한다.

---

## 8. 해설 작성 기준

선택지마다 정답/오답 이유를 작성하고, 핵심 개념 요약을 함께 제공한다.

```yaml
    explanation: |
      선택지 1: 버블 정렬은 인접 원소를 반복 비교하므로 분할 정복이 아니다.
      선택지 2: 퀵 정렬은 피벗 기준 분할 후 재귀하므로 분할 정복이다.
      선택지 3: 병합 정렬은 반씩 나눠 재귀 정렬 후 병합하므로 분할 정복이다.
      선택지 4: 이진 탐색은 범위를 절반씩 줄이므로 분할 정복 기법이다.

      핵심 개념:
      분할 정복은 문제를 작은 부분으로 나누고, 각각을 재귀 해결 후 결합하는 방식이다.
      퀵 정렬 O(n log n) 평균, O(n²) 최악. 병합 정렬 항상 O(n log n).
      버블/선택/삽입 정렬은 반복 비교·교환 방식으로 분할 정복과 구분된다.
```

- 오답 선택지는 "틀렸다"로 끝내지 않고, 그 개념이 무엇인지 설명하고 왜 문제 조건과 맞지 않는지 적는다.
- 약어가 핵심 판단에 등장하면 첫 언급에서 풀폼을 함께 쓴다. 예: `FCFS(First-Come, First-Served)`
- 공식 정답을 아직 확인하지 못한 경우에도 빈 칸으로 두지 말고 직접 풀이한 임시 정답과 해설을 기재한다.

---

## 9. 이미지 처리

### 이미지가 필요한 경우

구조화 다이어그램(`diagram` 타입)으로 재현하기 어렵거나 원본의 시각 정보 자체가 채점 조건인 경우에만 이미지를 사용한다.

```yaml
questions:
  - id: e20-05
    type: multiple-choice
    images:
      - path: images/subjects/algorithms/past-exams/2020/e20-05.png
        alt: 2020년 알고리즘 기출 5번 그래프
    prompt: 위 그래프에서 최단 경로는?
```

### 파일 경로 규칙

```
public/images/subjects/{과목}/{출처-유형}/{파일명}
```

예:
```
public/images/subjects/algorithms/past-exams/2020/e20-05.png
public/images/subjects/operating-systems/workbook/b07-fig1.png
```

- 파일명에 문제 ID를 포함해 추적성을 확보한다.
- 빌드 단계에서 `path`의 파일이 실제 존재하는지 검증한다.
- 이미지 crop 보조 도구: `pnpm image:crop <input> <output> <x> <y> <width> <height>`
- 시험지 전체 이미지는 저장소에 올리지 않는다.

---

## 10. 빌드 및 검증

```bash
# YAML → JSON 변환 및 검증
pnpm data:build

# 단위 테스트 (데이터 무결성 포함)
pnpm test

# 개발 서버 (public/data JSON이 없으면 YAML fallback 사용)
pnpm dev

# 프로덕션 빌드
pnpm build
```

### 빌드 시 검증 항목

- `catalog.yaml`의 `subject.id`, `source.id` 중복 검사
- `source.path`가 `.json`으로 끝나는지 확인
- `source.kind`가 유효한 값인지 확인 (`exam` | `textbook` | `workbook` | `lecture` | `intensive`)
- `passageRefs`의 모든 ID가 동일 파일의 `passages.id`에 존재하는지 확인
- `images[].path`의 파일 존재 여부 확인
- 참조되지 않는 `passages` 항목은 경고만 출력 (작업 중 임시 보존 가능)

오류 메시지가 나오면 해당 파일과 필드를 확인하고 수정한 뒤 다시 빌드한다.

---

## 11. 체크리스트

새 문제 파일을 추가할 때 아래 항목을 확인한다.

- [ ] `data/catalog.yaml`에 과목·출처가 등록되어 있다
- [ ] `subjectId`/`sourceId`/`kind`가 catalog와 일치한다
- [ ] 모든 문제 `id`가 파일 안에서 유일하다
- [ ] `passageRefs`로 참조한 `id`가 `passages` 배열에 실제로 존재한다
- [ ] `answers`가 비어있지 않다 (임시 정답이라도 반드시 기재)
- [ ] 교재·워크북·강의 출처 문제에 `chapter:NN` 태그가 있다
- [ ] 해설이 선택지별 이유 + 핵심 개념 구조로 작성되어 있다
- [ ] `images[].path`에 해당하는 파일이 `public/images/` 아래에 실제로 있다
- [ ] `pnpm data:build`가 오류 없이 완료된다
- [ ] `pnpm test`가 통과한다
