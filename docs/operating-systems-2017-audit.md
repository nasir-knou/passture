# Operating Systems 2017 Past Exam Audit

운영체제 2017 기말(`data/subjects/operating-systems/past-exams-2017.yaml`)을 원본 이미지(`origin/17-운영체제-3학년-3교시-1.png`, `origin/17-운영체제-3학년-3교시-2.png`) 및 정답표(`origin/정답.txt`)와 10문항 단위로 대조한 기록이다.

## 기준

- 원본 36~60번의 prompt, 선택지, 공통 지문이 YAML의 `e17-01`~`e17-25`에 같은 의미로 들어가 있어야 한다.
- 공식 정답표의 운영체제 2017 답안열 `4124233431124312442342131`과 YAML `answers`가 일치해야 한다.
- 해설은 정답 근거, 각 오답의 이유, 오답 시 필요한 개념 설명, 문제 핵심 개념 요약을 포함해야 한다.
- 코드, 표, 메모리 리스트, 자원할당 그래프처럼 구조화 가능한 자료는 passage/diagram으로 작성하고, 현재 diagram으로 재현하기 어려운 경우에만 이미지를 사용한다.
- 검증 단위는 원본 문항 번호 기준 10문항이다.

## 진행 현황

| 범위 | YAML ID | 원본 이미지 | 상태 | 메모 |
| --- | --- | --- | --- | --- |
| 36-45 | `e17-01`-`e17-10` | `17-운영체제-3학년-3교시-1.png` | 완료 | 문제/선택지/공통 mutex 코드 및 정답 일치. 37번 mutex 코드는 `code` passage. 40번 자원할당 그래프와 42번 변형 자원할당 그래프는 `resource-allocation-graph` diagram으로 전환. 45번 빈 공간 리스트는 `memory-free-list` diagram으로 전환. |
| 46-55 | `e17-11`-`e17-20` | `17-운영체제-3학년-3교시-1.png`, `17-운영체제-3학년-3교시-2.png` | 완료 | 문제/선택지/정답 일치. 46번은 45번과 같은 빈 공간 리스트 diagram을 공유. 50~51번 페이지 참조 조건은 text passage와 현재 시간 4 경계 점선을 포함한 타임라인 `simple-graph` diagram으로 분리. |
| 56-60 | `e17-21`-`e17-25` | `17-운영체제-3학년-3교시-2.png` | 완료 | 문제/선택지/정답 일치. 디스크 스케줄링, 분산 시스템, 보안 문항은 이미지 지문 불필요. 해설은 선택지별 근거와 핵심 개념을 포함. |

## 검증 결과

- 문항 수: 25문항.
- YAML ID 범위: `e17-01`~`e17-25`, 원본 36~60번에 순서 대응.
- 정답 대조: YAML 답안열 `4124233431124312442342131`, 공식 정답표와 일치.
- passage 사용:
  - `g17-mutex-code-01`: 코드 passage.
  - `g17-rag-01`: `resource-allocation-graph` diagram.
  - `g17-transformed-rag-01`: `resource-allocation-graph` diagram.
  - `g17-free-list-image-01`: `memory-free-list` diagram.
  - `g17-page-reference-01`: 페이지 참조 조건 text passage.
  - `g17-page-reference-timeline-01`: `simple-graph` timeline diagram.
- 해설 구조: 25문항 모두 `선택지 1:`~`선택지 4:` 근거와 `핵심 개념:` 섹션 포함.
- 빌드 검증: `pnpm data:build` 성공.

## 발견 사항

- 추가 수정 필요한 원본 불일치는 발견하지 않았다.
- 2017 운영체제 기말의 공통 지문은 모두 코드, 텍스트, diagram으로 구조화 가능하여 이미지 passage를 남기지 않았다.
