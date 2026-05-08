# Java Programming 2018 Past Exam Audit

Java프로그래밍 2018 기말(`data/subjects/java-programming/past-exams-2018.yaml`)을 원본 이미지(`origin/2018 - Java 기출-1.png`, `origin/2018 - Java 기출-2.png`, `origin/2018 - Java 기출-3.png`) 및 정답표(`origin/정답.txt`)와 10문항 단위로 대조한 기록이다.

## 기준

- 원본 36~60번의 prompt, 선택지, 공통 코드/그림 지문이 YAML의 `e18-01`~`e18-25`에 같은 의미로 들어가 있어야 한다.
- 공식 정답표의 Java프로그래밍 2018 답안열 `4324233212224142344214131`과 YAML `answers`가 일치해야 한다.
- 해설은 정답 근거, 각 오답의 이유, 오답 시 필요한 개념 설명, 문제 핵심 개념 요약을 포함해야 한다.
- 코드 지문은 `code` passage로, UI 그림은 재현 가능한 `ui-window` diagram으로 작성하고, 불가피한 경우에만 이미지를 사용한다.
- 검증 단위는 원본 문항 번호 기준 10문항이다.

## 진행 현황

| 범위 | YAML ID | 원본 이미지 | 상태 | 메모 |
| --- | --- | --- | --- | --- |
| 36-45 | `e18-01`-`e18-10` | `2018 - Java 기출-1.png`, `2018 - Java 기출-2.png` | 완료 | 문제/선택지/정답 일치. 상속/인터페이스, 재정의, 익명 클래스, 제네릭, String 지문은 code passage로 보존했다. |
| 46-55 | `e18-11`-`e18-20` | `2018 - Java 기출-2.png`, `2018 - Java 기출-3.png` | 완료 | 문제/선택지/정답 일치. 파일 채널, 컬렉션, 스레드 join/yield, AWT List 지문은 code 및 `ui-window` diagram으로 구성했다. |
| 56-60 | `e18-21`-`e18-25` | `2018 - Java 기출-3.png` | 완료 | 문제/선택지/정답 일치. GridLayout 결과, WindowEvent, JDBC 지문은 diagram/code passage로 보존했다. |

## 검증 결과

- 문항 수: 25문항.
- YAML ID 범위: `e18-01`~`e18-25`, 원본 36~60번에 순서 대응.
- 정답 대조: YAML 답안열 `4324233212224142344214131`, 공식 정답표와 일치.
- passage 사용:
  - `g18-inheritance-options-01`: Java code.
  - `g18-overriding-options-01`: Java code.
  - `g18-anonymous-class-01`: Java code.
  - `g18-string-identity-01`: Java code.
  - `g18-file-channel-01`: Java code.
  - `g18-thread-join-01`: Java code.
  - `g18-awt-list-01`: `ui-window` diagram.
  - `g18-awt-gridlayout-01`: `ui-window` diagram.
  - `g18-window-event-01`: Java code.
  - `g18-jdbc-01`: Java code.
- 해설 구조: 25문항 모두 선택지별 근거와 `핵심 개념:` 섹션 포함.
- 데이터 검증: 사용자 정의 YAML 검사와 `validateQuestionFile` 개별 스키마 검사 통과.

## 발견 사항

- 추가 수정 필요한 원본 불일치는 발견하지 않았다.
- Java프로그래밍 2018 기말은 이미지 사용 없이 code passage와 `ui-window` diagram으로 표현 가능하다.
