import type { Catalog } from '../types/catalog';
import { renderFooter, renderTopNav, sourceKindLabel } from './shared';

export function renderHomePage(catalog: Catalog): HTMLElement {
  const page = document.createElement('main');
  page.className = 'app-shell';

  const subjectCards = catalog.subjects
    .map((subject) => {
      const sources = subject.sources.length
        ? subject.sources
            .map((source) => `<li>${source.title} · ${sourceKindLabel(source.kind)}</li>`)
            .join('')
        : '<li>등록된 출처 없음</li>';

      return `
        <article class="card">
          <div>
            <h2>${subject.title}</h2>
            <p class="muted">${subject.sources.length}개 출처</p>
          </div>
          <ul class="compact-list">${sources}</ul>
          <a class="text-link card-action" href="#/select?subject=${subject.id}">선택</a>
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
    <section class="grid" aria-label="과목 목록">
      ${subjectCards}
    </section>
    ${renderFooter()}
  `;

  return page;
}
