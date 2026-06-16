# 모의 시험(Simulator) 개발 계획

## 개요

방송대 IBT 기말시험 환경을 재현하는 모의 시험 모드. 기존 `#/mock-exam` 라우트(현재 placeholder)를 실제 구현으로 교체한다.

공식 튜토리얼 참고: https://ibt.knou.ac.kr/js/site/examne/tutorial/tutorial/start.html

---

## 마일스톤 추적

### M1: 기반 구조 (데이터 모델 + 라우팅) ✅

- [x] `src/lib/mock-exam-session.ts` — 타입 정의, 세션 저장/로드, 무작위 추출 로직
- [x] `src/app.ts` — `/mock-exam/test`, `/mock-exam/result` 라우트 등록
- [ ] 단위 테스트: 무작위 추출 균일 분포 검증

### M2: 설정 화면 ✅

- [x] `src/pages/mock-exam.ts` — placeholder를 설정 UI로 교체
- [x] 과목 선택 UI (최대 3과목, 체크박스)
- [x] 과목별 출처 선택 UI (선택한 과목의 source 목록)
- [x] 추출 옵션 UI (전체 / 무작위 25문제)
- [x] 시간 자동계산 표시 (과목 수 x 25분)
- [x] "시험 시작" 버튼 → config 저장 → `#/mock-exam/test` 이동

### M3: 시험 화면 — 레이아웃 & 정적 렌더링 ✅

- [x] `src/pages/mock-exam-test.ts` — 전체 레이아웃 골격
- [x] 상단 바 (로고, 제목, 퇴실 버튼, 글자 크기, 타이머 자리)
- [x] 교과목 탭 바 렌더링
- [x] 문제풀이 영역 — 문제 목록 세로 스크롤 렌더링
- [x] 정답기록 사이드바 — 시험 정보 + 문제번호 그리드 렌더링

### M4: 시험 화면 — 인터랙션 ✅

- [x] 답안 선택 → 정답기록 영역 실시간 반영
- [x] 정답기록 문제번호 클릭 → 문제풀이 영역 스크롤 이동
- [x] 교과목 탭 전환 (답안/북마크 상태 유지)
- [x] 책갈피 토글 (문제풀이 ↔ 정답기록 양방향 동기화)
- [x] 글자 크기 조절 (크게/작게)
- [x] 좌우 화면비율 조절 버튼

### M5: 시험 화면 — 타이머 & 종료 ✅

- [x] 카운트다운 타이머 (startedAt 기반, 1초 간격 갱신)
- [x] 남은시간 5분 이하 시 빨간색 경고
- [x] 시간 종료 → 자동 답안 제출 → 결과 화면 이동
- [x] "시험실 퇴실" 버튼 → 확인 모달 → 종료 처리
- [ ] 페이지 이탈 방지 (hashchange 가드)
- [x] 새로고침 시 세션 복원

### M6: 결과 화면 ✅

- [x] `src/pages/mock-exam-result.ts` — 결과 화면 구현
- [x] 교과목 탭으로 과목별 결과 전환
- [x] 과목별 점수 요약 (총 문항, 정답, 정답률)
- [x] 전체 합산 점수
- [x] 문제별 리뷰 카드 (기존 rendering.ts 재활용)

### M7: 스타일링 & 마무리 ✅

- [x] IBT 디자인 완전 재현 (아래 디자인 스펙 참조)
- [x] 퇴실 확인 커스텀 모달 다이얼로그 스타일
- [ ] 전체 동선 수동 테스트 (설정 → 시험 → 결과)
- [x] 엣지 케이스 처리 (문제 0개, 1과목만 선택 등)

### M8: 개선 및 버그 수정 (마일스톤 이후 작업)

- [x] 문제 목록에서 `[0점]` 표시 제거
- [x] 교과목 탭 양옆 여백 추가, 탭 가운데 정렬
- [x] 탭 버튼 두 줄 표시 (과목명 + 풀이수/전체)
- [x] 설정 화면 lead 문구 두 줄 분리 (`<br>`)
- [x] 정답기록 영역 답안 선택 미반영 버그 수정 (`data-answer-input` 빈 문자열 체크 오류)
- [x] 선택지에 원형 번호 표시 (1~4, 선택 시 청록 채움)
- [x] 레이아웃 토글: 세로 스크롤 ↔ 한 문제씩(가로형) 전환
- [x] 가로형 모드: 하단 네비 제거 → 문제 영역 좌우 이전/다음 사이드 버튼
- [x] 가로형 모드에서만 하단 페이지 인디케이터 표시
- [x] 책갈피 버튼 위치: 문제 텍스트 오른쪽 끝 (같은 줄)
- [x] 교과목 탭 배경색 청록 계열, 비활성 탭 회색 계열
- [x] 문제 영역이 사이드바를 침범하는 레이아웃 버그 수정 (sidebar를 flex 흐름으로 이동)
- [x] 사이드바 상단 여백 제거 (topbar/tab 높이 분리 처리)
- [x] 정답기록 시험시간 중앙 정렬
- [x] 퇴실 확인 모달 너비 `max-content`로 텍스트 한 줄 표시
- [x] 세로 스크롤 모드 문제 간 여백 및 구분선 추가

---

## 화면 구성

### 1. 설정 화면 (`#/mock-exam`)

과목/출처 선정 및 시험 구성.

**과목 선택 (최대 3과목)**

- catalog에서 과목 목록을 불러와 최대 3개까지 선택
- 각 과목마다 시험에 사용할 출처(source)를 하나 이상 선택

**문제 추출 옵션 (과목별)**

- `전체`: 선택한 출처의 모든 문제 사용
- `무작위 25문제`: 문제 ID의 접두사(b02, l03 등 → 몇 강인지)를 파싱하여 강별로 균일 분포되도록 25문제 추출

**시간 자동 계산**

- 과목 수 x 25분 (1과목=25분, 2과목=50분, 3과목=75분)
- 시작시간 13:30 고정, 종료시간 자동 계산

**시작 버튼** → `#/mock-exam/test` 로 이동

### 2. 시험 화면 (`#/mock-exam/test`)

방송대 실제 시험 UI 재현. 스크린샷(002~005.png) 기반.

#### 레이아웃

```
┌─────────────────────────────────────────────────────────────────┐
│ [로고] 20XX년 1학기 기말시험  [시험실 퇴실]   글자크게/작게  남은시간 │
├──────────────────────┬──────────────────────────────────────────┤
│  교과목A  교과목B  교과목C  │                                      │
│  (0/25)  (0/25)  (0/25)  │  시험시간(75분)                        │
├──────────────────────┤  13:30 ~ 14:45                           │
│                      │                                          │
│  문제풀이 영역         │  [모의테스트]                              │
│  (스크롤)             │  20nnnn-123456                           │
│                      │  방송대                                   │
│  1. [0점] 문제...   📑 │                                          │
│    ① 선택지1          │  정답기록 영역                             │
│    ② 선택지2          │  1 [  ] 2 [  ] 3 [  ] ...               │
│    ③ 선택지3          │                                          │
│    ④ 선택지4          │                                          │
│                      │                                          │
│  2. [0점] 문제...     │                                          │
│  ...                 │                                          │
│                      │                                          │
│  [이전]       [다음]   │                                          │
└──────────────────────┴──────────────────────────────────────────┘
```

#### 상단 바

- 좌: 방송대 로고 + "20XX년 X학기 기말시험" 텍스트
- 중: `시험실 퇴실` 버튼 (클릭 시 확인 다이얼로그)
- 우: 글자크게/글자작게 버튼, 좌우 화면비율 조절 버튼, 남은시간 카운트다운 (MM:SS:ss 형식)

#### 문제풀이 영역 (좌측)

- 상단 탭: 교과목A(풀이수/전체수), 교과목B(풀이수/전체수), 교과목C(풀이수/전체수) — 탭으로 과목 전환
- 전체 문제를 세로 스크롤로 표시 (한 번에 해당 과목 전체 문제 노출)
- 각 문제: 번호, [0점] 표시, 문제 텍스트, 4지선다 라디오 버튼
- 책갈피(북마크) 버튼: 문제 옆 깃발 아이콘, 토글 가능
- 이전/다음 화살표: 좌우 양쪽에 큰 화살표로 과목 내 페이지 이동 또는 이전/다음 문제로 스크롤
- 하단에 현재 문제 / 전체 문제 수 표시 (예: "0 / 3")

#### 정답기록 영역 (우측 사이드바)

- 시험시간 (예: 75분)
- 시험 시작시간/종료시간 (13:30 ~ 14:45)
- 응시자 정보: `[모의테스트] 20nnnn-123456 방송대`
- 문제번호 그리드: 1~25번, 각 칸에 선택한 답 표시
  - 답 미선택: 빈 칸
  - 답 선택됨: 선택한 번호(①②③④) 표시
  - 책갈피 표시: 해당 번호 옆 깃발 아이콘
- 문제번호 클릭 → 문제풀이 영역의 해당 문제로 스크롤 이동

#### 인터랙션

- 문제풀이 영역에서 답 선택 → 정답기록 영역에 실시간 반영
- 정답기록 영역 문제번호 클릭 → 문제풀이 영역 해당 문제로 스크롤
- 교과목 탭 전환 시 답안/책갈피 상태 유지
- 책갈피 토글 → 정답기록 영역에도 반영

#### 시험 종료 조건

- 남은시간 0 도달 → 자동 종료
- `시험실 퇴실` 버튼 → 확인 다이얼로그 ("시험이 종료되면 더 이상 시험을 응시 할 수 없습니다. 시험을 종료 하시겠습니까?") → 예/아니오

### 3. 결과 화면 (`#/mock-exam/result`)

기존 `#/result` 페이지와 유사하되 모의시험 맥락 추가.

- 상단에 교과목 탭으로 과목별 결과 전환
- 과목별 점수 요약 (총 문항, 정답 수, 정답률)
- 전체 합산 점수
- 문제별 정답/오답/미응답 리뷰 (기존 result 페이지 컴포넌트 재활용)

---

## 구현 계획

### Phase 1: 데이터 모델 및 세션 관리

**파일: `src/lib/mock-exam-session.ts` (신규)**

```typescript
interface MockExamConfig {
  subjects: MockExamSubject[]; // 1~3개
  totalMinutes: number; // 25/50/75
  startTime: string; // "13:30"
  endTime: string; // 계산값
}

interface MockExamSubject {
  subjectId: string;
  subjectTitle: string;
  sources: SelectedSource[];
  extractMode: 'all' | 'random-25';
}

interface MockExamSession {
  id: string;
  config: MockExamConfig;
  subjects: MockExamSubjectSession[]; // 과목별 문제/답안
  activeSubjectIndex: number;
  startedAt: string;
  bookmarks: Set<string>; // questionKey set
  status: 'in-progress' | 'finished';
}

interface MockExamSubjectSession {
  subjectId: string;
  subjectTitle: string;
  questions: QuizSessionQuestion[]; // 기존 타입 재사용
  answers: Record<string, string[]>; // questionKey → 선택한 답
}
```

- 무작위 25문제 추출 로직: 문제 ID에서 강 번호 파싱 → 강별 균일 샘플링
- sessionStorage 기반 저장 (기존 quiz-session 패턴 따름)
- 타이머 상태는 `startedAt` + `totalMinutes`로 계산 (별도 저장 불필요)

### Phase 2: 설정 화면

**파일: `src/pages/mock-exam.ts` (기존 placeholder 교체)**

- 기존 select.ts 패턴을 참고하되 다중 과목 선택 UI 구성
- 과목 선택 → 출처 선택 → 추출 옵션 선택의 단계별 UI
- 설정 완료 → MockExamConfig 생성 → sessionStorage 저장 → `#/mock-exam/test`로 이동

### Phase 3: 시험 화면

**파일: `src/pages/mock-exam-test.ts` (신규)**

주요 컴포넌트:

1. **상단 바**: 로고, 시험 제목, 퇴실 버튼, 남은시간 타이머
2. **교과목 탭**: 과목 전환 탭 바
3. **문제풀이 영역**: 전체 문제 목록 (스크롤), 선택지, 책갈피
4. **정답기록 사이드바**: 시험 정보, 문제번호 그리드

구현 포인트:

- **타이머**: `setInterval` 1초 간격, `startedAt`에서 경과 시간 계산, 남은시간 표시
- **2-column 레이아웃**: CSS Grid 기반 (`grid-template-columns: 1fr 300px`)
- **과목 전환**: 탭 클릭 → `activeSubjectIndex` 변경 → 좌측 영역만 re-render
- **답안 동기화**: 좌측 라디오 변경 → 우측 그리드 즉시 업데이트 (DOM 직접 조작으로 전체 re-render 회피)
- **스크롤 연동**: 우측 문제번호 클릭 → `element.scrollIntoView({ behavior: 'smooth' })`
- **퇴실 확인**: `confirm()` 또는 커스텀 모달 다이얼로그
- **시간 종료**: 타이머 0 도달 → 자동으로 답안 제출 및 결과 화면 이동
- **글자 크기 조절**: CSS 변수 `--exam-font-size` 조절

### Phase 4: 결과 화면

**파일: `src/pages/mock-exam-result.ts` (신규)**

- 기존 `result.ts`의 `renderReviewCard`, `renderResultNavigator` 등을 재활용
- 과목별 탭 + 과목별 점수 + 전체 합산 점수
- `rendering.ts`의 공용 렌더링 함수 활용

### Phase 5: 라우팅 연결

**파일: `src/app.ts` 수정**

```typescript
'/mock-exam': async () => renderMockExamPage(await loadCatalog()),
'/mock-exam/test': async () => renderMockExamTestPage(),
'/mock-exam/result': async () => renderMockExamResultPage(),
```

### Phase 6: 스타일링

**파일: `src/styles.css` 또는 별도 `src/mock-exam.css`**

아래 "디자인 스펙" 섹션의 색상/사이즈를 정확히 적용한다.

---

## 기존 코드 재활용 항목

| 기존 모듈             | 재활용 내용                                                                       |
| --------------------- | --------------------------------------------------------------------------------- |
| `lib/quiz-session.ts` | `QuizSessionQuestion`, `QuizResponse` 타입, `createQuizSession` 로직 참고         |
| `lib/data-loader.ts`  | `loadQuestionFile`, `loadCatalog`                                                 |
| `lib/scorer.ts`       | `isCorrectAnswer`                                                                 |
| `lib/storage.ts`      | 북마크/오답 기록 (선택적)                                                         |
| `pages/rendering.ts`  | `renderPassages`, `renderChoiceContent`, `renderRichText`, `renderQuestionImages` |
| `pages/result.ts`     | `renderReviewCard` 패턴 참고                                                      |
| `pages/shared.ts`     | `escapeHtml`                                                                      |

## 신규 파일 목록

| 파일                            | 설명                                                 |
| ------------------------------- | ---------------------------------------------------- |
| `src/lib/mock-exam-session.ts`  | 모의시험 세션 데이터 모델, 저장/로드, 문제 추출 로직 |
| `src/pages/mock-exam-test.ts`   | 시험 화면 렌더링 및 이벤트                           |
| `src/pages/mock-exam-result.ts` | 결과 화면 렌더링                                     |

## 수정 파일 목록

| 파일                     | 변경 내용                                          |
| ------------------------ | -------------------------------------------------- |
| `src/pages/mock-exam.ts` | placeholder → 설정 화면 구현                       |
| `src/app.ts`             | `/mock-exam/test`, `/mock-exam/result` 라우트 추가 |
| `src/styles.css`         | 시험 화면 전용 스타일 추가                         |

---

## 무작위 추출 알고리즘

문제 ID 형식: `e17-01`, `b02-03`, `l03-05` 등에서 숫자 부분을 파싱하여 "강(lecture)" 그룹 식별.

```
1. 모든 문제를 강 번호별로 그룹핑
2. 총 25문제를 강 수로 나눠 기본 할당량 결정 (floor)
3. 나머지는 문제 수가 많은 강부터 1개씩 추가 할당
4. 각 강 내에서 할당량만큼 무작위 추출
5. 강 순서대로 정렬하여 최종 문제 목록 생성
```

---

## 디자인 스펙 (스크린샷 002~005.png 기반)

### CSS 변수

```css
:root {
  /* 상단 바 */
  --exam-topbar-bg: #3b3b3b; /* 진한 차콜 (거의 검정) */
  --exam-topbar-text: #ffffff; /* 흰색 텍스트 */
  --exam-topbar-height: 44px;

  /* 시험실 퇴실 버튼 */
  --exam-exit-bg: #4a9a8f; /* 청록/틸 */
  --exam-exit-text: #ffffff;
  --exam-exit-border: #3d8379;
  --exam-exit-hover-bg: #3d8379;

  /* 글자 크기 조절 버튼 */
  --exam-font-control-text: #b0b0b0; /* 밝은 회색 */
  --exam-font-control-icon: #cccccc;

  /* 타이머 */
  --exam-timer-text: #ffffff;
  --exam-timer-bg: #2a2a2a; /* 상단 바보다 약간 더 어두운 배경 */
  --exam-timer-warning: #e53e3e; /* 5분 이하 시 빨간색 */

  /* 교과목 탭 */
  --exam-tab-bg: #f5f5f5; /* 연한 회색 배경 */
  --exam-tab-border: #cccccc;
  --exam-tab-active-bg: #ffffff; /* 활성 탭: 흰색 */
  --exam-tab-active-border: #333333; /* 활성 탭: 진한 하단 테두리 */
  --exam-tab-active-text: #000000;
  --exam-tab-inactive-text: #666666;

  /* 문제풀이 영역 (좌측) */
  --exam-question-bg: #ffffff;
  --exam-question-text: #1a1a1a;
  --exam-question-number-weight: bold;
  --exam-question-border: #e0e0e0;
  --exam-question-prompt-size: 16px;

  /* 선택지 */
  --exam-choice-text: #333333;
  --exam-choice-hover-bg: #f0f0f0;
  --exam-choice-selected-bg: #e8f4fd; /* 선택 시 연한 파란 배경 */
  --exam-choice-circle-color: #333333; /* ①②③④ 원문자 색상 */

  /* 책갈피(북마크) 아이콘 */
  --exam-bookmark-inactive: #d4a843; /* 비활성: 연한 주황/금색 테두리 */
  --exam-bookmark-active: #e8952e; /* 활성: 진한 주황/오렌지 채움 */
  --exam-bookmark-size: 24px;

  /* 이전/다음 화살표 */
  --exam-nav-arrow-color: #b0b0b0; /* 연한 회색 */
  --exam-nav-arrow-hover: #666666;
  --exam-nav-arrow-size: 48px;

  /* 페이지 인디케이터 */
  --exam-page-indicator-text: #888888;
  --exam-page-indicator-bg: #e0e0e0;

  /* 정답기록 사이드바 (우측) */
  --exam-sidebar-bg: #b8b8b8; /* 중간 회색 배경 */
  --exam-sidebar-width: 280px;
  --exam-sidebar-header-text: #333333;
  --exam-sidebar-border: #a0a0a0;

  /* 사이드바 시험 정보 영역 */
  --exam-info-bg: #d0d0d0; /* 약간 밝은 회색 */
  --exam-info-text: #222222;
  --exam-info-label-text: #555555;

  /* 정답기록 그리드 (문제번호 테이블) */
  --exam-grid-bg: #ffffff; /* 셀 배경: 흰색 */
  --exam-grid-border: #999999; /* 셀 테두리: 중간 회색 */
  --exam-grid-number-bg: #d8d8d8; /* 번호 칸 배경: 연한 회색 */
  --exam-grid-number-text: #000000;
  --exam-grid-answer-text: #0066cc; /* 입력된 답 표시: 파란색 */
  --exam-grid-cell-height: 32px;
  --exam-grid-number-width: 32px;
  --exam-grid-answer-width: 120px;

  /* 정답기록 그리드 - 책갈피 표시 */
  --exam-grid-bookmark-color: #e8952e; /* 주황색 깃발 */

  /* 퇴실 확인 모달 */
  --exam-modal-overlay: rgba(0, 0, 0, 0.5);
  --exam-modal-bg: #ffffff;
  --exam-modal-border: #cccccc;
  --exam-modal-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  --exam-modal-title-text: #333333;
  --exam-modal-body-text: #555555;
  --exam-modal-btn-yes-border: #e8952e; /* "예" 버튼: 주황 원형 테두리 */
  --exam-modal-btn-yes-text: #333333;
  --exam-modal-btn-no-text: #333333;

  /* 좌우 비율 조절 버튼 */
  --exam-resize-btn-bg: #4a9a8f; /* 퇴실 버튼과 동일 청록 */
  --exam-resize-btn-text: #ffffff;

  /* 글자 크기 단계 */
  --exam-font-size-default: 16px;
  --exam-font-size-large: 18px;
  --exam-font-size-small: 14px;
}
```

### 상단 바 상세

```
높이: 44px, 고정(sticky)
배경: #3b3b3b (진한 차콜)
┌────────────────────────────────────────────────────────────────────┐
│ [⊕로고]  20XX년 1학기 기말시험   ┌시험실 퇴실┐  글자크게⊕ 글자작게⊖  [↔]  남은시간  00:00:00 │
│  흰색     흰색 bold              │청록 bg    │  #b0b0b0 텍스트    청록   "남은" #fff   │
│                                  │#4a9a8f    │                    btn    시간"  타이머  │
│                                  └──────────┘                           #b0b0b0 #fff bold │
└────────────────────────────────────────────────────────────────────┘
```

- 로고: 방송대 원형 로고 (SVG/이미지), 흰색, 약 28x28px
- "20XX년 1학기 기말시험": 흰색, font-weight bold, ~16px
- "시험실 퇴실" 버튼: 배경 `#4a9a8f`, 흰색 텍스트, border-radius 4px, padding 6px 16px
- "글자크게 ⊕ / 글자작게 ⊖": `#b0b0b0` 텍스트, 14px
- `[↔]` 화면비율 버튼: 청록 `#4a9a8f` 배경, 흰 아이콘, 정사각 32x32
- "남은시간" 라벨: `#b0b0b0`, 14px
- 타이머 숫자 `00:00:00`: 흰색, font-weight bold, font-size 20px, font-family monospace

### 교과목 탭 바 상세

```
높이: ~40px
배경: #f5f5f5
하단 테두리: 1px solid #cccccc
┌──────────┬──────────┬──────────┐
│ 교과목A   │ 교과목B   │ 교과목C   │  ← 활성 탭: 흰 배경, 진한 하단 보더 3px #333
│  (2/3)   │  (0/4)   │  (0/2)   │  ← 비활성: #f5f5f5 배경, #666 텍스트
└──────────┴──────────┴──────────┘
```

- 활성 탭: 배경 `#ffffff`, border-bottom `3px solid #333333`, 텍스트 `#000000` bold
- 비활성 탭: 배경 `#f5f5f5`, 텍스트 `#666666`
- 진행률 표시: 교과목명 아래 `(풀이수/전체수)` — 같은 색상, font-size 13px

### 문제풀이 영역 상세

```
배경: #ffffff
좌우 패딩: 40px
```

- 문제 번호: `font-weight: bold`, `font-size: 18px`, `color: #1a1a1a`
- `[0점]` 표시: 문제 번호 바로 뒤, 같은 줄, `color: #1a1a1a`
- 문제 텍스트(prompt): `font-size: 16px`, `color: #1a1a1a`, `line-height: 1.6`
- 인용문 박스 (지문): `border: 1px solid #333`, `padding: 16px`, `background: #ffffff`, `font-size: 15px`
- 선택지 ①②③④: `font-size: 16px`, `color: #333`, 각 선택지 행 높이 36px, 선택 시 배경 `#e8f4fd`
- 책갈피 아이콘: 문제 우측 상단, 깃발 모양
  - 비활성: `#d4a843` 테두리만 (빈 깃발)
  - 활성: `#e8952e` 채움 (주황 깃발)
- 이전/다음 화살표: 문제 영역 좌우 바깥, `<` `>` 형태의 큰 회색 화살표
  - 색상: `#b0b0b0`, hover시 `#666666`
  - 높이: 전체 문제 영역 높이의 중앙
  - "이전" / "다음" 텍스트 포함
- 하단 페이지 인디케이터: 중앙 정렬, `0 / 3` 형식, 배경 `#e0e0e0`, padding 4px 12px, border-radius 12px

### 정답기록 사이드바 상세

```
폭: 280px, 고정
배경: #b8b8b8 (중간 회색)
우측에 위치
```

#### 시험 정보 영역 (사이드바 상단)

```
배경: #d0d0d0
패딩: 16px
테두리: 1px solid #a0a0a0
```

- "시험시간(75분)": `font-weight: bold`, `color: #222`, `font-size: 15px`
- "13:30 ~ 14:45": `color: #555`, `font-size: 14px`
- 구분선: `1px solid #a0a0a0`
- "[모의테스트]": `color: #333`, `font-size: 13px`
- "202104-123456": `font-weight: bold`, `color: #000`, `font-size: 16px`
- "방송대": `font-weight: bold`, `color: #000`, `font-size: 15px`

#### 정답기록 그리드 (문제번호 테이블)

```
배경: 사이드바 배경과 동일
각 행: 번호칸 + 답안칸 (+책갈피 아이콘)
```

- 행 구조: `[번호] [답안 입력값] [책갈피?]`
- 번호 칸: 폭 32px, 배경 `#d8d8d8`, 텍스트 `#000` bold, 테두리 `1px solid #999`
- 답안 칸: 폭 나머지, 배경 `#ffffff`, 높이 32px, 테두리 `1px solid #999`
  - 미선택: 빈 칸
  - 선택됨: 답번호를 파란 원 안에 표시 — 원 배경 `#6baed6` (하늘색), 텍스트 `#fff`, border-radius 50%, 크기 22px
- 책갈피 표시: 행 우측에 작은 주황 깃발 아이콘 `#e8952e`, 크기 16px
- 현재 문제 행: 좌측 테두리 `3px solid #e8952e` (주황색 강조)
- 클릭 가능: cursor: pointer, hover 시 행 배경 `#eaeaea`

### 퇴실 확인 모달 상세

```
오버레이: rgba(0, 0, 0, 0.5)
모달 박스: 배경 #fff, 테두리 #ccc, box-shadow, border-radius 8px
폭: 400px, 중앙 정렬
```

- 헤더: `ⓘ 알림` — 아이콘 파란색 `#3388cc`, 텍스트 `#333`, font-weight bold
- 본문: "시험이 종료되면 더 이상 시험을 응시 할 수 없습니다.\n시험을 종료 하시겠습니까?"
  - `color: #555`, `font-size: 15px`, `line-height: 1.5`
- 버튼 영역: 우측 정렬
  - "예" 버튼: `border: 2px solid #e8952e` (주황 원형 테두리), `border-radius: 50%`, 크기 40x40, `color: #333`
  - "아니오" 버튼: 텍스트만, `color: #333`, `font-size: 14px`

### 전체 레이아웃 치수

```
전체 화면: 100vw x 100vh (스크롤 없음, 내부 스크롤만)
상단 바: height 44px, position fixed, z-index 100
교과목 탭: height 40px, position fixed, top 44px
문제풀이 영역: top 84px, left 0, right 280px, bottom 0, overflow-y auto
정답기록 사이드바: top 44px, right 0, width 280px, bottom 0, overflow-y auto
```

---

## 주의사항

- 시험 중 새로고침 시 세션 복원 (sessionStorage 기반)
- 시험 중 다른 페이지 이동 방지 (hashchange 이벤트에서 확인)
- 타이머는 탭 비활성화 시에도 정확해야 함 (`startedAt` 기준 계산 방식으로 해결)
- 기존 quiz 세션과 mock-exam 세션은 별도 키로 관리하여 충돌 방지
