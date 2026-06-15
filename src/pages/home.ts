import type { Catalog, Semester } from '../types/catalog';
import { escapeHtml, renderFooter, renderTopNav, semesterLabel, sourceKindLabel } from './shared';

type SemesterFilter = 'all' | Semester;

export function renderHomePage(catalog: Catalog): HTMLElement {
  const page = document.createElement('main');
  page.className = 'app-shell';

  const subjectCards = catalog.subjects
    .map((subject) => {
      const sources = subject.sources.length
        ? subject.sources
            .map(
              (source) => `<li>${escapeHtml(source.title)} · ${sourceKindLabel(source.kind)}</li>`,
            )
            .join('')
        : '<li>등록된 출처 없음</li>';

      return `
        <article class="card subject-card" data-subject-card data-semester="${subject.semester}">
          <div>
            <span class="status-badge semester-badge">${semesterLabel(subject.semester)}</span>
            <h2>${escapeHtml(subject.title)}</h2>
            <p class="muted">${subject.sources.length}개 출처</p>
          </div>
          <ul class="compact-list">${sources}</ul>
          <a class="text-link card-action" href="#/select?subject=${escapeHtml(subject.id)}">선택</a>
        </article>
      `;
    })
    .join('');

  page.innerHTML = `
    ${renderTopNav('home')}
    <section class="page-header">
      <h1 class="home-title">문제풀이로 달리는 양치기들의 초원</h1>
      <p class="lead home-lead">기출/교재/강의 문제들을 모아놓은 Pasture에서 시험감각을 익히고 Pass하세요</p>
    </section>
    <section class="semester-filter" aria-label="학기별 과목 필터">
      ${renderSemesterFilterButton('all', '전체', true)}
      ${renderSemesterFilterButton(1, '1학기')}
      ${renderSemesterFilterButton(2, '2학기')}
    </section>
    <section class="grid subject-grid" aria-label="과목 목록">
      ${subjectCards}
    </section>
    ${renderFooter()}
  `;

  bindSemesterFilter(page);
  return page;
}

function renderSemesterFilterButton(value: SemesterFilter, label: string, checked = false): string {
  return `
    <label>
      <input type="radio" name="semester-filter" value="${value}" ${checked ? 'checked' : ''} />
      <span>${label}</span>
    </label>
  `;
}

function bindSemesterFilter(page: HTMLElement): void {
  page.querySelectorAll<HTMLInputElement>('input[name="semester-filter"]').forEach((input) => {
    input.addEventListener('change', () => filterSubjectCards(page, readSemesterFilter(page)));
  });
}

function readSemesterFilter(page: HTMLElement): SemesterFilter {
  const checked = page.querySelector<HTMLInputElement>('input[name="semester-filter"]:checked');
  return checked?.value === '1' ? 1 : checked?.value === '2' ? 2 : 'all';
}

function filterSubjectCards(page: HTMLElement, semester: SemesterFilter): void {
  page.querySelectorAll<HTMLElement>('[data-subject-card]').forEach((card) => {
    card.hidden = semester !== 'all' && card.dataset.semester !== String(semester);
  });
}
