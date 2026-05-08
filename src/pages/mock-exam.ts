import type { Catalog, CatalogSource } from '../types/catalog';
import {
  calcMockExamTimes,
  saveMockExamConfig,
  type MockExamConfig,
  type MockExamSubjectConfig,
} from '../lib/mock-exam-session';
import type { OrderMode, PracticeOptions } from '../lib/quiz-session';
import { loadQuestionFile } from '../lib/data-loader';
import { escapeHtml, renderFooter, renderTopNav } from './shared';

export function renderMockExamPage(catalog: Catalog): HTMLElement {
  const page = document.createElement('main');
  page.className = 'app-shell';

  page.innerHTML = `
    ${renderTopNav('mock-exam')}
    <section class="page-header">
      <p class="eyebrow">mock exam</p>
      <h1>모의 시험</h1>
      <p class="lead">실제 방통대 기말시험 환경에서 시간 제한과 함께 풀어봅니다.<br>최대 3과목을 선택할 수 있습니다.</p>
    </section>
    <section class="mock-exam-setup" aria-label="시험 설정">
      <div class="mock-subject-list">
        ${catalog.subjects.map((subject, i) => renderSubjectCard(subject.id, subject.title, subject.sources, i)).join('')}
      </div>
      <div class="mock-time-summary panel" aria-label="시험 시간 요약">
        <dl>
          <div><dt>선택한 과목</dt><dd data-selected-count>0</dd></div>
          <div><dt>시험 시간</dt><dd data-total-time>—</dd></div>
          <div><dt>시험 시작</dt><dd>13:30</dd></div>
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
  _index: number,
): string {
  const examSources = [...sources].sort((a, b) => {
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
            ${examSources.map((src) => renderSourceRow(src, subjectId, subjectTitle)).join('')}
          </div>
        </fieldset>
        <fieldset class="segmented-field mock-extract-field">
          <legend>문제 추출</legend>
          <div class="segmented-control">
            <label>
              <input type="radio" name="extract-${escapeHtml(subjectId)}" value="random-25" checked />
              <span>무작위 25문제</span>
            </label>
            <label>
              <input type="radio" name="extract-${escapeHtml(subjectId)}" value="all" />
              <span>전체 문제</span>
            </label>
          </div>
        </fieldset>
      </div>
    </fieldset>
  `;
}

function renderSourceRow(source: CatalogSource, subjectId: string, subjectTitle: string): string {
  const kindLabel: Record<string, string> = {
    exam: '기말시험',
    textbook: '기본서',
    workbook: '워크북',
    lecture: '강의',
    intensive: '특강',
  };
  return `
    <label class="check-row">
      <input
        type="checkbox"
        name="source-${escapeHtml(subjectId)}"
        value="${escapeHtml(source.id)}"
        data-subject-id="${escapeHtml(subjectId)}"
        data-subject-title="${escapeHtml(subjectTitle)}"
        data-source-id="${escapeHtml(source.id)}"
        data-source-title="${escapeHtml(source.title)}"
        data-source-path="${escapeHtml(source.path)}"
      />
      <span>
        <strong>
          ${escapeHtml(source.title)}
          <span class="source-count" data-source-count data-source-path="${escapeHtml(source.path)}">${renderQuestionCountText(source.questionCount)}</span>
        </strong>
        <small>${kindLabel[source.kind] ?? source.kind}${source.year ? ` · ${source.year}` : ''}</small>
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
  const checkboxes = Array.from(
    page.querySelectorAll<HTMLInputElement>('[data-subject-checkbox]'),
  );
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
  const endEl = page.querySelector<HTMLElement>('[data-end-time]');

  if (countEl) countEl.textContent = String(checkedCount);
  if (timeEl) timeEl.textContent = checkedCount > 0 ? `${times.totalMinutes}분` : '—';
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

    const selectedSources = Array.from(
      page.querySelectorAll<HTMLInputElement>(`input[name="source-${subjectId}"]:checked`),
    ).map((input) => ({
      subjectId: input.dataset.subjectId ?? subjectId,
      subjectTitle: input.dataset.subjectTitle ?? catalogSubject.title,
      sourceId: input.dataset.sourceId ?? '',
      sourceTitle: input.dataset.sourceTitle ?? '',
      path: input.dataset.sourcePath ?? '',
    }));

    if (selectedSources.length === 0) return null;

    const extractModeInput = page.querySelector<HTMLInputElement>(
      `input[name="extract-${subjectId}"]:checked`,
    );
    const extractMode =
      extractModeInput?.value === 'all' ? 'all' : ('random-25' as const);

    subjects.push({
      subjectId,
      subjectTitle: catalogSubject.title,
      sources: selectedSources,
      extractMode,
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
