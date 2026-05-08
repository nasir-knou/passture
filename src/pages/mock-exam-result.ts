import {
  clearMockExamSession,
  gradeSession,
  loadMockExamSession,
  type MockExamGradeResult,
  type MockExamSession,
} from '../lib/mock-exam-session';
import type { QuizSessionQuestion } from '../lib/quiz-session';
import { escapeHtml, renderFooter, renderTopNav } from './shared';
import {
  formatAnswerSummary,
  renderAnswerExplanationBody,
  renderChoiceContent,
  renderPassages,
  renderQuestionImages,
  renderRichText,
} from './rendering';

export function renderMockExamResultPage(): HTMLElement {
  const page = document.createElement('main');
  page.className = 'app-shell';

  const session = loadMockExamSession();

  if (!session) {
    page.innerHTML = `
      ${renderTopNav('mock-exam')}
      <section class="page-header">
        <p class="eyebrow">mock exam</p>
        <h1>결과가 없습니다</h1>
        <p class="lead">모의 시험을 먼저 시작해 주세요.</p>
      </section>
      <a class="primary-link" href="#/mock-exam">모의 시험 설정으로</a>
      ${renderFooter()}
    `;
    return page;
  }

  const grades = gradeSession(session);
  const totalCorrect = grades.reduce((sum, g) => sum + g.correct, 0);
  const totalQuestions = grades.reduce((sum, g) => sum + g.total, 0);
  const activeIndex = readActiveSubjectIndex(grades.length);

  page.innerHTML = `
    ${renderTopNav('mock-exam')}
    <section class="page-header">
      <p class="eyebrow">mock exam · result</p>
      <h1>모의 시험 결과</h1>
    </section>
    <section class="score-grid" aria-label="전체 점수">
      <article class="score-card">
        <strong>${totalQuestions}</strong>
        <span>총 문항</span>
      </article>
      <article class="score-card">
        <strong>${totalCorrect}</strong>
        <span>정답</span>
      </article>
      <article class="score-card">
        <strong>${totalQuestions > 0 ? Math.round((totalCorrect / totalQuestions) * 100) : 0}%</strong>
        <span>전체 정답률</span>
      </article>
    </section>
    <div class="mock-result-tabs" role="tablist" aria-label="과목별 결과">
      ${grades
        .map(
          (grade, index) => `
            <a
              class="exam-tab ${index === activeIndex ? 'is-active' : ''}"
              href="#/mock-exam/result?subject=${index}"
              role="tab"
              aria-selected="${index === activeIndex}"
            >
              ${escapeHtml(grade.subjectTitle)}
              <span class="exam-tab-count">(${grade.correct}/${grade.total})</span>
            </a>
          `,
        )
        .join('')}
    </div>
    ${grades[activeIndex] ? renderSubjectResult(grades[activeIndex]!, session, activeIndex) : ''}
    <div class="action-row">
      <a class="secondary-link" href="#/mock-exam">새 모의 시험</a>
      <button class="primary-button" type="button" data-clear-session>세션 초기화</button>
    </div>
    ${renderFooter()}
  `;

  page.querySelector<HTMLButtonElement>('[data-clear-session]')?.addEventListener('click', () => {
    clearMockExamSession();
    window.location.hash = '#/mock-exam';
  });

  return page;
}

function renderSubjectResult(
  grade: MockExamGradeResult,
  session: MockExamSession,
  subjectIndex: number,
): string {
  const subjectSession = session.subjects[subjectIndex];
  if (!subjectSession) return '';

  const selectedQuestionIndex = readSelectedQuestionIndex(grade.total);
  const selectedQuestion = subjectSession.questions[selectedQuestionIndex];

  return `
    <section class="mock-result-subject" aria-label="${escapeHtml(grade.subjectTitle)} 결과">
      <section class="score-grid" aria-label="${escapeHtml(grade.subjectTitle)} 점수">
        <article class="score-card">
          <strong>${grade.total}</strong>
          <span>총 문항</span>
        </article>
        <article class="score-card">
          <strong>${grade.answered}</strong>
          <span>응답</span>
        </article>
        <article class="score-card">
          <strong>${grade.correct}</strong>
          <span>정답</span>
        </article>
        <article class="score-card">
          <strong>${grade.total > 0 ? Math.round((grade.correct / grade.total) * 100) : 0}%</strong>
          <span>정답률</span>
        </article>
      </section>
      ${renderResultNavigator(grade, subjectIndex, selectedQuestionIndex)}
      ${selectedQuestion ? renderReviewCard(selectedQuestion, grade, subjectIndex, selectedQuestionIndex) : ''}
    </section>
  `;
}

function renderResultNavigator(
  grade: MockExamGradeResult,
  subjectIndex: number,
  selectedIndex: number,
): string {
  return `
    <section class="question-map result-map" aria-label="문제별 결과 바로가기">
      <div class="question-map-grid">
        ${grade.results
          .map((result, index) => {
            const state = result.selected.length === 0
              ? 'unanswered'
              : result.isCorrect
                ? 'correct'
                : 'incorrect';
            const current = index === selectedIndex;

            return `
              <a
                class="question-map-item result-map-item is-${state} ${current ? 'is-current' : ''}"
                href="#/mock-exam/result?subject=${subjectIndex}&question=${index + 1}"
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
  grade: MockExamGradeResult,
  subjectIndex: number,
  questionIndex: number,
): string {
  const result = grade.results[questionIndex];
  const selected = new Set(result?.selected ?? []);
  const isCorrect = result?.isCorrect ?? false;
  const hasAnswer = (result?.selected.length ?? 0) > 0;

  return `
    <article class="question-card result-review-card">
      <div>
        <p class="eyebrow">${escapeHtml(question.subjectTitle)} — ${escapeHtml(question.sourceTitle)}</p>
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
                  name="result-answer-${subjectIndex}-${questionIndex}"
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
        hasAnswer
          ? `
            <section class="explanation ${isCorrect ? 'correct' : 'incorrect'}">
              <h2>${isCorrect ? '정답' : '오답'}</h2>
              <p>문제 ID: ${escapeHtml(question.key)}</p>
              <p>정답: ${escapeHtml(formatAnswerSummary(question.choices, question.question.answers))}</p>
              ${renderAnswerExplanationBody(question.choices, question.question.answers, question.question.explanation)}
            </section>
          `
          : `
            <section class="explanation unanswered">
              <h2>미응답</h2>
              <p>문제 ID: ${escapeHtml(question.key)}</p>
              <p>정답: ${escapeHtml(formatAnswerSummary(question.choices, question.question.answers))}</p>
              ${renderAnswerExplanationBody(question.choices, question.question.answers, question.question.explanation)}
            </section>
          `
      }
    </article>
  `;
}

function choiceClass(id: string, answers: readonly string[], selected: Set<string>): string {
  if (answers.includes(id)) return 'is-answer';
  if (selected.has(id)) return 'is-selected-wrong';
  return '';
}

function resultStateLabel(state: 'correct' | 'incorrect' | 'unanswered'): string {
  switch (state) {
    case 'correct': return '정답';
    case 'incorrect': return '오답';
    case 'unanswered': return '미응답';
  }
}

function readActiveSubjectIndex(total: number): number {
  const query = window.location.hash.split('?')[1] ?? '';
  const requested = Number(new URLSearchParams(query).get('subject'));
  if (!Number.isInteger(requested)) return 0;
  return Math.min(Math.max(requested, 0), Math.max(total - 1, 0));
}

function readSelectedQuestionIndex(total: number): number {
  const query = window.location.hash.split('?')[1] ?? '';
  const requested = Number(new URLSearchParams(query).get('question'));
  if (!Number.isInteger(requested)) return 0;
  return Math.min(Math.max(requested - 1, 0), Math.max(total - 1, 0));
}
