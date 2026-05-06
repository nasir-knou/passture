import { loadBookmarks, removeBookmark } from '../lib/storage';
import { escapeHtml } from './shared';

export function renderBookmarksPage(): HTMLElement {
  const page = document.createElement('main');
  page.className = 'app-shell';
  const bookmarks = loadBookmarks();

  page.innerHTML = `
    <nav class="top-nav" aria-label="주요 메뉴">
      <a href="#/">홈</a>
      <a href="#/select">문제 선택</a>
      <a href="#/backup">백업</a>
    </nav>
    <section class="page-header">
      <p class="eyebrow">bookmarks</p>
      <h1>북마크</h1>
      <p class="lead">브라우저에 저장된 북마크 문제 키를 관리합니다.</p>
    </section>
    ${
      bookmarks.length === 0
        ? '<section class="panel"><p class="muted">아직 북마크한 문제가 없습니다.</p></section>'
        : `<section class="stack">${bookmarks.map(renderBookmark).join('')}</section>`
    }
  `;

  page.querySelectorAll<HTMLButtonElement>('[data-remove-bookmark]').forEach((button) => {
    button.addEventListener('click', () => {
      const key = button.dataset.removeBookmark;
      if (key) {
        removeBookmark(key);
        window.location.hash = `#/bookmarks?ts=${Date.now()}`;
      }
    });
  });

  return page;
}

function renderBookmark(key: string): string {
  return `
    <article class="panel result-item">
      <strong>${escapeHtml(key)}</strong>
      <button class="secondary-button" type="button" data-remove-bookmark="${escapeHtml(key)}">
        해제
      </button>
    </article>
  `;
}
