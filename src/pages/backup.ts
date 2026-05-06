export function renderBackupPage(): HTMLElement {
  const page = document.createElement('main');
  page.className = 'app-shell';
  page.innerHTML = `
    <nav class="top-nav" aria-label="주요 메뉴">
      <a href="#/">홈</a>
      <a href="#/bookmarks">북마크</a>
      <a href="#/select">문제 선택</a>
    </nav>
    <section class="page-header">
      <p class="eyebrow">backup</p>
      <h1>백업 / 복원</h1>
      <p class="lead">localStorage 기반 사용자 데이터를 JSON으로 내보내고 가져오는 화면입니다.</p>
    </section>
  `;
  return page;
}
