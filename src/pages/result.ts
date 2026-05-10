import {
  clearSession,
  loadPracticeOptions,
  loadSession,
  scoreSession,
  savePracticeOptions,
  savePracticeScope,
  saveSelectedSources,
  type QuizResponse,
  type QuizSession,
  type QuizSessionQuestion,
  type SelectedSource,
} from '../lib/quiz-session';
import type { Catalog } from '../types/catalog';
import { loadBookmarks } from '../lib/storage';
import { escapeHtml, renderFooter, renderTopNav } from './shared';
import {
  formatAnswerSummary,
  renderAnswerExplanationBody,
  renderChoiceContent,
  renderPassages,
  renderQuestionImages,
  renderRichText,
} from './rendering';

export function renderResultPage(catalog: Catalog): HTMLElement {
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
      <section class="empty-state-card">
        <strong>표시할 결과가 없습니다.</strong>
        <p>풀이를 완료하면 정답률, 오답, 출처별 결과가 여기에 정리됩니다.</p>
        <a class="primary-link" href="#/select">문제 선택</a>
      </section>
      ${renderFooter()}
    `;
    return page;
  }

  const score = scoreSession(session);
  const report = createResultReport(session, score);
  const selectedIndex = readQuestionIndex(session.questions.length);
  const selectedQuestion = session.questions[selectedIndex] ?? session.questions[0];
  page.innerHTML = `
    ${renderNav()}
    <section class="page-header">
      <p class="eyebrow">result</p>
      <h1>결과</h1>
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
    ${renderResultReport(report)}
    ${renderSourceBreakdown(session)}
    ${renderResultNavigator(session, selectedIndex)}
    ${selectedQuestion ? renderReviewCard(selectedQuestion, session.responses[selectedQuestion.key]) : ''}
    <div class="action-row">
      <a class="secondary-link" href="#/quiz">풀이로 돌아가기</a>
      <button class="secondary-button" type="button" data-retry-wrong ${report.wrong === 0 ? 'disabled' : ''}>오답만 다시 풀기</button>
      <button class="secondary-button" type="button" data-retry-bookmarked ${report.bookmarked === 0 ? 'disabled' : ''}>북마크만 다시 풀기</button>
      <button class="secondary-button danger-button" type="button" data-new-session>새 세션 시작</button>
    </div>
    ${renderFooter()}
  `;

  bindRetryActions(page, session, catalog);

  page.querySelector<HTMLButtonElement>('[data-new-session]')?.addEventListener('click', () => {
    clearSession();
    window.location.hash = '#/select';
  });

  return page;
}

interface ResultReport {
  total: number;
  answered: number;
  correct: number;
  wrong: number;
  unanswered: number;
  percent: number;
  bookmarked: number;
}

function createResultReport(
  session: QuizSession,
  score: ReturnType<typeof scoreSession>,
): ResultReport {
  const bookmarkedKeys = new Set(loadBookmarks());
  const wrong = Object.values(session.responses).filter((response) => !response.correct).length;

  return {
    total: score.total,
    answered: score.answered,
    correct: score.correct,
    wrong,
    unanswered: Math.max(score.total - score.answered, 0),
    percent: score.percent,
    bookmarked: session.questions.filter((question) => bookmarkedKeys.has(question.key)).length,
  };
}

function renderResultReport(report: ResultReport): string {
  return `
    <section class="result-report panel" aria-label="결과 리포트">
      <div class="result-report-header">
        <div>
          <span class="status-badge">리포트</span>
          <strong>${report.percent}% 정답률</strong>
        </div>
        <span class="muted">${report.answered}/${report.total} 응답</span>
      </div>
      <div class="result-percent-bar" aria-label="정답률 ${report.percent}%">
        <span style="width: ${report.percent}%"></span>
      </div>
      <div class="result-metrics">
        <span class="status-badge is-correct">정답 ${report.correct}</span>
        <span class="status-badge is-wrong">오답 ${report.wrong}</span>
        <span class="status-badge is-unanswered">미응답 ${report.unanswered}</span>
      </div>
    </section>
  `;
}

function renderSourceBreakdown(session: QuizSession): string {
  const sources = createSourceStats(session);
  return `
    <section class="result-source-set panel" aria-label="출처별 결과 요약">
      <div class="result-report-header">
        <div>
          <span class="status-badge">출처별 결과</span>
          <strong>출처 ${sources.length}개</strong>
        </div>
      </div>
      <div class="source-stat-grid">
        ${sources
          .map(
            (source) => `
              <article class="source-stat-card">
                <div>
                  <strong>${escapeHtml(source.title)}</strong>
                  <small>${escapeHtml(source.subjectTitle)}</small>
                </div>
                <div class="source-stat-meta">
                  <span>${source.percent}%</span>
                  <small>${source.correct}/${source.answered} 정답 · ${source.total}문항</small>
                </div>
              </article>
            `,
          )
          .join('')}
      </div>
    </section>
  `;
}

interface SourceStat {
  subjectId: string;
  subjectTitle: string;
  sourceId: string;
  title: string;
  total: number;
  answered: number;
  correct: number;
  percent: number;
}

function createSourceStats(session: QuizSession): SourceStat[] {
  const stats = new Map<string, SourceStat>();

  session.questions.forEach((question) => {
    const key = `${question.subjectId}:${question.sourceId}`;
    const current =
      stats.get(key) ??
      ({
        subjectId: question.subjectId,
        subjectTitle: question.subjectTitle,
        sourceId: question.sourceId,
        title: question.sourceTitle,
        total: 0,
        answered: 0,
        correct: 0,
        percent: 0,
      } satisfies SourceStat);
    const response = session.responses[question.key];
    current.total += 1;
    if (response) {
      current.answered += 1;
      if (response.correct) {
        current.correct += 1;
      }
    }
    current.percent =
      current.answered === 0 ? 0 : Math.round((current.correct / current.answered) * 100);
    stats.set(key, current);
  });

  return [...stats.values()];
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
    <details class="question-map result-map collapsible-map" aria-label="문제별 결과 바로가기" open>
      <summary>문제별 결과</summary>
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
    </details>
  `;
}

function bindRetryActions(page: HTMLElement, session: QuizSession, catalog: Catalog): void {
  const retrySources = createSelectedSourcesFromSession(session, catalog);

  page.querySelector<HTMLButtonElement>('[data-retry-wrong]')?.addEventListener('click', () => {
    startScopedRetry(retrySources, 'wrong');
  });

  page
    .querySelector<HTMLButtonElement>('[data-retry-bookmarked]')
    ?.addEventListener('click', () => {
      startScopedRetry(retrySources, 'bookmarked');
    });
}

function startScopedRetry(sources: SelectedSource[], scope: 'wrong' | 'bookmarked'): void {
  if (sources.length === 0) {
    window.location.hash = '#/select';
    return;
  }

  saveSelectedSources(sources);
  savePracticeScope(scope);
  savePracticeOptions(loadPracticeOptions());
  clearSession();
  window.location.hash = '#/quiz';
}

function createSelectedSourcesFromSession(
  session: QuizSession,
  catalog: Catalog,
): SelectedSource[] {
  const sources = new Map<string, SelectedSource>();

  session.questions.forEach((question) => {
    const key = `${question.subjectId}:${question.sourceId}`;
    if (sources.has(key)) {
      return;
    }

    const catalogSubject = catalog.subjects.find((subject) => subject.id === question.subjectId);
    const catalogSource = catalogSubject?.sources.find((source) => source.id === question.sourceId);
    if (!catalogSource) {
      return;
    }

    sources.set(key, {
      subjectId: question.subjectId,
      subjectTitle: question.subjectTitle,
      sourceId: question.sourceId,
      sourceTitle: question.sourceTitle,
      path: catalogSource.path,
    });
  });

  return [...sources.values()];
}

function renderReviewCard(
  question: QuizSessionQuestion,
  response: QuizResponse | undefined,
): string {
  const selected = new Set(response?.selected ?? []);

  return `
    <article class="question-card result-review-card">
      <div>
        <p class="eyebrow">${escapeHtml(sourceDisplayLabel(question.subjectTitle, question.sourceTitle))}</p>
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
              question.choices,
              question.question.answers,
              question.question.explanation,
            )
          : `<section class="explanation unanswered"><h2>미응답</h2><p>문제 ID: ${escapeHtml(question.key)}</p><p>정답: ${escapeHtml(formatAnswerSummary(question.choices, question.question.answers))}</p>${renderAnswerExplanationBody(question.choices, question.question.answers, question.question.explanation)}</section>`
      }
    </article>
  `;
}

function renderExplanation(
  questionKey: string,
  correct: boolean,
  choices: QuizSessionQuestion['choices'],
  answers: readonly string[],
  explanation: string,
): string {
  return `
    <section class="explanation ${correct ? 'correct' : 'incorrect'}">
      <h2>${correct ? '정답' : '오답'}</h2>
      <p>문제 ID: ${escapeHtml(questionKey)}</p>
      <p>정답: ${escapeHtml(formatAnswerSummary(choices, answers))}</p>
      ${renderAnswerExplanationBody(choices, answers, explanation)}
    </section>
  `;
}

function sourceDisplayLabel(subjectTitle: string, sourceTitle: string): string {
  return `${subjectTitle} - ${sourceTitle}`;
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
