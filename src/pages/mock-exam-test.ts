import {
  createMockExamSession,
  finishSession,
  formatCountdown,
  getAnsweredCount,
  getRemainingSeconds,
  loadMockExamConfig,
  loadMockExamSession,
  saveMockExamSession,
  setActiveSubject,
  setAnswer,
  toggleBookmark,
  type MockExamSession,
  type MockExamSubjectSession,
} from '../lib/mock-exam-session';
import type { QuizSessionQuestion } from '../lib/quiz-session';
import { escapeHtml } from './shared';
import { renderPassages, renderChoiceContent, renderRichText, renderQuestionImages } from './rendering';

let timerInterval: ReturnType<typeof setInterval> | null = null;

export async function renderMockExamTestPage(): Promise<HTMLElement> {
  const page = document.createElement('div');
  page.className = 'exam-shell';

  // 세션 복원 또는 신규 생성
  let session = loadMockExamSession();

  if (!session || session.status === 'finished') {
    const config = loadMockExamConfig();
    if (!config) {
      page.innerHTML = `
        <div class="exam-error">
          <p>시험 설정을 찾을 수 없습니다.</p>
          <a href="#/mock-exam">모의 시험 설정으로 이동</a>
        </div>
      `;
      return page;
    }
    session = await createMockExamSession(config);
  }

  mountExam(page, session);
  return page;
}

function mountExam(page: HTMLElement, session: MockExamSession): void {
  renderExam(page, session);
  startTimer(page, session);
}

// 레이아웃 모드: 'scroll' = 세로 스크롤 전체, 'paged' = 한 문제씩
type LayoutMode = 'scroll' | 'paged';
let layoutMode: LayoutMode = 'scroll';
let pagedIndex = 0;

function renderExam(page: HTMLElement, session: MockExamSession): void {
  const subjectSession = session.subjects[session.activeSubjectIndex];
  if (!subjectSession) return;

  // paged 모드에서 탭 전환 시 인덱스 초기화
  if (pagedIndex >= subjectSession.questions.length) pagedIndex = 0;

  const total = subjectSession.questions.length;

  page.innerHTML = `
    ${renderTopBar(session)}
    <div class="exam-body">
      <div class="exam-main">
        ${renderSubjectTabs(session)}
        <div class="exam-question-wrapper">
          ${layoutMode === 'paged' ? `
            <button class="exam-side-btn exam-side-btn--prev" type="button" data-paged-prev ${pagedIndex === 0 ? 'disabled' : ''} aria-label="이전 문제">
              <span>이전</span>
            </button>
          ` : ''}
          <div class="exam-question-area ${layoutMode === 'paged' ? 'is-paged' : ''}" data-question-area>
            ${layoutMode === 'scroll'
              ? renderQuestionList(subjectSession, session)
              : renderPagedQuestion(subjectSession, session, pagedIndex)}
          </div>
          ${layoutMode === 'paged' ? `
            <button class="exam-side-btn exam-side-btn--next" type="button" data-paged-next ${pagedIndex === total - 1 ? 'disabled' : ''} aria-label="다음 문제">
              <span>다음</span>
            </button>
          ` : ''}
        </div>
        ${layoutMode === 'paged' ? `
          <div class="exam-page-indicator">
            <span>${pagedIndex + 1} / ${total}</span>
          </div>
        ` : ''}
      </div>
      <aside class="exam-sidebar" aria-label="정답기록">
        ${renderSidebar(session)}
      </aside>
    </div>
    ${renderExitModal()}
  `;

  bindExamEvents(page, session);
}

function renderPagedQuestion(
  subjectSession: MockExamSubjectSession,
  session: MockExamSession,
  index: number,
): string {
  const q = subjectSession.questions[index];
  if (!q) return '';
  return renderQuestionItem(q, index, subjectSession, session);
}


// ─── 상단 바 ─────────────────────────────────────────────────────────────

function renderTopBar(session: MockExamSession): string {
  const remaining = getRemainingSeconds(session);
  const isWarning = remaining <= 300; // 5분 이하

  return `
    <header class="exam-topbar" role="banner">
      <div class="exam-topbar-left">
        <span class="exam-logo" aria-hidden="true">
          <svg width="28" height="28" viewBox="0 0 28 28" fill="none" aria-hidden="true">
            <circle cx="14" cy="14" r="13" stroke="white" stroke-width="2"/>
            <text x="14" y="19" text-anchor="middle" fill="white" font-size="12" font-weight="bold">방</text>
          </svg>
        </span>
        <span class="exam-title">20XX년 1학기 기말시험</span>
        <button class="exam-exit-btn" type="button" data-exit-btn>시험실 퇴실</button>
      </div>
      <div class="exam-topbar-right">
        <button class="exam-font-btn" type="button" data-font-increase title="글자 크게">글자크게 ⊕</button>
        <button class="exam-font-btn" type="button" data-font-decrease title="글자 작게">글자작게 ⊖</button>
        <button class="exam-layout-btn ${layoutMode === 'paged' ? 'is-active' : ''}" type="button" data-layout-toggle title="${layoutMode === 'paged' ? '세로 스크롤 모드로 전환' : '한 문제씩 보기로 전환'}">${layoutMode === 'paged' ? '⇕' : '↔'}</button>
        <div class="exam-timer-block">
          <span class="exam-timer-label">남은시간</span>
          <span class="exam-timer ${isWarning ? 'is-warning' : ''}" data-timer>
            ${formatCountdown(remaining)}
          </span>
        </div>
      </div>
    </header>
  `;
}

// ─── 교과목 탭 ────────────────────────────────────────────────────────────

function renderSubjectTabs(session: MockExamSession): string {
  return `
    <div class="exam-tabs" role="tablist" aria-label="교과목 선택">
      ${session.subjects
        .map(
          (subject, index) => `
            <button
              class="exam-tab ${index === session.activeSubjectIndex ? 'is-active' : ''}"
              role="tab"
              aria-selected="${index === session.activeSubjectIndex}"
              type="button"
              data-tab-index="${index}"
            >
              <span class="exam-tab-title">${escapeHtml(subject.subjectTitle)}</span>
              <span class="exam-tab-count">(${getAnsweredCount(subject)}/${subject.questions.length})</span>
            </button>
          `,
        )
        .join('')}
    </div>
  `;
}

// ─── 문제 목록 (세로 스크롤) ──────────────────────────────────────────────

function renderQuestionList(subjectSession: MockExamSubjectSession, session: MockExamSession): string {
  return subjectSession.questions
    .map((q, index) => renderQuestionItem(q, index, subjectSession, session))
    .join('');
}

function renderQuestionItem(
  q: QuizSessionQuestion,
  index: number,
  subjectSession: MockExamSubjectSession,
  session: MockExamSession,
): string {
  const selected = subjectSession.answers[q.key] ?? [];
  const isBookmarked = session.bookmarks.includes(q.key);
  const isMulti = q.question.type === 'multi-answer' || q.question.answers.length > 1;

  return `
    <article
      class="exam-question-item"
      id="exam-q-${index}"
      data-question-key="${escapeHtml(q.key)}"
    >
      ${renderPassages(q.passages)}
      <div class="exam-question-header">
        <p class="exam-question-prompt"><strong class="exam-question-number">${index + 1}.</strong> ${renderRichText(q.question.prompt)}</p>
        <button
          class="exam-bookmark-btn ${isBookmarked ? 'is-active' : ''}"
          type="button"
          data-bookmark-btn
          data-question-key="${escapeHtml(q.key)}"
          aria-label="${isBookmarked ? '책갈피 해제' : '책갈피 추가'}"
          aria-pressed="${isBookmarked}"
        >
          <svg width="18" height="22" viewBox="0 0 20 24" fill="${isBookmarked ? '#e8952e' : 'none'}" stroke="${isBookmarked ? '#e8952e' : '#d4a843'}" stroke-width="2">
            <path d="M2 2h16v20l-8-5-8 5V2z"/>
          </svg>
        </button>
      </div>
      ${renderQuestionImages(q.question.images ?? [])}
      <fieldset class="exam-choice-list">
        <legend class="sr-only">선택지</legend>
        ${q.choices
          .map(
            (choice, choiceIndex) => `
              <label class="exam-choice-row ${selected.includes(choice.id) ? 'is-selected' : ''}">
                <input
                  type="${isMulti ? 'checkbox' : 'radio'}"
                  name="exam-answer-${escapeHtml(q.key)}"
                  value="${escapeHtml(choice.id)}"
                  ${selected.includes(choice.id) ? 'checked' : ''}
                  data-answer-input="1"
                  data-question-key="${escapeHtml(q.key)}"
                />
                <span class="exam-choice-number">${choiceIndex + 1}</span>
                ${renderChoiceContent(choice)}
              </label>
            `,
          )
          .join('')}
      </fieldset>
    </article>
  `;
}

// ─── 정답기록 사이드바 ────────────────────────────────────────────────────

function renderSidebar(session: MockExamSession): string {
  const subjectSession = session.subjects[session.activeSubjectIndex];

  return `
    <div class="exam-sidebar-info">
      <div class="exam-time-info">
        <p class="exam-time-label">시험시간(${session.config.totalMinutes}분)</p>
        <p class="exam-time-range">${session.config.startTime} ~ ${session.config.endTime}</p>
      </div>
      <hr class="exam-sidebar-divider" />
      <div class="exam-examinee-info">
        <p class="exam-examinee-tag">[모의테스트]</p>
        <p class="exam-examinee-id">20nnnn-123456</p>
        <p class="exam-examinee-school">방송대</p>
      </div>
    </div>
    <div class="exam-answer-grid" data-answer-grid>
      ${subjectSession ? renderAnswerGrid(subjectSession, session) : ''}
    </div>
  `;
}

function renderAnswerGrid(subjectSession: MockExamSubjectSession, session: MockExamSession): string {
  return subjectSession.questions
    .map((q, index) => {
      const selected = subjectSession.answers[q.key] ?? [];
      const isBookmarked = session.bookmarks.includes(q.key);
      const answerDisplay = selected.length > 0
        ? `<span class="exam-grid-answer-circle">${selected.map((id) => circledNumber(id)).join('')}</span>`
        : '';

      return `
        <div
          class="exam-grid-row ${isBookmarked ? 'has-bookmark' : ''}"
          data-grid-row
          data-question-key="${escapeHtml(q.key)}"
          data-question-index="${index}"
          role="button"
          tabindex="0"
          aria-label="${index + 1}번 문제로 이동"
        >
          <span class="exam-grid-num">${index + 1}</span>
          <span class="exam-grid-answer">${answerDisplay}</span>
          ${isBookmarked ? '<span class="exam-grid-bookmark" aria-hidden="true">🚩</span>' : ''}
        </div>
      `;
    })
    .join('');
}

function circledNumber(id: string): string {
  const map: Record<string, string> = {
    '1': '①', '2': '②', '3': '③', '4': '④', '5': '⑤',
  };
  return map[id] ?? id;
}

// ─── 퇴실 확인 모달 ──────────────────────────────────────────────────────

function renderExitModal(): string {
  return `
    <div class="exam-modal-overlay" data-exit-modal hidden role="dialog" aria-modal="true" aria-labelledby="exit-modal-title">
      <div class="exam-modal">
        <div class="exam-modal-header">
          <span class="exam-modal-icon" aria-hidden="true">ⓘ</span>
          <strong id="exit-modal-title">알림</strong>
        </div>
        <div class="exam-modal-body">
          <p>시험이 종료되면 더 이상 시험을 응시 할 수 없습니다.</p>
          <p>시험을 종료 하시겠습니까?</p>
        </div>
        <div class="exam-modal-actions">
          <button class="exam-modal-btn-cancel" type="button" data-modal-cancel>아니오</button>
          <button class="exam-modal-btn-confirm" type="button" data-modal-confirm>예</button>
        </div>
      </div>
    </div>
  `;
}

// ─── 이벤트 바인딩 ────────────────────────────────────────────────────────

function bindExamEvents(page: HTMLElement, initialSession: MockExamSession): void {
  let session = initialSession;

  // 답안 선택
  page.addEventListener('change', (e) => {
    const input = e.target as HTMLInputElement;
    if (!('answerInput' in input.dataset)) return;

    const key = input.dataset.questionKey ?? '';
    const isMulti = input.type === 'checkbox';

    let selected: string[];
    if (isMulti) {
      const checked = Array.from(
        page.querySelectorAll<HTMLInputElement>(
          `input[data-answer-input][data-question-key="${CSS.escape(key)}"]:checked`,
        ),
      ).map((el) => el.value);
      selected = checked;
    } else {
      selected = input.checked ? [input.value] : [];
    }

    session = setAnswer(session, key, selected);
    refreshGridRow(page, session, key);
    refreshTabCounts(page, session);
    refreshChoiceHighlight(page, key, selected);
    refreshPageIndicator(page, session);
  });

  // 책갈피 버튼
  page.addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-bookmark-btn]');
    if (!btn) return;
    const key = btn.dataset.questionKey ?? '';
    session = toggleBookmark(session, key);
    refreshBookmarkBtn(page, key, session.bookmarks.includes(key));
    refreshGridRow(page, session, key);
  });

  // 탭 전환
  page.addEventListener('click', (e) => {
    const tab = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-tab-index]');
    if (!tab) return;
    const index = Number(tab.dataset.tabIndex);
    session = setActiveSubject(session, index);
    pagedIndex = 0;
    rerenderQuestionArea(page, session);
    rerenderTabs(page, session);
    rerenderSidebar(page, session);
    refreshPageIndicator(page, session);
  });

  // 그리드 행 클릭 → 문제로 이동
  const goToQuestion = (index: number) => {
    if (layoutMode === 'paged') {
      pagedIndex = index;
      renderExam(page, session);
      startTimer(page, session);
    } else {
      const target = page.querySelector<HTMLElement>(`#exam-q-${index}`);
      target?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  page.addEventListener('click', (e) => {
    const row = (e.target as HTMLElement).closest<HTMLElement>('[data-grid-row]');
    if (!row) return;
    goToQuestion(Number(row.dataset.questionIndex));
  });

  page.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const row = (e.target as HTMLElement).closest<HTMLElement>('[data-grid-row]');
    if (!row) return;
    e.preventDefault();
    goToQuestion(Number(row.dataset.questionIndex));
  });

  // 글자 크기 조절
  let fontStep = 0; // -1=small, 0=default, 1=large
  page.querySelector<HTMLButtonElement>('[data-font-increase]')?.addEventListener('click', () => {
    if (fontStep < 1) fontStep += 1;
    applyFontSize(page, fontStep);
  });
  page.querySelector<HTMLButtonElement>('[data-font-decrease]')?.addEventListener('click', () => {
    if (fontStep > -1) fontStep -= 1;
    applyFontSize(page, fontStep);
  });

  // 레이아웃 모드 토글 (세로스크롤 ↔ 한문제씩)
  page.querySelector<HTMLButtonElement>('[data-layout-toggle]')?.addEventListener('click', () => {
    layoutMode = layoutMode === 'scroll' ? 'paged' : 'scroll';
    pagedIndex = 0;
    renderExam(page, session);
    startTimer(page, session);
  });

  // 한문제씩 모드: 이전/다음
  page.querySelector<HTMLButtonElement>('[data-paged-prev]')?.addEventListener('click', () => {
    if (pagedIndex > 0) {
      pagedIndex -= 1;
      renderExam(page, session);
      startTimer(page, session);
    }
  });
  page.querySelector<HTMLButtonElement>('[data-paged-next]')?.addEventListener('click', () => {
    const subjectSession = session.subjects[session.activeSubjectIndex];
    if (subjectSession && pagedIndex < subjectSession.questions.length - 1) {
      pagedIndex += 1;
      renderExam(page, session);
      startTimer(page, session);
    }
  });

  // 퇴실 버튼 → 모달
  page.querySelector<HTMLButtonElement>('[data-exit-btn]')?.addEventListener('click', () => {
    const modal = page.querySelector<HTMLElement>('[data-exit-modal]');
    if (modal) modal.hidden = false;
  });

  // 모달 취소
  page.querySelector<HTMLButtonElement>('[data-modal-cancel]')?.addEventListener('click', () => {
    const modal = page.querySelector<HTMLElement>('[data-exit-modal]');
    if (modal) modal.hidden = true;
  });

  // 모달 확인 → 시험 종료
  page.querySelector<HTMLButtonElement>('[data-modal-confirm]')?.addEventListener('click', () => {
    stopTimer();
    session = finishSession(session);
    window.location.hash = '#/mock-exam/result';
  });
}

// ─── 부분 DOM 업데이트 ────────────────────────────────────────────────────

function refreshGridRow(page: HTMLElement, session: MockExamSession, questionKey: string): void {
  const subjectSession = session.subjects[session.activeSubjectIndex];
  if (!subjectSession) return;

  const row = page.querySelector<HTMLElement>(
    `[data-grid-row][data-question-key="${CSS.escape(questionKey)}"]`,
  );
  if (!row) return;

  const selected = subjectSession.answers[questionKey] ?? [];
  const isBookmarked = session.bookmarks.includes(questionKey);
  const answerSpan = row.querySelector<HTMLElement>('.exam-grid-answer');

  if (answerSpan) {
    answerSpan.innerHTML =
      selected.length > 0
        ? `<span class="exam-grid-answer-circle">${selected.map(circledNumber).join('')}</span>`
        : '';
  }

  row.classList.toggle('has-bookmark', isBookmarked);
  const existingFlag = row.querySelector('.exam-grid-bookmark');
  if (isBookmarked && !existingFlag) {
    row.insertAdjacentHTML('beforeend', '<span class="exam-grid-bookmark" aria-hidden="true">🚩</span>');
  } else if (!isBookmarked && existingFlag) {
    existingFlag.remove();
  }
}

function refreshBookmarkBtn(page: HTMLElement, questionKey: string, isBookmarked: boolean): void {
  const btn = page.querySelector<HTMLButtonElement>(
    `[data-bookmark-btn][data-question-key="${CSS.escape(questionKey)}"]`,
  );
  if (!btn) return;

  btn.classList.toggle('is-active', isBookmarked);
  btn.setAttribute('aria-pressed', String(isBookmarked));
  btn.setAttribute('aria-label', isBookmarked ? '책갈피 해제' : '책갈피 추가');
  const svg = btn.querySelector('svg');
  if (svg) {
    svg.setAttribute('fill', isBookmarked ? '#e8952e' : 'none');
    svg.setAttribute('stroke', isBookmarked ? '#e8952e' : '#d4a843');
  }
}

function refreshChoiceHighlight(page: HTMLElement, questionKey: string, selected: string[]): void {
  page
    .querySelectorAll<HTMLLabelElement>(
      `.exam-choice-row:has(input[data-question-key="${CSS.escape(questionKey)}"])`,
    )
    .forEach((label) => {
      const input = label.querySelector<HTMLInputElement>('input');
      label.classList.toggle('is-selected', input ? selected.includes(input.value) : false);
    });
}

function refreshTabCounts(page: HTMLElement, session: MockExamSession): void {
  page.querySelectorAll<HTMLButtonElement>('[data-tab-index]').forEach((tab) => {
    const index = Number(tab.dataset.tabIndex);
    const subject = session.subjects[index];
    if (!subject) return;
    const countEl = tab.querySelector<HTMLElement>('.exam-tab-count');
    if (countEl) {
      countEl.textContent = `(${getAnsweredCount(subject)}/${subject.questions.length})`;
    }
  });
}

function refreshPageIndicator(page: HTMLElement, session: MockExamSession): void {
  const subjectSession = session.subjects[session.activeSubjectIndex];
  if (!subjectSession) return;
  const indicator = page.querySelector<HTMLElement>('.exam-page-indicator span');
  if (indicator) {
    indicator.textContent = `${getAnsweredCount(subjectSession)} / ${subjectSession.questions.length}`;
  }
}

function rerenderQuestionArea(page: HTMLElement, session: MockExamSession): void {
  const area = page.querySelector<HTMLElement>('[data-question-area]');
  if (!area) return;
  const subjectSession = session.subjects[session.activeSubjectIndex];
  if (!subjectSession) return;
  area.innerHTML = renderQuestionList(subjectSession, session);
}

function rerenderTabs(page: HTMLElement, session: MockExamSession): void {
  const tabContainer = page.querySelector<HTMLElement>('.exam-tabs');
  if (!tabContainer) return;
  tabContainer.innerHTML = session.subjects
    .map(
      (subject, index) => `
        <button
          class="exam-tab ${index === session.activeSubjectIndex ? 'is-active' : ''}"
          role="tab"
          aria-selected="${index === session.activeSubjectIndex}"
          type="button"
          data-tab-index="${index}"
        >
          <span class="exam-tab-title">${escapeHtml(subject.subjectTitle)}</span>
          <span class="exam-tab-count">(${getAnsweredCount(subject)}/${subject.questions.length})</span>
        </button>
      `,
    )
    .join('');
}

function rerenderSidebar(page: HTMLElement, session: MockExamSession): void {
  const grid = page.querySelector<HTMLElement>('[data-answer-grid]');
  if (!grid) return;
  const subjectSession = session.subjects[session.activeSubjectIndex];
  if (!subjectSession) return;
  grid.innerHTML = renderAnswerGrid(subjectSession, session);
}

function applyFontSize(page: HTMLElement, step: number): void {
  const sizeMap: Record<number, string> = { '-1': '14px', '0': '16px', '1': '18px' };
  const size = sizeMap[step] ?? '16px';
  page.style.setProperty('--exam-font-size', size);
}

// ─── 타이머 ───────────────────────────────────────────────────────────────

function startTimer(page: HTMLElement, session: MockExamSession): void {
  stopTimer();

  timerInterval = setInterval(() => {
    const remaining = getRemainingSeconds(session);
    const timerEl = page.querySelector<HTMLElement>('[data-timer]');
    if (timerEl) {
      timerEl.textContent = formatCountdown(remaining);
      timerEl.classList.toggle('is-warning', remaining <= 300);
    }

    if (remaining <= 0) {
      stopTimer();
      const finished = finishSession(session);
      saveMockExamSession(finished);
      window.location.hash = '#/mock-exam/result';
    }
  }, 1000);
}

export function stopTimer(): void {
  if (timerInterval !== null) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
}
