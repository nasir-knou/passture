export function renderQuizPage(): HTMLElement {
  const page = document.createElement('main');
  page.className = 'app-shell';
  page.innerHTML = `
    <nav class="top-nav" aria-label="주요 메뉴">
      <a href="#/">홈</a>
      <a href="#/select">문제 선택</a>
      <a href="#/result">결과</a>
    </nav>
    <section class="page-header">
      <p class="eyebrow">quiz</p>
      <h1>풀이</h1>
      <p class="lead">문제 카드, 공통 지문, 선택지, 정답 확인 영역이 들어갈 화면입니다.</p>
    </section>
    <section class="panel">
      <p class="muted">M4에서 데이터 로딩, 문제/선택지 셔플, 채점 상태를 연결합니다.</p>
    </section>
  `;
  return page;
}
