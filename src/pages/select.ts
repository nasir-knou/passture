import type { Catalog, CatalogSource, SourceKind } from '../types/catalog';
import {
  savePracticeOptions,
  savePracticeScope,
  saveSelectedSources,
  type OrderMode,
  type PracticeOptions,
  type PracticeScope,
  type SelectedSource,
} from '../lib/quiz-session';
import { loadQuestionFile } from '../lib/data-loader';
import { loadBookmarks, loadWrongAnswers } from '../lib/storage';
import { escapeHtml, renderFooter, renderTopNav, semesterLabel, sourceKindLabel } from './shared';

export function renderSelectPage(catalog: Catalog): HTMLElement {
  const page = document.createElement('main');
  page.className = 'app-shell';
  const selectedSubjectId = readSubjectId(catalog);
  const visibleSubjects = catalog.subjects.filter((subject) => subject.id === selectedSubjectId);
  const selectedSubject = visibleSubjects[0];
  const learningStatus = readLearningStatus(selectedSubject?.id);

  const subjects = visibleSubjects
    .map((subject) => {
      const sources = subject.sources.length
        ? sortSourcesForSelect(subject.sources)
            .map((source) => renderSourceRow(source, subject.id, subject.title))
            .join('')
        : '<div class="empty-state-card compact"><strong>출처 없음</strong><p>아직 등록된 출처가 없습니다.</p></div>';

      return `
        <fieldset class="segmented-field source-field">
          <legend>출처 선택</legend>
          <label class="source-search">
            <span>문제 검색</span>
            <input type="search" placeholder="문제 내용, 출처명, 카테고리 검색" data-source-search />
          </label>
          <div class="check-list">${sources}</div>
          <p class="empty-state-inline" data-source-search-empty hidden>검색 결과가 없습니다.</p>
        </fieldset>
      `;
    })
    .join('');

  page.innerHTML = `
    ${renderTopNav('select')}
    <section class="page-header">
      <p class="eyebrow">select</p>
      <h1>${escapeHtml(selectedSubject?.title ?? '문제 선택')}</h1>
      ${
        selectedSubject
          ? `<p><span class="status-badge semester-badge">${semesterLabel(selectedSubject.semester)}</span></p>`
          : ''
      }
      <p class="lead">선택한 과목의 문제 출처와 풀이 방식을 정합니다.</p>
    </section>
    <section class="subject-switcher panel" aria-label="과목 변경">
      <div>
        <label>
          <span>과목</span>
          <select data-subject-switcher>
            ${catalog.subjects
              .map(
                (subject) => `
                  <option value="${escapeHtml(subject.id)}" ${subject.id === selectedSubject?.id ? 'selected' : ''}>
                    ${escapeHtml(`${semesterLabel(subject.semester)} · ${subject.title}`)}
                  </option>
                `,
              )
              .join('')}
          </select>
        </label>
      </div>
      ${renderLearningStatus(learningStatus, selectedSubject?.id)}
    </section>
    <section class="stack">${subjects}</section>
    <section class="settings-grid" aria-label="풀이 설정">
      ${renderScopeSetting()}
      ${renderOrderSetting('문제순서 설정', 'question-order', 'questionOrder')}
      ${renderOrderSetting('선지순서 설정', 'choice-order', 'choiceOrder')}
    </section>
    <section class="selection-summary panel" aria-live="polite" aria-label="선택 요약">
      <div>
        <span class="status-badge">선택 요약</span>
        <strong data-selected-source-count>선택된 출처 0개</strong>
      </div>
      <p class="muted" data-selected-question-count>총 0문항</p>
      <div class="selected-chip-list" data-selected-source-list>
        <span class="empty-state-inline">선택된 출처가 없습니다.</span>
      </div>
    </section>
    <section class="start-panel" aria-label="풀이 시작">
      <div>
        <strong>설정한 조건으로 풀이를 시작합니다.</strong>
        <p class="muted">출처를 하나 이상 선택하면 선택한 범위와 순서 옵션이 세션에 저장됩니다.</p>
        <p class="form-message" data-select-message></p>
      </div>
      <button class="primary-button" type="button" data-start-quiz>풀이 시작</button>
    </section>
    ${renderFooter()}
  `;

  hydrateMissingQuestionCounts(page);
  hydrateSourceSearchText(page);
  bindSelectionSummary(page);
  bindSourceSearch(page);

  page.querySelector<HTMLButtonElement>('[data-start-quiz]')?.addEventListener('click', () => {
    const selectedSources = Array.from(
      page.querySelectorAll<HTMLInputElement>('input[name="source"]:checked'),
    ).map<SelectedSource>((input) => ({
      subjectId: input.dataset.subjectId ?? '',
      subjectTitle: input.dataset.subjectTitle ?? '',
      sourceId: input.dataset.sourceId ?? '',
      sourceTitle: input.dataset.sourceTitle ?? '',
      path: input.dataset.sourcePath ?? '',
    }));

    const message = page.querySelector<HTMLElement>('[data-select-message]');

    if (selectedSources.length === 0) {
      if (message) {
        message.textContent = '출처를 하나 이상 선택해야 합니다.';
      }
      return;
    }

    saveSelectedSources(selectedSources);
    savePracticeScope(readPracticeScope(page));
    savePracticeOptions(readPracticeOptions(page));
    window.location.hash = '#/quiz';
  });

  page
    .querySelector<HTMLSelectElement>('[data-subject-switcher]')
    ?.addEventListener('change', () => {
      const select = page.querySelector<HTMLSelectElement>('[data-subject-switcher]');
      if (!select) {
        return;
      }

      window.location.hash = `#/select?subject=${encodeURIComponent(select.value)}`;
    });

  return page;
}

function renderSourceRow(source: CatalogSource, subjectId: string, subjectTitle: string): string {
  const label = sourceDetailLabel(source);
  const searchText = normalizeSearchText(
    `${subjectTitle} ${source.title} ${label} ${source.year ?? ''}`,
  );

  return `
    <label class="check-row source-row" data-source-row data-search-text="${escapeHtml(searchText)}">
      <input
        type="checkbox"
        name="source"
        value="${escapeHtml(`${subjectId}:${source.id}`)}"
        data-subject-id="${escapeHtml(subjectId)}"
        data-subject-title="${escapeHtml(subjectTitle)}"
        data-source-id="${escapeHtml(source.id)}"
        data-source-title="${escapeHtml(source.title)}"
        data-source-path="${escapeHtml(source.path)}"
        data-kind="${source.kind}"
        data-year="${source.year ?? ''}"
        data-question-count="${source.questionCount ?? ''}"
      />
      <span>
        <strong>
          ${escapeHtml(source.title)}
          <span class="source-count" data-source-count data-source-path="${escapeHtml(source.path)}">${renderQuestionCountText(source.questionCount)}</span>
        </strong>
        <small><span class="status-badge source-kind ${sourceKindClass(source.kind)}">${label}</span></small>
      </span>
    </label>
  `;
}

function sortSourcesForSelect(sources: CatalogSource[]): CatalogSource[] {
  return [...sources].sort((left, right) => {
    if (left.kind === 'exam' && right.kind === 'exam') {
      return (right.year ?? 0) - (left.year ?? 0);
    }

    if (left.kind === 'exam') {
      return -1;
    }

    if (right.kind === 'exam') {
      return 1;
    }

    return 0;
  });
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
      updateSelectionSummary(page);
    });
  });
}

function hydrateSourceSearchText(page: HTMLElement): void {
  page.querySelectorAll<HTMLElement>('[data-source-row]').forEach((row) => {
    const input = row.querySelector<HTMLInputElement>('input[data-source-path]');
    const path = input?.dataset.sourcePath;
    if (!path) {
      return;
    }

    void loadQuestionFile(path).then((file) => {
      const questionText = file.questions
        .flatMap((question) => [
          question.id,
          question.prompt,
          question.explanation,
          ...question.choices.map((choice) => choice.text ?? ''),
        ])
        .join(' ');
      row.dataset.searchText = normalizeSearchText(
        `${row.dataset.searchText ?? ''} ${questionText}`,
      );
      filterSourceRows(page);
    });
  });
}

function bindSelectionSummary(page: HTMLElement): void {
  page.querySelectorAll<HTMLInputElement>('input[name="source"]').forEach((input) => {
    input.addEventListener('change', () => updateSelectionSummary(page));
  });
  updateSelectionSummary(page);
}

function updateSelectionSummary(page: HTMLElement): void {
  const checked = Array.from(
    page.querySelectorAll<HTMLInputElement>('input[name="source"]:checked'),
  );
  const totalQuestions = checked.reduce((total, input) => {
    const count = Number(input.dataset.questionCount);
    return Number.isFinite(count) ? total + count : total;
  }, 0);

  const countEl = page.querySelector<HTMLElement>('[data-selected-source-count]');
  const questionEl = page.querySelector<HTMLElement>('[data-selected-question-count]');
  const listEl = page.querySelector<HTMLElement>('[data-selected-source-list]');

  if (countEl) {
    countEl.textContent = `선택된 출처 ${checked.length}개`;
  }
  if (questionEl) {
    questionEl.textContent = `총 ${totalQuestions}문항`;
  }
  if (listEl) {
    listEl.innerHTML = checked.length
      ? checked
          .map(
            (input) => `
              <span class="selected-chip">
                <strong>${escapeHtml(input.dataset.sourceTitle ?? '')}</strong>
                <small class="status-badge source-kind ${sourceKindClass(input.dataset.kind ?? 'exam')}">${escapeHtml(sourceKindLabel((input.dataset.kind ?? 'exam') as SourceKind))}</small>
              </span>
            `,
          )
          .join('')
      : '<span class="empty-state-inline">선택된 출처가 없습니다.</span>';
  }
}

function bindSourceSearch(page: HTMLElement): void {
  const input = page.querySelector<HTMLInputElement>('[data-source-search]');
  input?.addEventListener('input', () => filterSourceRows(page));
  filterSourceRows(page);
}

function filterSourceRows(page: HTMLElement): void {
  const query = normalizeSearchText(
    page.querySelector<HTMLInputElement>('[data-source-search]')?.value ?? '',
  );
  const rows = Array.from(page.querySelectorAll<HTMLElement>('[data-source-row]'));
  let visibleCount = 0;

  rows.forEach((row) => {
    const visible = !query || (row.dataset.searchText ?? '').includes(query);
    row.hidden = !visible;
    if (visible) {
      visibleCount += 1;
    }
  });

  const empty = page.querySelector<HTMLElement>('[data-source-search-empty]');
  if (empty) {
    empty.hidden = visibleCount > 0 || !query;
  }
}

function normalizeSearchText(value: string): string {
  return value.replace(/\s+/g, ' ').trim().toLowerCase();
}

function cssEscape(value: string): string {
  if ('CSS' in window && typeof CSS.escape === 'function') {
    return CSS.escape(value);
  }
  return value.replace(/"/g, '\\"');
}

function sourceDetailLabel(source: CatalogSource): string {
  return sourceKindLabel(source.kind);
}

function sourceKindClass(kind: SourceKind | string): string {
  switch (kind) {
    case 'exam':
      return 'source-kind-exam';
    case 'textbook':
    case 'workbook':
      return 'source-kind-material';
    case 'lecture':
    case 'intensive':
      return 'source-kind-lecture';
    default:
      return 'source-kind-exam';
  }
}

function readSubjectId(catalog: Catalog): string | undefined {
  const query = window.location.hash.split('?')[1] ?? '';
  const subjectId = new URLSearchParams(query).get('subject');
  const requestedSubject = catalog.subjects.find((subject) => subject.id === subjectId);
  const firstAvailableSubject = catalog.subjects.find((subject) => subject.sources.length > 0);
  return requestedSubject?.id ?? firstAvailableSubject?.id;
}

interface LearningStatus {
  bookmarkCount: number;
  wrongQuestionCount: number;
  wrongAttemptCount: number;
}

function readLearningStatus(subjectId: string | undefined): LearningStatus {
  if (!subjectId) {
    return {
      bookmarkCount: 0,
      wrongQuestionCount: 0,
      wrongAttemptCount: 0,
    };
  }

  const subjectPrefix = `${subjectId}:`;
  const bookmarkCount = loadBookmarks().filter((key) => key.startsWith(subjectPrefix)).length;
  const wrongAnswerRecords = Object.entries(loadWrongAnswers()).filter(([key]) =>
    key.startsWith(subjectPrefix),
  );
  const wrongAttemptCount = wrongAnswerRecords.reduce(
    (total, [, record]) => total + record.wrongCount,
    0,
  );
  return {
    bookmarkCount,
    wrongQuestionCount: wrongAnswerRecords.length,
    wrongAttemptCount,
  };
}

function renderLearningStatus(status: LearningStatus, subjectId: string | undefined): string {
  if (
    status.bookmarkCount === 0 &&
    status.wrongQuestionCount === 0 &&
    status.wrongAttemptCount === 0
  ) {
    return `
      <div class="subject-summary-empty" aria-label="최근 학습 상태">
        풀이 기록 없음
      </div>
    `;
  }

  return `
    <dl class="subject-summary learning-summary" aria-label="최근 학습 상태">
      <div>
        <dt>북마크</dt>
        <dd>${status.bookmarkCount}</dd>
      </div>
      <div>
        <dt>오답 문항</dt>
        <dd>${status.wrongQuestionCount}</dd>
      </div>
      <div>
        <dt>오답 누적</dt>
        <dd>${status.wrongAttemptCount}</dd>
      </div>
      <div>
        <dt>복습</dt>
        <dd><a class="subject-summary-link" href="${createWrongHistoryLink(subjectId)}">오답 보기</a></dd>
      </div>
    </dl>
  `;
}

function createWrongHistoryLink(subjectId: string | undefined): string {
  const params = new URLSearchParams({ filter: 'wrong' });
  if (subjectId) {
    params.set('subject', subjectId);
  }

  return `#/history?${params.toString()}`;
}

function readPracticeScope(page: HTMLElement): PracticeScope {
  const value = page.querySelector<HTMLInputElement>('input[name="scope"]:checked')?.value;
  return value === 'bookmarked' || value === 'wrong' ? value : 'all';
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

function renderScopeSetting(): string {
  return `
    <fieldset class="segmented-field">
      <legend>문제 범위 설정</legend>
      <div class="segmented-control three" aria-label="practice-scope">
        <label>
          <input type="radio" name="scope" value="all" checked />
          <span>전체</span>
        </label>
        <label>
          <input type="radio" name="scope" value="bookmarked" />
          <span>북마크만</span>
        </label>
        <label>
          <input type="radio" name="scope" value="wrong" />
          <span>오답만</span>
        </label>
      </div>
    </fieldset>
  `;
}
