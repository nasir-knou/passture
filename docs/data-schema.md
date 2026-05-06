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
  - id: discrete-math
    title: 이산수학
    sources: []
  - id: algorithms
    title: 알고리즘
    sources: []
  - id: java-programming
    title: Java프로그래밍
    sources: []
```

`kind` 값(`exam` | `workbook` | `lecture`)으로 출처별 UI 그룹핑(기출 탭, 교재 탭 등)을 결정한다.

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
      - id: "1"
        text: 사용자와 하드웨어 사이의 인터페이스 제공
      - id: "2"
        text: 문서 편집 기능 제공
      - id: "3"
        text: 웹 검색 결과 제공
      - id: "4"
        text: 전자우편 송수신 전용 기능 제공
    answers: ["1"]
    explanation: |
      운영체제는 사용자와 하드웨어 사이에서 자원을 관리하고 인터페이스를 제공한다.
    tags: [intro, role]

  - id: e19-02
    type: multiple-choice
    passageRefs: [g19-code-01]
    prompt: 위 코드의 출력 결과는?
    choices:
      - { id: "1", text: "0" }
      - { id: "2", text: "1" }
      - { id: "3", text: "2" }
      - { id: "4", text: "컴파일 오류" }
    answers: ["2"]
    explanation: 변수 `a`의 값 1이 출력된다.

  - id: e19-03
    type: ox
    prompt: 프로세스와 스레드는 동일한 개념이다.
    choices:
      - { id: "O", text: "O" }
      - { id: "X", text: "X" }
    answers: ["X"]
    explanation: 프로세스와 스레드는 자원 공유 범위와 독립성에서 다르다.

  - id: e19-04
    type: multi-answer            # 복수정답 문제
    allowMultiple: true
    prompt: 다음 중 운영체제의 기능으로 옳은 것을 모두 고르시오.
    choices:
      - { id: "1", text: "프로세스 관리" }
      - { id: "2", text: "메모리 관리" }
      - { id: "3", text: "전자결제 처리" }
      - { id: "4", text: "장치 관리" }
    answers: ["1", "2", "4"]
    answerKey: F                  # 출제표기 보존(선택)
    explanation: 운영체제 핵심 기능은 프로세스/메모리/장치 관리이다.
```

빌드 후 동일 구조의 JSON으로 변환된다.

## 4. 식별자 규칙

문제 `id`는 파일 안에서 유일해야 한다. 출처 종류별 접두사를 명시적으로 둔다.

- 기출: `e{yy}-{nn}` → `e17-01`, `e18-25`, `e19-23`
- 교재 워크북: `b{chapter}-{nn}` → `b01-03`, `b07-08`
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
algorithms:workbook:b03-07
```

## 5. 공통 지문 처리

공통 지문은 별도 `passages` 배열로 분리하고, 문제에서 `passageRefs` 배열로 참조한다.

이유:

- 같은 지문이 여러 문제에 반복 저장되는 것을 피할 수 있다.
- 지문 수정 시 한 곳만 고치면 된다.
- 코드 지문, 이미지 지문, 긴 설명을 구조화하기 쉽다.
- 문제 1개에 여러 지문이 함께 묶이는 경우(코드 + 입출력 표)도 배열이라 자연스럽게 처리된다.

`passageRefs`가 비어있거나 없으면 단독 문제로 취급한다.

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

| `type` | UI | 정답 판정 |
|---|---|---|
| `multiple-choice` | 라디오 버튼 | 사용자 선택 1개가 `answers[0]`과 일치하면 정답 |
| `multi-answer` | 체크박스 | 사용자 선택 집합이 `answers` 집합과 정확히 일치하면 정답 |
| `ox` | 라디오 버튼 (O/X 두 개) | `multiple-choice`와 동일 |

`allowMultiple: true`가 명시되거나 `answers.length > 1`이면 자동으로 체크박스 UI를 사용한다.

`answerKey`(예: A, B, C, F)는 출제 원본 표기를 보존하기 위한 선택 필드이며, 채점에는 사용하지 않는다.

## 7. 이미지 처리

문제 이미지는 저장소에 파일로 두고, 데이터에는 상대 경로를 기록한다.

```yaml
images:
  - path: images/subjects/operating-systems/past-exams/e19-01.png
    alt: 2019년 1번 문제 참고 이미지
```

규칙:

- 파일명에 문제 ID를 포함해 추적성을 확보한다 (`e19-01.png`, `b03-07-fig1.png`).
- 빌드 단계에서 `path` 파일이 실제 존재하는지 검증한다.
- 이미지 최적화는 초기에는 적용하지 않는다. 용량 이슈 발생 시 빌드 단계에서 WebP 변환을 추가한다.
