import {
  clearSession,
  loadSession,
  scoreSession,
  type QuizResponse,
  type QuizSession,
  type QuizSessionQuestion,
} from '../lib/quiz-session';
import { escapeHtml, renderFooter, renderTopNav } from './shared';
import {
  renderBlockRichText,
  renderChoiceContent,
  renderPassages,
  renderQuestionImages,
  renderRichText,
} from './rendering';

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
  const selectedIndex = readQuestionIndex(session.questions.length);
  const selectedQuestion = session.questions[selectedIndex] ?? session.questions[0];
  page.innerHTML = `
    ${renderNav()}
    <section class="page-header">
      <p class="eyebrow">result</p>
      <h1>결과</h1>
      ${renderSourceSet(session)}
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
    ${renderResultNavigator(session, selectedIndex)}
    ${selectedQuestion ? renderReviewCard(selectedQuestion, session.responses[selectedQuestion.key]) : ''}
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

function renderSourceSet(session: QuizSession): string {
  const sources = [
    ...new Map(
      session.questions.map((question) => [
        `${question.subjectId}:${question.sourceId}`,
        {
          subjectId: question.subjectId,
          sourceId: question.sourceId,
          title: question.sourceTitle,
          count: session.questions.filter((item) => item.sourceId === question.sourceId).length,
        },
      ]),
    ).values(),
  ];

  return `
    <section class="result-source-set" aria-label="출처 세트">
      <p class="muted">이번 결과의 출처 세트</p>
      <div class="source-chip-list">
        ${sources
          .map(
            (source) => `
              <span class="source-chip">
                <strong>${escapeHtml(source.title)}</strong>
                <small>${escapeHtml(source.subjectId)} · ${escapeHtml(source.sourceId)} · ${source.count}문항</small>
              </span>
            `,
          )
          .join('')}
      </div>
    </section>
  `;
}

function readQuestionIndex(total: number): number {
  const query = window.location.hash.split('?')[1] ?? '';
  const requested = Number(new URLSearchParams(query).get('question'));

  if (!Number.isInteger(requested)) {
    return 0;
  }

  return Math.min(Math.max(requested - 1, 0), Math.max(total - 1, 0));
}

function renderResultNavigator(session: QuizSession, selectedIndex: number): string {
  return `
    <section class="question-map result-map" aria-label="문제별 결과 바로가기">
      <div class="question-map-grid">
        ${session.questions
          .map((question, index) => {
            const response = session.responses[question.key];
            const state = response ? (response.correct ? 'correct' : 'incorrect') : 'unanswered';
            const current = index === selectedIndex;

            return `
              <a
                class="question-map-item result-map-item is-${state} ${current ? 'is-current' : ''}"
                href="#/result?question=${index + 1}"
                aria-label="${index + 1}번 ${resultStateLabel(state)}"
                ${current ? 'aria-current="step"' : ''}
              >
                <span>${index + 1}</span>
              </a>
            `;
          })
          .join('')}
      </div>
      <div class="question-map-legend" aria-label="결과 범례">
        <span><i class="legend-current"></i>현재</span>
        <span><i class="legend-correct"></i>정답</span>
        <span><i class="legend-incorrect"></i>오답</span>
        <span><i class="legend-unanswered"></i>미응답</span>
      </div>
    </section>
  `;
}

function renderReviewCard(
  question: QuizSessionQuestion,
  response: QuizResponse | undefined,
): string {
  const selected = new Set(response?.selected ?? []);

  return `
    <article class="question-card result-review-card">
      <div>
        <p class="eyebrow">${escapeHtml(question.sourceTitle)}</p>
        <p class="question-prompt">${renderRichText(question.question.prompt)}</p>
      </div>
      ${renderPassages(question.passages)}
      ${renderQuestionImages(question.question.images ?? [])}
      <fieldset class="choice-list">
        <legend class="sr-only">선택지</legend>
        ${question.choices
          .map(
            (choice) => `
              <label class="choice-row ${choiceClass(choice.id, question.question.answers, selected)}">
                <input
                  type="${question.question.answers.length > 1 ? 'checkbox' : 'radio'}"
                  name="result-answer"
                  value="${escapeHtml(choice.id)}"
                  ${selected.has(choice.id) ? 'checked' : ''}
                  disabled
                />
                ${renderChoiceContent(choice)}
              </label>
            `,
          )
          .join('')}
      </fieldset>
      ${
        response
          ? renderExplanation(
              question.key,
              response.correct,
              question.question.answers,
              question.question.explanation,
            )
          : `<section class="explanation unanswered"><h2>미응답</h2><p>문제 ID: ${escapeHtml(question.key)}</p><p>정답: ${question.question.answers.map(escapeHtml).join(', ')}</p>${renderBlockRichText(question.question.explanation, 'explanation-body')}</section>`
      }
    </article>
  `;
}

function renderExplanation(
  questionKey: string,
  correct: boolean,
  answers: readonly string[],
  explanation: string,
): string {
  return `
    <section class="explanation ${correct ? 'correct' : 'incorrect'}">
      <h2>${correct ? '정답' : '오답'}</h2>
      <p>문제 ID: ${escapeHtml(questionKey)}</p>
      <p>정답: ${answers.map(escapeHtml).join(', ')}</p>
      ${renderBlockRichText(explanation, 'explanation-body')}
    </section>
  `;
}

function choiceClass(id: string, answers: readonly string[], selected: Set<string>): string {
  if (answers.includes(id)) {
    return 'is-answer';
  }

  if (selected.has(id)) {
    return 'is-selected-wrong';
  }

  return '';
}

function resultStateLabel(state: 'correct' | 'incorrect' | 'unanswered'): string {
  switch (state) {
    case 'correct':
      return '정답';
    case 'incorrect':
      return '오답';
    case 'unanswered':
      return '미응답';
  }
}

function renderNav(): string {
  return renderTopNav('result', [
    { href: '#/select', label: '문제 선택', id: 'select' },
    { href: '#/mock-exam', label: '모의 시험', id: 'mock-exam' },
    { href: '#/quiz', label: '풀이', id: 'quiz' },
    { href: '#/result', label: '결과', id: 'result' },
    { href: '#/backup', label: '데이터 관리', id: 'backup' },
  ]);
}
