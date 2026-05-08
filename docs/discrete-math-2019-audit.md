# Discrete Math 2019 Past Exam Audit

이산수학 2019 기말(`data/subjects/discrete-math/past-exams-2019.yaml`)을 원본 이미지(`origin/19-이산수학-2학년-2교시-1.png`, `origin/19-이산수학-2학년-2교시-2.png`) 및 정답표(`origin/정답.txt`)와 10문항 단위로 대조한 기록이다.

## 기준

- 원본 36~60번의 prompt, 선택지, 공통 지문이 YAML의 `e19-01`~`e19-25`에 같은 의미로 들어가 있어야 한다.
- 공식 정답표의 이산수학 2019 답안열 `3241232144314214344332132`와 YAML `answers`가 일치해야 한다.
- 해설은 정답 근거, 각 오답의 이유, 오답 시 필요한 개념 설명, 문제 핵심 개념 요약을 포함해야 한다.
- 행렬, 그래프, 표, 트리, 오토마타처럼 구조화 가능한 자료는 passage/diagram으로 작성하고, 불가피한 경우에만 이미지를 사용한다.
- 검증 단위는 원본 문항 번호 기준 10문항이다.

## 진행 현황

| 범위 | YAML ID | 원본 이미지 | 상태 | 메모 |
| --- | --- | --- | --- | --- |
| 36-45 | `e19-01`-`e19-10` | `19-이산수학-2학년-2교시-1.png` | 완료 | 문제/선택지/정답 일치. 47~48번 행렬은 text passage로 구조화했다. |
| 46-55 | `e19-11`-`e19-20` | `19-이산수학-2학년-2교시-1.png`, `19-이산수학-2학년-2교시-2.png` | 완료 | 문제/선택지/정답 일치. 49~51번 관계 그래프는 `simple-graph`, 55번 그래프는 `simple-graph`로 구성했다. |
| 56-60 | `e19-21`-`e19-25` | `19-이산수학-2학년-2교시-2.png` | 완료 | 문제/선택지/정답 일치. 56번 완전그래프, 58번 허프만 표/트리, 60번 오토마타는 diagram/data-table로 보존했다. |

## 검증 결과

- 문항 수: 25문항.
- YAML ID 범위: `e19-01`~`e19-25`, 원본 36~60번에 순서 대응.
- 정답 대조: YAML 답안열 `3241232144314214344332132`, 공식 정답표와 일치.
- passage 사용:
  - `g19-matrix-01`: text.
  - `g19-relation-graph-desc-01`: text.
  - `g19-relation-graph-01`: `simple-graph` diagram.
  - `g19-graph-triangle-01`: `simple-graph` diagram.
  - `g19-graph-k4-01`: `simple-graph` diagram.
  - `g19-huffman-frequency-table-01`: `data-table` diagram.
  - `g19-huffman-tree-01`: `simple-graph` diagram.
  - `g19-dfa-01`: `simple-graph` diagram.
- 해설 구조: 25문항 모두 `선택지 1:`~`선택지 4:` 근거와 `핵심 개념:` 섹션 포함.
- 데이터 검증: 사용자 정의 YAML 검사와 `validateQuestionFile` 개별 스키마 검사 통과.

## 발견 사항

- 추가 수정 필요한 원본 불일치는 발견하지 않았다.
- 이산수학 2019 기말은 이미지 사용 없이 텍스트, data-table, simple-graph diagram으로 표현 가능하다.
