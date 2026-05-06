import type { Catalog } from '../types/catalog';
import {
  savePracticeScope,
  saveSelectedSources,
  type PracticeScope,
  type SelectedSource,
} from '../lib/quiz-session';
import { escapeHtml, renderFooter, sourceKindLabel } from './shared';

export function renderSelectPage(catalog: Catalog): HTMLElement {
  const page = document.createElement('main');
  page.className = 'app-shell';
  let firstSourceRendered = false;
  const years = [
    ...new Set(
      catalog.subjects.flatMap((subject) =>
        subject.sources.flatMap((source) => (source.year ? [source.year] : [])),
      ),
    ),
  ].sort((a, b) => a - b);

  const subjects = catalog.subjects
    .map((subject) => {
      const sources = subject.sources.length
        ? subject.sources
            .map((source) => {
              const checked = !firstSourceRendered ? ' checked' : '';
              firstSourceRendered = true;

              return `
                <label class="check-row">
                  <input
                    type="checkbox"
                    name="source"
                    value="${subject.id}:${source.id}"
                    data-subject-id="${subject.id}"
                    data-source-id="${source.id}"
                    data-source-title="${escapeHtml(source.title)}"
                    data-source-path="${source.path}"
                    data-kind="${source.kind}"
                    data-year="${source.year ?? ''}"
                    ${checked}
                  />
                  <span>
                    <strong>${source.title}</strong>
                    <small>${sourceKindLabel(source.kind)}${source.year ? ` · ${source.year}` : ''}</small>
                  </span>
                </label>
              `;
            })
            .join('')
        : '<p class="muted">아직 등록된 출처가 없습니다.</p>';

      return `
        <article class="panel">
          <h2>${subject.title}</h2>
          <div class="check-list">${sources}</div>
        </article>
      `;
    })
    .join('');

  page.innerHTML = `
    ${renderNav()}
    <section class="page-header">
      <p class="eyebrow">select</p>
      <h1>문제 선택</h1>
      <p class="lead">선택한 출처의 문제를 섞어 하나의 풀이 세션으로 시작합니다.</p>
    </section>
    <section class="filter-bar" aria-label="출처 필터">
      <label>
        <span>출처</span>
        <select data-kind-filter>
          <option value="all">전체</option>
          <option value="exam">기출</option>
          <option value="workbook">교재 워크북</option>
          <option value="lecture">강의</option>
        </select>
      </label>
      <label>
        <span>연도</span>
        <select data-year-filter>
          <option value="all">전체</option>
          ${years.map((year) => `<option value="${year}">${year}</option>`).join('')}
        </select>
      </label>
      <label>
        <span>문제 범위</span>
        <select data-scope>
          <option value="all">전체 문제</option>
          <option value="bookmarked">북마크만</option>
          <option value="wrong">오답만</option>
        </select>
      </label>
    </section>
    <section class="stack">${subjects}</section>
    <p class="form-message" data-select-message></p>
    <div class="action-row">
      <button class="primary-button" type="button" data-start-quiz>풀이 시작</button>
    </div>
    ${renderFooter()}
  `;

  bindFilters(page);

  page.querySelector<HTMLButtonElement>('[data-start-quiz]')?.addEventListener('click', () => {
    const selectedSources = Array.from(
      page.querySelectorAll<HTMLInputElement>('input[name="source"]:checked'),
    ).map<SelectedSource>((input) => ({
      subjectId: input.dataset.subjectId ?? '',
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
    window.location.hash = '#/quiz';
  });

  return page;
}

function bindFilters(page: HTMLElement): void {
  const applyFilters = () => {
    const kind = page.querySelector<HTMLSelectElement>('[data-kind-filter]')?.value ?? 'all';
    const year = page.querySelector<HTMLSelectElement>('[data-year-filter]')?.value ?? 'all';

    page.querySelectorAll<HTMLElement>('.check-row').forEach((row) => {
      const input = row.querySelector<HTMLInputElement>('input[name="source"]');
      const matchesKind = kind === 'all' || input?.dataset.kind === kind;
      const matchesYear = year === 'all' || input?.dataset.year === year;
      row.hidden = !matchesKind || !matchesYear;
      if (row.hidden && input) {
        input.checked = false;
      }
    });
  };

  page.querySelector<HTMLSelectElement>('[data-kind-filter]')?.addEventListener('change', applyFilters);
  page.querySelector<HTMLSelectElement>('[data-year-filter]')?.addEventListener('change', applyFilters);
}

function readPracticeScope(page: HTMLElement): PracticeScope {
  const value = page.querySelector<HTMLSelectElement>('[data-scope]')?.value;
  return value === 'bookmarked' || value === 'wrong' ? value : 'all';
}

function renderNav(): string {
  return `
    <nav class="top-nav" aria-label="주요 메뉴">
      <a href="#/">홈</a>
      <a href="#/select">문제 선택</a>
      <a href="#/bookmarks">북마크</a>
      <a href="#/backup">백업</a>
    </nav>
  `;
}
