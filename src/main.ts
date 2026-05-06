import './styles.css';

const app = document.querySelector<HTMLDivElement>('#app');

if (!app) {
  throw new Error('App root element was not found.');
}

app.innerHTML = `
  <main class="shell">
    <section class="hero" aria-labelledby="page-title">
      <p class="eyebrow">passture</p>
      <h1 id="page-title">방통대 기말고사 대비 문제풀이</h1>
      <p class="lead">Vite + TypeScript 기반 첫 배포 준비가 완료되었습니다.</p>
      <a class="primary-link" href="#/select">문제 선택으로 이동</a>
    </section>
  </main>
`;
