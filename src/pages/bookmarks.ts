export function renderBookmarksPage(): HTMLElement {
  const page = document.createElement('main');
  page.className = 'app-shell';
  page.innerHTML = `
    <nav class="top-nav" aria-label="주요 메뉴">
      <a href="#/">홈</a>
      <a href="#/select">문제 선택</a>
      <a href="#/backup">백업</a>
    </nav>
    <section class="page-header">
      <p class="eyebrow">bookmarks</p>
      <h1>북마크</h1>
      <p class="lead">저장된 문제 목록과 북마크 전용 풀이 진입점이 들어갈 화면입니다.</p>
    </section>
  `;
  return page;
}
