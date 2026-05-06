export function renderResultPage(): HTMLElement {
  const page = document.createElement('main');
  page.className = 'app-shell';
  page.innerHTML = `
    <nav class="top-nav" aria-label="주요 메뉴">
      <a href="#/">홈</a>
      <a href="#/select">문제 선택</a>
      <a href="#/quiz">풀이</a>
    </nav>
    <section class="page-header">
      <p class="eyebrow">result</p>
      <h1>결과</h1>
      <p class="lead">총 문항, 정답 수, 정답률과 문제별 요약이 들어갈 화면입니다.</p>
    </section>
  `;
  return page;
}
