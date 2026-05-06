import { clearSession, loadSession, scoreSession } from '../lib/quiz-session';
import { escapeHtml, renderFooter } from './shared';

export function renderResultPage(): HTMLElement {
  const page = document.createElement('main');
  page.className = 'app-shell';
  const session = loadSession();

  if (!session) {
    page.innerHTML = `
      ${renderNav()}
      <section class="page-header">
        <p class="eyebrow">result</p>
        <h1>결과가 없습니다</h1>
        <p class="lead">문제 선택 화면에서 새 풀이 세션을 시작해 주세요.</p>
      </section>
      <a class="primary-link" href="#/select">문제 선택</a>
      ${renderFooter()}
    `;
    return page;
  }

  const score = scoreSession(session);

  page.innerHTML = `
    ${renderNav()}
    <section class="page-header">
      <p class="eyebrow">result</p>
      <h1>결과</h1>
      <p class="lead">${score.total}문항 중 ${score.correct}문항 정답, 정답률 ${score.percent}%</p>
    </section>
    <section class="score-grid" aria-label="점수 요약">
      <article class="score-card">
        <strong>${score.total}</strong>
        <span>총 문항</span>
      </article>
      <article class="score-card">
        <strong>${score.answered}</strong>
        <span>응답</span>
      </article>
      <article class="score-card">
        <strong>${score.correct}</strong>
        <span>정답</span>
      </article>
      <article class="score-card">
        <strong>${score.percent}%</strong>
        <span>정답률</span>
      </article>
    </section>
    <section class="stack result-list" aria-label="문제별 결과">
      ${session.questions
        .map((question, index) => {
          const response = session.responses[question.key];
          return `
            <article class="panel result-item">
              <strong>${index + 1}. ${escapeHtml(question.question.prompt)}</strong>
              <span class="${response?.correct ? 'status-correct' : 'status-incorrect'}">
                ${response ? (response.correct ? '정답' : '오답') : '미응답'}
              </span>
            </article>
          `;
        })
        .join('')}
    </section>
    <div class="action-row">
      <a class="secondary-link" href="#/quiz">풀이로 돌아가기</a>
      <button class="primary-button" type="button" data-new-session>새 세션 시작</button>
    </div>
    ${renderFooter()}
  `;

  page.querySelector<HTMLButtonElement>('[data-new-session]')?.addEventListener('click', () => {
    clearSession();
    window.location.hash = '#/select';
  });

  return page;
}

function renderNav(): string {
  return `
    <nav class="top-nav" aria-label="주요 메뉴">
      <a href="#/">홈</a>
      <a href="#/select">문제 선택</a>
      <a href="#/quiz">풀이</a>
    </nav>
  `;
}
