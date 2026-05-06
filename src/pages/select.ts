import type { Catalog } from '../types/catalog';
import { sourceKindLabel } from './shared';

export function renderSelectPage(catalog: Catalog): HTMLElement {
  const page = document.createElement('main');
  page.className = 'app-shell';

  const subjects = catalog.subjects
    .map((subject) => {
      const sources = subject.sources.length
        ? subject.sources
            .map(
              (source) => `
                <label class="check-row">
                  <input type="checkbox" name="source" value="${subject.id}:${source.id}" />
                  <span>
                    <strong>${source.title}</strong>
                    <small>${sourceKindLabel(source.kind)}${source.year ? ` · ${source.year}` : ''}</small>
                  </span>
                </label>
              `,
            )
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
      <p class="lead">M4에서 선택된 출처를 세션으로 묶고 셔플·채점 흐름으로 연결합니다.</p>
    </section>
    <section class="stack">${subjects}</section>
    <div class="action-row">
      <a class="primary-link" href="#/quiz">풀이 골격 보기</a>
    </div>
  `;

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
