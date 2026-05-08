# Java Programming 2017 Past Exam Audit

Java프로그래밍 2017 기말(`data/subjects/java-programming/past-exams-2017.yaml`)을 원본 이미지(`origin/2017 - Java 기출-1.png`, `origin/2017 - Java 기출-2.png`) 및 정답표(`origin/정답.txt`)와 10문항 단위로 대조한 기록이다.

## 기준

- 원본 36~60번의 prompt, 선택지, 공통 코드/그림 지문이 YAML의 `e17-01`~`e17-25`에 같은 의미로 들어가 있어야 한다.
- 공식 정답표의 Java프로그래밍 2017 답안열 `3431232443242432422422412`와 YAML `answers`가 일치해야 한다.
- 해설은 정답 근거, 각 오답의 이유, 오답 시 필요한 개념 설명, 문제 핵심 개념 요약을 포함해야 한다.
- 코드 지문은 `code` passage로, UI 그림은 재현 가능한 `ui-window` diagram으로 작성하고, 불가피한 경우에만 이미지를 사용한다.
- 검증 단위는 원본 문항 번호 기준 10문항이다.

## 진행 현황

| 범위 | YAML ID | 원본 이미지 | 상태 | 메모 |
| --- | --- | --- | --- | --- |
| 36-45 | `e17-01`-`e17-10` | `2017 - Java 기출-1.png` | 완료 | 문제/선택지/정답 일치. 익명 클래스, 상속/인터페이스, 제네릭 지문은 code passage로 보존했다. |
| 46-55 | `e17-11`-`e17-20` | `2017 - Java 기출-1.png`, `2017 - Java 기출-2.png` | 완료 | 문제/선택지/정답 일치. Path, for-each, 컬렉션, 스레드 join/yield 지문은 code passage로 구성했다. |
| 56-60 | `e17-21`-`e17-25` | `2017 - Java 기출-2.png` | 완료 | 문제/선택지/정답 일치. AWT 체크박스 화면은 `ui-window` diagram으로, JDBC 지문은 code passage로 보존했다. |

## 검증 결과

- 문항 수: 25문항.
- YAML ID 범위: `e17-01`~`e17-25`, 원본 36~60번에 순서 대응.
- 정답 대조: YAML 답안열 `3431232443242432422422412`, 공식 정답표와 일치.
- passage 사용:
  - `g17-anonymous-class-01`: Java code.
  - `g17-inheritance-declarations-01`: Java code.
  - `g17-generics-01`: Java code.
  - `g17-thread-join-01`: Java code.
  - `g17-jdbc-01`: Java code.
  - `g17-checkbox-flow-01`: `ui-window` diagram.
- 해설 구조: 25문항 모두 선택지별 근거와 `핵심 개념:` 섹션 포함.
- 데이터 검증: 사용자 정의 YAML 검사와 `validateQuestionFile` 개별 스키마 검사 통과.

## 발견 사항

- 추가 수정 필요한 원본 불일치는 발견하지 않았다.
- Java프로그래밍 2017 기말은 이미지 사용 없이 code passage와 `ui-window` diagram으로 표현 가능하다.
