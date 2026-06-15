import type { Catalog, CatalogSource, CatalogSubject, Semester, SourceKind } from '../types/catalog';
import {
  calcMockExamTimes,
  saveMockExamConfig,
  type MockExamConfig,
  type MockExamSubjectConfig,
} from '../lib/mock-exam-session';
import type { OrderMode, PracticeOptions } from '../lib/quiz-session';
import { loadQuestionFile } from '../lib/data-loader';
import { escapeHtml, renderFooter, renderTopNav, semesterLabel, sourceKindLabel } from './shared';

type SemesterFilter = 'all' | Semester;

export function renderMockExamPage(catalog: Catalog): HTMLElement {
  const page = document.createElement('main');
  page.className = 'app-shell';
  const defaultSemesterFilter = getDefaultSemesterFilter();

  page.innerHTML = `
    ${renderTopNav('mock-exam')}
    <section class="page-header">
      <p class="eyebrow">mock exam</p>
      <h1>모의 시험</h1>
      <p class="lead">유사 기말 시험 환경에서 시간 제한과 함께 풀어봅니다.<br>최대 3과목을 선택할 수 있습니다. 웹/태블릿 환경 권장.</p>
    </section>
    <section class="mock-exam-setup" aria-label="시험 설정">
      <section class="semester-filter" aria-label="학기별 과목 필터">
        ${renderSemesterFilterButton('all', '전체', defaultSemesterFilter === 'all')}
        ${renderSemesterFilterButton(1, '1학기', defaultSemesterFilter === 1)}
        ${renderSemesterFilterButton(2, '2학기', defaultSemesterFilter === 2)}
      </section>
      <div class="mock-subject-list">
        ${catalog.subjects.map((subject) => renderSubjectCard(subject)).join('')}
      </div>
      <div class="mock-time-summary panel" aria-label="시험 시간 요약">
        <dl>
          <div><dt>선택한 과목</dt><dd data-selected-count>0</dd></div>
          <div><dt>시험 시간</dt><dd data-total-time>—</dd></div>
          <div><dt>시험 시작</dt><dd data-start-time>—</dd></div>
          <div><dt>시험 종료</dt><dd data-end-time>—</dd></div>
        </dl>
      </div>
      <section class="mock-config-summary panel" aria-live="polite" aria-label="문항 구성 요약">
        <div class="mock-config-summary-header">
          <strong data-mock-config-title>문항 구성 (0과목)</strong>
        </div>
        <div class="mock-config-list" data-mock-config-summary>
          <p>과목과 출처를 선택해 주세요.</p>
        </div>
      </section>
      <section class="settings-grid" aria-label="모의시험 순서 설정">
        ${renderOrderSetting('문제순서 설정', 'mock-question-order', 'questionOrder')}
        ${renderOrderSetting('선지순서 설정', 'mock-choice-order', 'choiceOrder')}
      </section>
      <p class="form-message" data-setup-message></p>
      <div class="start-panel" aria-label="시험 시작">
        <button class="primary-button" type="button" data-start-exam>시험 시작</button>
      </div>
    </section>
    ${renderFooter()}
  `;

  hydrateMissingQuestionCounts(page);
  bindSetupEvents(page, catalog);
  filterSubjectCards(page, defaultSemesterFilter);
  return page;
}

function renderSubjectCard(subject: CatalogSubject): string {
  const { id: subjectId, title: subjectTitle, sources, semester } = subject;
  const sortedSources = [...sources].sort((a, b) => {
    if (a.kind === 'exam' && b.kind !== 'exam') return -1;
    if (b.kind === 'exam' && a.kind !== 'exam') return 1;
    return (b.year ?? 0) - (a.year ?? 0);
  });

  return `
    <fieldset class="mock-subject-card panel" data-subject-card data-subject-id="${escapeHtml(subjectId)}" data-subject-title="${escapeHtml(subjectTitle)}" data-semester="${semester}">
      <legend class="mock-subject-legend">
        <label class="mock-subject-toggle">
          <input type="checkbox" name="subject" value="${escapeHtml(subjectId)}" data-subject-checkbox />
          <strong>${escapeHtml(subjectTitle)}</strong>
          <span class="status-badge semester-badge">${semesterLabel(semester)}</span>
        </label>
      </legend>
      <div class="mock-subject-body" hidden>
        <fieldset class="segmented-field mock-source-field">
          <legend>출처 선택</legend>
          <div class="check-list">
            ${sortedSources.map((src) => renderSourceRow(src, subjectId, subjectTitle)).join('')}
          </div>
        </fieldset>
        <fieldset class="segmented-field">
          <legend>문항 구성</legend>
          <div class="segmented-control" aria-label="${escapeHtml(subjectTitle)} 문항 구성">
            <label>
              <input type="radio" name="questionMode-${escapeHtml(subjectId)}" value="sample25" checked />
              <span>무작위 25문제</span>
            </label>
            <label>
              <input type="radio" name="questionMode-${escapeHtml(subjectId)}" value="all" />
              <span>전체 풀기</span>
            </label>
          </div>
        </fieldset>
      </div>
    </fieldset>
  `;
}

function renderSemesterFilterButton(
  value: SemesterFilter,
  label: string,
  checked = false,
): string {
  return `
    <label>
      <input type="radio" name="mock-semester-filter" value="${value}" ${checked ? 'checked' : ''} />
      <span>${label}</span>
    </label>
  `;
}

function renderSourceRow(source: CatalogSource, subjectId: string, subjectTitle: string): string {
  return `
    <label class="check-row">
      <input
        type="radio"
        name="source-${escapeHtml(subjectId)}"
        value="${escapeHtml(source.id)}"
        data-subject-id="${escapeHtml(subjectId)}"
        data-subject-title="${escapeHtml(subjectTitle)}"
        data-source-id="${escapeHtml(source.id)}"
        data-source-title="${escapeHtml(source.title)}"
        data-source-path="${escapeHtml(source.path)}"
        data-source-kind="${escapeHtml(source.kind)}"
        data-question-count="${source.questionCount ?? ''}"
      />
      <span>
        <strong>
          ${escapeHtml(source.title)}
          <span class="source-count" data-source-count data-source-path="${escapeHtml(source.path)}">${renderQuestionCountText(source.questionCount)}</span>
        </strong>
        <small><span class="status-badge source-kind ${sourceKindClass(source.kind)}">${sourceKindLabel(source.kind)}</span></small>
      </span>
    </label>
  `;
}

function renderQuestionCountText(questionCount: number | undefined): string {
  return typeof questionCount === 'number' ? `(${questionCount}문제)` : '';
}

function hydrateMissingQuestionCounts(page: HTMLElement): void {
  page.querySelectorAll<HTMLElement>('[data-source-count]').forEach((element) => {
    if (element.textContent?.trim()) {
      return;
    }

    const path = element.dataset.sourcePath;
    if (!path) {
      return;
    }

    void loadQuestionFile(path).then((file) => {
      element.textContent = renderQuestionCountText(file.questions.length);
      page
        .querySelectorAll<HTMLInputElement>(`input[data-source-path="${cssEscape(path)}"]`)
        .forEach((input) => {
          input.dataset.questionCount = String(file.questions.length);
        });
      updateMockConfigSummary(page);
    });
  });
}

function renderOrderSetting(
  label: string,
  groupLabel: string,
  name: keyof PracticeOptions,
): string {
  return `
    <fieldset class="segmented-field">
      <legend>${label}</legend>
      <div class="segmented-control" aria-label="${groupLabel}">
        <label>
          <input type="radio" name="${name}" value="default" checked />
          <span>기본</span>
        </label>
        <label>
          <input type="radio" name="${name}" value="random" />
          <span>순서 무작위</span>
        </label>
      </div>
    </fieldset>
  `;
}

function bindSetupEvents(page: HTMLElement, catalog: Catalog): void {
  page
    .querySelectorAll<HTMLInputElement>('input[name="mock-semester-filter"]')
    .forEach((input) => {
      input.addEventListener('change', () => {
        filterSubjectCards(page, readSemesterFilter(page), { clearHiddenSelections: true });
        updateTimeSummary(page);
        updateMockConfigSummary(page);
        enforceMaxSubjects(page);
      });
    });

  // 과목 체크박스 토글 → 본체 표시/숨김
  page.querySelectorAll<HTMLInputElement>('[data-subject-checkbox]').forEach((checkbox) => {
    checkbox.addEventListener('change', () => {
      const card = checkbox.closest<HTMLElement>('[data-subject-card]');
      const body = card?.querySelector<HTMLElement>('.mock-subject-body');
      if (body) body.hidden = !checkbox.checked;
      updateTimeSummary(page);
      updateMockConfigSummary(page);
      enforceMaxSubjects(page);
    });
  });

  page
    .querySelectorAll<HTMLInputElement>('input[type="radio"]')
    .forEach((input) => input.addEventListener('change', () => updateMockConfigSummary(page)));

  updateTimeSummary(page);
  updateMockConfigSummary(page);

  // 시험 시작
  page.querySelector<HTMLButtonElement>('[data-start-exam]')?.addEventListener('click', () => {
    const config = readConfig(page, catalog);
    const message = page.querySelector<HTMLElement>('[data-setup-message]');

    if (!config) {
      if (message) message.textContent = '과목을 하나 이상 선택하고 출처를 지정해 주세요.';
      return;
    }
    if (message) message.textContent = '';

    saveMockExamConfig(config);
    window.location.hash = '#/mock-exam/test';
  });
}

function getDefaultSemesterFilter(date = new Date()): SemesterFilter {
  const month = date.getMonth() + 1;
  return month >= 2 && month <= 7 ? 1 : 2;
}

function readSemesterFilter(page: HTMLElement): SemesterFilter {
  const checked = page.querySelector<HTMLInputElement>(
    'input[name="mock-semester-filter"]:checked',
  );
  return checked?.value === '1' ? 1 : checked?.value === '2' ? 2 : 'all';
}

function filterSubjectCards(
  page: HTMLElement,
  semester: SemesterFilter,
  options: { clearHiddenSelections?: boolean } = {},
): void {
  page.querySelectorAll<HTMLElement>('[data-subject-card]').forEach((card) => {
    const hidden = semester !== 'all' && card.dataset.semester !== String(semester);
    card.hidden = hidden;

    if (hidden && options.clearHiddenSelections) {
      const checkbox = card.querySelector<HTMLInputElement>('[data-subject-checkbox]');
      const body = card.querySelector<HTMLElement>('.mock-subject-body');
      if (checkbox) {
        checkbox.checked = false;
        checkbox.disabled = false;
      }
      if (body) {
        body.hidden = true;
      }
    }
  });
}

function enforceMaxSubjects(page: HTMLElement): void {
  const checkboxes = Array.from(page.querySelectorAll<HTMLInputElement>('[data-subject-checkbox]'));
  const checkedCount = checkboxes.filter((cb) => cb.checked).length;

  checkboxes.forEach((cb) => {
    if (!cb.checked && checkedCount >= 3) {
      cb.disabled = true;
    } else {
      cb.disabled = false;
    }
  });
}

function updateTimeSummary(page: HTMLElement): void {
  const checkedCount = page.querySelectorAll<HTMLInputElement>(
    '[data-subject-checkbox]:checked',
  ).length;
  const times = calcMockExamTimes(checkedCount);

  const countEl = page.querySelector<HTMLElement>('[data-selected-count]');
  const timeEl = page.querySelector<HTMLElement>('[data-total-time]');
  const startEl = page.querySelector<HTMLElement>('[data-start-time]');
  const endEl = page.querySelector<HTMLElement>('[data-end-time]');

  if (countEl) countEl.textContent = String(checkedCount);
  if (timeEl) timeEl.textContent = checkedCount > 0 ? `${times.totalMinutes}분` : '—';
  if (startEl) startEl.textContent = checkedCount > 0 ? times.startTime : '—';
  if (endEl) endEl.textContent = checkedCount > 0 ? times.endTime : '—';
}

function updateMockConfigSummary(page: HTMLElement): void {
  const checkedSubjects = Array.from(
    page.querySelectorAll<HTMLInputElement>('[data-subject-checkbox]:checked'),
  );
  const titleEl = page.querySelector<HTMLElement>('[data-mock-config-title]');
  const summaryEl = page.querySelector<HTMLElement>('[data-mock-config-summary]');

  if (!summaryEl) {
    return;
  }

  if (titleEl) {
    titleEl.textContent = `문항 구성 (${checkedSubjects.length}과목)`;
  }

  if (checkedSubjects.length === 0) {
    summaryEl.innerHTML = '<p>과목과 출처를 선택해 주세요.</p>';
    return;
  }

  let totalQuestions = 0;
  const items = checkedSubjects.map((checkbox) => {
    const card = checkbox.closest<HTMLElement>('[data-subject-card]');
    const sourceInput = card?.querySelector<HTMLInputElement>(
      `input[name="source-${checkbox.value}"]:checked`,
    );
    const mode = readQuestionMode(page, checkbox.value);
    const sourceTitle = sourceInput?.dataset.sourceTitle ?? '출처 미선택';
    const questionCount = Number(sourceInput?.dataset.questionCount);
    const expectedCount =
      mode === 'all'
        ? Number.isFinite(questionCount)
          ? questionCount
          : 0
        : Number.isFinite(questionCount)
          ? Math.min(questionCount, 25)
          : 25;

    totalQuestions += expectedCount;
    const subjectTitle = card?.dataset.subjectTitle ?? checkbox.value;
    const questionSummary = mode === 'all' ? `전체 ${expectedCount}문항` : '무작위 25문항';
    return `
      <div class="mock-config-item">
        <strong>${escapeHtml(subjectTitle)}</strong>
        <span>${escapeHtml(sourceTitle)}</span>
        <em>${mode === 'all' ? '전체' : '25문제'}</em>
        <small>${questionSummary}</small>
      </div>
    `;
  });

  const times = calcMockExamTimes(checkedSubjects.length);
  summaryEl.innerHTML = `
    ${items.join('')}
    <div class="mock-config-total">
      <span>총 ${totalQuestions}문항</span>
      <span>시험 시간 ${times.totalMinutes}분</span>
    </div>
  `;
}

function readConfig(page: HTMLElement, catalog: Catalog): MockExamConfig | null {
  const selectedSubjectIds = Array.from(
    page.querySelectorAll<HTMLInputElement>('[data-subject-checkbox]:checked'),
  ).map((cb) => cb.value);

  if (selectedSubjectIds.length === 0) return null;

  const subjects: MockExamSubjectConfig[] = [];

  for (const subjectId of selectedSubjectIds) {
    const catalogSubject = catalog.subjects.find((s) => s.id === subjectId);
    if (!catalogSubject) continue;

    const selectedSourceInput = page.querySelector<HTMLInputElement>(
      `input[name="source-${subjectId}"]:checked`,
    );

    if (!selectedSourceInput) return null;

    const selectedSource = {
      subjectId: selectedSourceInput.dataset.subjectId ?? subjectId,
      subjectTitle: selectedSourceInput.dataset.subjectTitle ?? catalogSubject.title,
      sourceId: selectedSourceInput.dataset.sourceId ?? '',
      sourceTitle: selectedSourceInput.dataset.sourceTitle ?? '',
      path: selectedSourceInput.dataset.sourcePath ?? '',
      kind: (selectedSourceInput.dataset.sourceKind ?? 'exam') as SourceKind,
    };

    subjects.push({
      subjectId,
      subjectTitle: catalogSubject.title,
      questionMode: readQuestionMode(page, subjectId),
      source: selectedSource,
    });
  }

  if (subjects.length === 0) return null;

  const times = calcMockExamTimes(subjects.length);
  const options = readPracticeOptions(page);
  return {
    subjects,
    totalMinutes: times.totalMinutes,
    startTime: times.startTime,
    endTime: times.endTime,
    questionOrder: options.questionOrder,
    choiceOrder: options.choiceOrder,
  };
}

function readQuestionMode(
  page: HTMLElement,
  subjectId: string,
): MockExamSubjectConfig['questionMode'] {
  const checked = page.querySelector<HTMLInputElement>(
    `input[name="questionMode-${subjectId}"]:checked`,
  );
  return checked?.value === 'all' ? 'all' : 'sample25';
}

function readPracticeOptions(page: HTMLElement): PracticeOptions {
  return {
    questionOrder: readOrderMode(page, 'questionOrder'),
    choiceOrder: readOrderMode(page, 'choiceOrder'),
  };
}

function readOrderMode(page: HTMLElement, name: keyof PracticeOptions): OrderMode {
  const checked = page.querySelector<HTMLInputElement>(`input[name="${name}"]:checked`);
  return checked?.value === 'random' ? 'random' : 'default';
}

function sourceKindClass(kind: SourceKind): string {
  switch (kind) {
    case 'exam':
      return 'source-kind-exam';
    case 'textbook':
    case 'workbook':
      return 'source-kind-material';
    case 'lecture':
    case 'intensive':
      return 'source-kind-lecture';
  }
}

function cssEscape(value: string): string {
  if ('CSS' in window && typeof CSS.escape === 'function') {
    return CSS.escape(value);
  }
  return value.replace(/"/g, '\\"');
}
