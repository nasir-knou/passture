import type { Catalog } from '../types/catalog';
import {
  savePracticeOptions,
  savePracticeScope,
  saveSelectedSources,
  type OrderMode,
  type PracticeOptions,
  type PracticeScope,
  type SelectedSource,
} from '../lib/quiz-session';
import { escapeHtml, renderFooter, sourceKindLabel } from './shared';

export function renderSelectPage(catalog: Catalog): HTMLElement {
  const page = document.createElement('main');
  page.className = 'app-shell';
  let firstSourceRendered = false;
  const selectedSubjectId = readSubjectId(catalog);
  const visibleSubjects = catalog.subjects.filter((subject) => subject.id === selectedSubjectId);
  const selectedSubject = visibleSubjects[0];

  const subjects = visibleSubjects
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
        <fieldset class="segmented-field source-field">
          <legend>출처 선택</legend>
          <div class="check-list">${sources}</div>
        </fieldset>
      `;
    })
    .join('');

  page.innerHTML = `
    ${renderNav()}
    <section class="page-header">
      <p class="eyebrow">select</p>
      <h1>${escapeHtml(selectedSubject?.title ?? '문제 선택')}</h1>
      <p class="lead">선택한 과목의 문제 출처와 풀이 방식을 정합니다.</p>
    </section>
    <section class="subject-switcher" aria-label="과목 변경">
      <label>
        <span>과목</span>
        <select data-subject-switcher>
          ${catalog.subjects
            .map(
              (subject) => `
                <option value="${escapeHtml(subject.id)}" ${subject.id === selectedSubject?.id ? 'selected' : ''}>
                  ${escapeHtml(subject.title)}
                </option>
              `,
            )
            .join('')}
        </select>
      </label>
    </section>
    <section class="stack">${subjects}</section>
    <section class="settings-grid" aria-label="풀이 설정">
      ${renderScopeSetting()}
      ${renderOrderSetting('문제순서 설정', 'question-order', 'questionOrder')}
      ${renderOrderSetting('선지순서 설정', 'choice-order', 'choiceOrder')}
    </section>
    <p class="form-message" data-select-message></p>
    <div class="action-row">
      <button class="primary-button" type="button" data-start-quiz>풀이 시작</button>
    </div>
    ${renderFooter()}
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
    savePracticeScope(readPracticeScope(page));
    savePracticeOptions(readPracticeOptions(page));
    window.location.hash = '#/quiz';
  });

  page.querySelector<HTMLSelectElement>('[data-subject-switcher]')?.addEventListener('change', () => {
    const select = page.querySelector<HTMLSelectElement>('[data-subject-switcher]');
    if (!select) {
      return;
    }

    window.location.hash = `#/select?subject=${encodeURIComponent(select.value)}`;
  });

  return page;
}

function readSubjectId(catalog: Catalog): string | undefined {
  const query = window.location.hash.split('?')[1] ?? '';
  const subjectId = new URLSearchParams(query).get('subject');
  const requestedSubject = catalog.subjects.find((subject) => subject.id === subjectId);
  const firstAvailableSubject = catalog.subjects.find((subject) => subject.sources.length > 0);
  return requestedSubject?.id ?? firstAvailableSubject?.id;
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

function renderOrderSetting(label: string, groupLabel: string, name: keyof PracticeOptions): string {
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
