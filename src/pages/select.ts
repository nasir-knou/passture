import type { Catalog } from '../types/catalog';
import { saveSelectedSources, type SelectedSource } from '../lib/quiz-session';
import { escapeHtml, sourceKindLabel } from './shared';

export function renderSelectPage(catalog: Catalog): HTMLElement {
  const page = document.createElement('main');
  page.className = 'app-shell';
  let firstSourceRendered = false;

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
    <section class="stack">${subjects}</section>
    <p class="form-message" data-select-message></p>
    <div class="action-row">
      <button class="primary-button" type="button" data-start-quiz>풀이 시작</button>
    </div>
  `;

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
    window.location.hash = '#/quiz';
  });

  return page;
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
