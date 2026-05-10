import type { Catalog, CatalogSource, SourceKind } from '../types/catalog';
import {
  calcMockExamTimes,
  saveMockExamConfig,
  type MockExamConfig,
  type MockExamSubjectConfig,
} from '../lib/mock-exam-session';
import type { OrderMode, PracticeOptions } from '../lib/quiz-session';
import { loadQuestionFile } from '../lib/data-loader';
import { escapeHtml, renderFooter, renderTopNav, sourceKindLabel } from './shared';

export function renderMockExamPage(catalog: Catalog): HTMLElement {
  const page = document.createElement('main');
  page.className = 'app-shell';

  page.innerHTML = `
    ${renderTopNav('mock-exam')}
    <section class="page-header">
      <p class="eyebrow">mock exam</p>
      <h1>모의 시험</h1>
      <p class="lead">유사 기말 시험 환경에서 시간 제한과 함께 풀어봅니다.<br>최대 3과목을 선택할 수 있습니다.</p>
    </section>
    <section class="mock-exam-setup" aria-label="시험 설정">
      <div class="mock-subject-list">
        ${catalog.subjects.map((subject) => renderSubjectCard(subject.id, subject.title, subject.sources)).join('')}
      </div>
      <div class="mock-time-summary panel" aria-label="시험 시간 요약">
        <dl>
          <div><dt>선택한 과목</dt><dd data-selected-count>0</dd></div>
          <div><dt>시험 시간</dt><dd data-total-time>—</dd></div>
          <div><dt>시험 시작</dt><dd data-start-time>—</dd></div>
          <div><dt>시험 종료</dt><dd data-end-time>—</dd></div>
        </dl>
      </div>
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
  return page;
}

function renderSubjectCard(
  subjectId: string,
  subjectTitle: string,
  sources: CatalogSource[],
): string {
  const sortedSources = [...sources].sort((a, b) => {
    if (a.kind === 'exam' && b.kind !== 'exam') return -1;
    if (b.kind === 'exam' && a.kind !== 'exam') return 1;
    return (b.year ?? 0) - (a.year ?? 0);
  });

  return `
    <fieldset class="mock-subject-card panel" data-subject-card data-subject-id="${escapeHtml(subjectId)}">
      <legend class="mock-subject-legend">
        <label class="mock-subject-toggle">
          <input type="checkbox" name="subject" value="${escapeHtml(subjectId)}" data-subject-checkbox />
          <strong>${escapeHtml(subjectTitle)}</strong>
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
      />
      <span>
        <strong>
          ${escapeHtml(source.title)}
          <span class="source-count" data-source-count data-source-path="${escapeHtml(source.path)}">${renderQuestionCountText(source.questionCount)}</span>
        </strong>
        <small>${sourceKindLabel(source.kind)}</small>
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
  // 과목 체크박스 토글 → 본체 표시/숨김
  page.querySelectorAll<HTMLInputElement>('[data-subject-checkbox]').forEach((checkbox) => {
    checkbox.addEventListener('change', () => {
      const card = checkbox.closest<HTMLElement>('[data-subject-card]');
      const body = card?.querySelector<HTMLElement>('.mock-subject-body');
      if (body) body.hidden = !checkbox.checked;
      updateTimeSummary(page);
      enforceMaxSubjects(page);
    });
  });

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
