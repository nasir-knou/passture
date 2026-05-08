# 알고리즘 2017 기말 검증

- 대상 파일: `data/subjects/algorithms/past-exams-2017.yaml`
- 원문 이미지: `origin/17-알고리즘-3학년-3교시-(3p)-1.png`, `origin/17-알고리즘-3학년-3교시-(3p)-2.png`, `origin/17-알고리즘-3학년-3교시-(3p)-3.png`
- 공식 정답: `24334123411321241412343134111343231`
- 데이터 정답: `24334123411321241412343134111343231`
- 문항 수: 35

## 10문항 단위 대조

- 1-10번: 문제, 보기, 정답 일치 확인. 5번 곡선 선택지는 원문 판별이 필요한 시각 보기라 전체 페이지 대신 선택지 영역 크롭 이미지를 사용.
- 11-20번: 문제, 보기, 정답 일치 확인.
- 21-30번: 문제, 보기, 정답 일치 확인. 21, 23, 24, 25, 27, 28번의 트리, 그래프, 행렬은 구조화 passage로 전환.
- 31-35번: 문제, 보기, 정답 일치 확인.

## Passage 처리

- `g17-bst-delete-21`: 21번 이진 탐색 트리를 `simple-graph`로 구성.
- `g17-two-three-four-tree-23`: 23번 2-3-4 트리 원형을 `simple-graph`로 구성하고 흑적 트리 선택지는 색 상태 텍스트로 보존.
- `g17-dfs-graph-24`: 24번 DFS 그래프를 `simple-graph`로 구성.
- `g17-scc-graph-25`: 25번 방향 그래프를 `simple-graph`로 구성.
- `g17-mst-graph-27`: 27번 최소 신장 트리 그래프를 `simple-graph`로 구성.
- `g17-floyd-graph-28`: 28번 플로이드 그래프를 `simple-graph`로 구성.
- `g17-floyd-matrices-28`: 28번 초기/최종 행렬을 `data-table`로 구성.

## 이미지 처리

- `public/images/subjects/algorithms/past-exams/2017/e17-05-choices.png`: 5번의 네 곡선 선택지만 원문에서 크롭.
- 기존 페이지 전체 이미지 참조는 문제 데이터에서 제거.

## 해설 점검

- 모든 문항에 각 선택지 근거가 `선택지 n:` 형식으로 포함됨.
- 모든 문항에 `핵심 개념:` 정리가 포함됨.
- 정답 및 오답 근거 누락 없음.

## 검증 명령

- 정답 문자열, 해설 형식, 이미지 경로 검사: 통과
- `validateQuestionFile` 개별 스키마 검사: 통과

전체 `pnpm data:build`는 별도 기존 파일인 `data/subjects/algorithms/workbook.yaml`의 빈 `data-table` 열 값 문제로 이 감사 범위에서는 사용하지 않았다.
