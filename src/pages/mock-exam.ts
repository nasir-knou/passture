import { renderFooter, renderTopNav } from './shared';

export function renderMockExamPage(): HTMLElement {
  const page = document.createElement('main');
  page.className = 'app-shell';

  page.innerHTML = `
    ${renderTopNav('mock-exam')}
    <section class="page-header">
      <p class="eyebrow">mock exam</p>
      <h1>모의 시험</h1>
      <p class="lead">시간 제한, 문항 수, 범위 설정을 갖춘 모의 시험 모드는 준비 중입니다.</p>
    </section>
    <section class="panel">
      <h2>TODO</h2>
      <p class="muted">모의 시험 구성과 결과 리포트 흐름을 이후 작업에서 구현합니다.</p>
    </section>
    ${renderFooter()}
  `;

  return page;
}
