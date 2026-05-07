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
- TypeScript 타입과 JSON Schema로 빌드 시 검증 용이

빌드 파이프라인 동작은 [architecture.md §3](./architecture.md) 참고.

## 2. catalog.yaml

```yaml
# data/catalog.yaml
version: 1
subjects:
  - id: operating-systems
    title: 운영체제
    sources:
      - id: past-exams-2017
        title: 2017 기출
        path: subjects/operating-systems/past-exams-2017.json
        kind: exam
        year: 2017
      - id: past-exams-2018
        title: 2018 기출
        path: subjects/operating-systems/past-exams-2018.json
        kind: exam
        year: 2018
      - id: past-exams-2019
        title: 2019 기출
        path: subjects/operating-systems/past-exams-2019.json
        kind: exam
        year: 2019
      - id: workbook
        title: 교재 워크북
        path: subjects/operating-systems/workbook.json
        kind: workbook
      - id: lecture-exercises
        title: 강의 연습문제
        path: subjects/operating-systems/lecture-exercises.json
        kind: lecture
  - id: algorithms
    title: 알고리즘
    sources:
      - id: past-exams-2019
        title: 2019 기출
        path: subjects/algorithms/past-exams-2019.json
        kind: exam
        year: 2019
      - id: textbook
        title: 교재 문제
        path: subjects/algorithms/textbook.json
        kind: textbook
      - id: workbook
        title: 워크북 문제
        path: subjects/algorithms/workbook.json
        kind: workbook
      - id: lecture-exercises
        title: 강의 연습문제
        path: subjects/algorithms/lecture-exercises.json
        kind: lecture
  - id: artificial-intelligence
    title: 인공지능
    sources:
      - id: past-exams-2019
        title: 2019 기출
        path: subjects/artificial-intelligence/past-exams-2019.json
        kind: exam
        year: 2019
  - id: java-programming
    title: Java프로그래밍
    sources:
      - id: past-exams-2019
        title: 2019 기출
        path: subjects/java-programming/past-exams-2019.json
        kind: exam
        year: 2019
```

`kind` 값(`exam` | `textbook` | `workbook` | `lecture`)은 출처 라벨과 ID 검증에 사용한다. 현재 UI는 탭이 아니라 선택된 과목의 출처 체크리스트를 표시한다.

## 3. 문제 파일 구조 (YAML 저작 기준)

문제 출처별 단일 YAML 파일로 관리한다.

예: `data/subjects/operating-systems/past-exams-2019.yaml`

```yaml
subjectId: operating-systems
sourceId: past-exams-2019
title: 운영체제 2019 기출
kind: exam
year: 2019

passages:
  - id: g19-code-01
    type: code
    language: c
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
    allowMultiple: true
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
- 교재 문제: `t{chapter}-{nn}` → `t01-03`, `t07-08`
- 워크북: `b{chapter}-{nn}` → `b01-03`, `b07-08`
- 강의 연습문제: `l{lecture}-{nn}` → `l01-03`, `l07-08`

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

## 4.1 챕터 태그

교재(`kind: textbook`), 워크북(`kind: workbook`), 강의(`kind: lecture`) 출처의 문제는 `tags`에 챕터 정보를 반드시 포함한다.

- 형식: `chapter:NN` (2자리 숫자)
- 예: `chapter:01`, `chapter:07`
- 개념 태그를 대체하지 않는다. 챕터 태그와 개념 태그를 함께 둔다.
- 문제 `id`에 장/강 번호가 있더라도 `tags`에 별도로 기록한다.
- 강의 문제는 강의 회차가 아니라 해당 문제가 다루는 교재 장 기준으로 태그를 붙인다.
- 기출(`kind: exam`)은 연도/회차 기준 출처이므로 챕터 태그를 필수로 두지 않는다.

```yaml
questions:
  - id: t03-08
    type: multiple-choice
    prompt: 다음 중 동적 계획법 적용 조건으로 적절한 것은?
    choices:
      - { id: '1', text: '중복 부분 문제가 존재한다.' }
      - { id: '2', text: '항상 모든 경우를 한 번만 탐색한다.' }
      - { id: '3', text: '정렬된 배열에만 적용된다.' }
      - { id: '4', text: '그래프 문제에는 적용할 수 없다.' }
    answers: ['1']
    explanation: 동적 계획법은 중복 부분 문제와 최적 부분 구조가 있을 때 효과적이다.
    tags: [chapter:03, dynamic-programming]
```

챕터 태그는 이후 모의 시험 구성에서 문제 분포를 균일하게 잡기 위한 기준이다. 예를 들어 1장부터 7장까지 문제 풀이 대상이면, 25문항을 만들 때 가능한 한 각 장에서 비슷한 수의 문제를 뽑고 남는 문항은 보유 문제 수와 기존 배정 수를 고려해 분산한다.

## 4.2 수식 렌더링

문제 본문, 선택지, 텍스트 지문, 해설은 KaTeX 문법의 인라인/블록 수식을 지원한다.

- 인라인 수식: `$T(n)=O(n\log n)$`
- 블록 수식: `$$ ... $$`
- 수식이 없는 일반 텍스트는 HTML escape 후 그대로 표시한다.
- 수식 렌더링 실패 시 원문 수식 문자열을 안전하게 표시한다.
- 긴 수식은 모바일에서 가로 스크롤될 수 있도록 UI에서 처리한다.

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

## 4.3 선택지 이미지

선택지 자체가 그림인 문제는 `choices[].image`에 선택지별 crop 이미지를 연결한다. 선택지 텍스트는 접근성과 정답 표시를 위해 비워두지 않고 `①`, `그래프 1`처럼 짧게 유지한다.

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

도표가 문제 본문에만 필요한 경우에는 기존 `question.images` 또는 `passages.type: image`를 사용하고, 선택지마다 다른 그림을 골라야 하는 경우에만 `choices[].image`를 사용한다.

## 5. 공통 지문 처리

공통 지문은 별도 `passages` 배열로 분리하고, 문제에서 `passageRefs` 배열로 참조한다.

이유:

- 같은 지문이 여러 문제에 반복 저장되는 것을 피할 수 있다.
- 지문 수정 시 한 곳만 고치면 된다.
- 코드 지문, 이미지 지문, 긴 설명을 구조화하기 쉽다.
- 문제 1개에 여러 지문이 함께 묶이는 경우(코드 + 입출력 표)도 배열이라 자연스럽게 처리된다.
- 도표, 그래프, 표처럼 원본 이미지가 의미를 갖는 공통 지문은 텍스트로 해석해 `body`에 옮기지 않고 `type: image`와 `image.path`로 원본 crop 이미지를 참조한다.
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

`allowMultiple: true`가 명시되거나 `answers.length > 1`이면 자동으로 체크박스 UI를 사용한다.

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

콘텐츠 입력 단계에서 공식 정오표/정답표를 아직 확인하지 못한 경우에도 `answers`는 비워두지 않는다. 문제 이미지 또는 원문을 판독해 직접 풀이한 임시 정답을 기재하고, 풀이 근거를 `explanation`에 남긴다. 공식 정답 대조는 M10 정답 검증 단계에서 수행한다.

## 7. 해설 작성

`explanation`은 단순 정답 문장이 아니라 학습자가 다시 풀 때 판단 근거를 확인할 수 있는 형태로 작성한다.

작성 기준:

- 각 선택지별로 왜 정답 또는 오답인지 이유를 정리한다.
- 정답 선택지는 핵심 판단 근거를 명확히 적고, 오답 선택지는 어떤 개념 오해나 조건 불일치 때문에 틀렸는지 적는다.
- 문항의 핵심 개념에 대해 4~5줄 분량의 요약 설명을 함께 제공한다.
- 공식 정답 검증 전 임시 해설도 같은 구조로 작성하고, M10에서 공식 정답 대조 후 필요한 경우 보정한다.

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
- 시험지 전체 이미지는 공개 자산으로 쓰지 않고 필요한 코드·도표·표만 잘라 저장한다.
- 이미지 지문은 OCR/해석 텍스트로 대체하지 않는다. 원문 시각 정보가 필요한 경우 crop 이미지 경로를 저장하고 앱에서 이미지를 렌더링한다.
- `scripts/crop-png.mjs`는 원본 이미지에서 필요한 영역을 PNG로 잘라내는 보조 도구다.
- 이미지 최적화는 초기에는 적용하지 않는다. 용량 이슈 발생 시 빌드 단계에서 WebP 변환을 추가한다.
