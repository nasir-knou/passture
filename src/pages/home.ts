import type { Catalog } from '../types/catalog';
import { renderFooter, sourceKindLabel } from './shared';

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
          <a class="text-link" href="#/select?subject=${subject.id}">선택</a>
        </article>
      `;
    })
    .join('');

  page.innerHTML = `
    <nav class="top-nav" aria-label="주요 메뉴">
      <a href="#/">홈</a>
      <a href="#/select">문제 선택</a>
      <a href="#/bookmarks">북마크</a>
      <a href="#/backup">백업</a>
    </nav>
    <section class="page-header">
      <p class="eyebrow">passture</p>
      <h1>방통대 기말고사 대비 문제풀이</h1>
      <p class="lead">과목과 출처를 골라 정적 데이터 기반 문제풀이 세션을 시작합니다.</p>
    </section>
    <section class="grid" aria-label="과목 목록">
      ${subjectCards}
    </section>
    ${renderFooter()}
  `;

  return page;
}
