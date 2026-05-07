import type { Catalog } from '../types/catalog';
import { loadQuestionFile } from '../lib/data-loader';
import {
  answerAllDraftQuestions,
  answerCurrentQuestion,
  defaultSelectedSources,
  getOrCreateSession,
  loadPracticeOptions,
  loadPracticeScope,
  loadSelectedSources,
  moveQuestion,
  saveSession,
  saveDraftAnswer,
  type LoadedQuestionSource,
  type QuizSession,
} from '../lib/quiz-session';
import { isBookmarked, loadBookmarks, loadWrongAnswers, toggleBookmark } from '../lib/storage';
import { escapeHtml, renderFooter, renderTopNav } from './shared';
import {
  renderBlockRichText,
  renderChoiceContent,
  renderPassages,
  renderQuestionImages,
  renderRichText,
} from './rendering';

export async function renderQuizPage(catalog: Catalog): Promise<HTMLElement> {
  const selectedSources = loadSelectedSources();
  const fallbackSubject = catalog.subjects.find((subject) => subject.sources.length > 0);
  const effectiveSources =
    selectedSources.length > 0
      ? selectedSources
      : fallbackSubject
        ? defaultSelectedSources(fallbackSubject.id, fallbackSubject.sources)
        : [];

  const loadedSources = await Promise.all(
    effectiveSources.map<Promise<LoadedQuestionSource>>(async (source) => ({
      ...source,
      file: await loadQuestionFile(source.path),
    })),
  );

  const scope = loadPracticeScope();
  const options = loadPracticeOptions();
  const allowedKeys =
    scope === 'bookmarked'
      ? new Set(loadBookmarks())
      : scope === 'wrong'
        ? new Set(Object.keys(loadWrongAnswers()))
        : undefined;
  const session = getOrCreateSession(
    loadedSources,
    scope,
    allowedKeys ? (key) => allowedKeys.has(key) : undefined,
    options,
  );
  return renderSession(session);
}

function renderSession(session: QuizSession): HTMLElement {
  const page = document.createElement('main');
  page.className = 'app-shell';

  const current = session.questions[session.currentIndex];

  if (!current) {
    page.innerHTML = `
      ${renderNav()}
      <section class="page-header">
        <p class="eyebrow">quiz</p>
        <h1>풀이할 문제가 없습니다</h1>
        <p class="lead">문제 선택 화면에서 출처를 선택해 주세요.</p>
      </section>
      <a class="primary-link" href="#/select">문제 선택</a>
      ${renderFooter()}
    `;
    return page;
  }

  const response = session.responses[current.key];
  const multiple = current.question.type === 'multi-answer' || current.question.answers.length > 1;
  const inputType = multiple ? 'checkbox' : 'radio';
  const progress = `${session.currentIndex + 1} / ${session.questions.length}`;
  const selected = new Set(session.draftAnswers[current.key] ?? response?.selected ?? []);
  const bookmarked = isBookmarked(current.key);
  const answeredCount = session.questions.filter((question) => {
    const answer =
      session.responses[question.key]?.selected ?? session.draftAnswers[question.key] ?? [];
    return answer.length > 0;
  }).length;
  const checkedCount = Object.keys(session.responses).length;
  const allAnswered = session.questions.length > 0 && answeredCount === session.questions.length;
  const progressPercent =
    session.questions.length === 0
      ? 0
      : Math.round((answeredCount / session.questions.length) * 100);

  page.innerHTML = `
    ${renderNav()}
    <section class="quiz-header">
      <div>
        <p class="eyebrow">${escapeHtml(current.sourceTitle)}</p>
        <h1>문제 ${progress}</h1>
        <div class="progress-track" aria-label="답안 체크 진행률 ${progressPercent}%">
          <span style="width: ${progressPercent}%"></span>
        </div>
        <p class="muted progress-summary">답안 체크 ${answeredCount}/${session.questions.length} (${progressPercent}%) · 정답 확인 ${checkedCount}/${session.questions.length}</p>
      </div>
      <div class="quiz-actions">
        <button class="secondary-button" type="button" data-bookmark>
          ${bookmarked ? '북마크 해제' : '북마크'}
        </button>
      </div>
    </section>
    ${renderQuestionNavigator(session)}
    <article class="question-card">
      ${renderPassages(current.passages)}
      <p class="question-prompt">${renderRichText(current.question.prompt)}</p>
      ${renderQuestionImages(current.question.images ?? [])}
      <fieldset class="choice-list">
        <legend class="sr-only">선택지</legend>
        ${current.choices
          .map(
            (choice) => `
              <label class="choice-row ${response ? choiceClass(choice.id, current.question.answers, selected) : ''}">
                <input
                  type="${inputType}"
                  name="answer"
                  value="${escapeHtml(choice.id)}"
                  ${selected.has(choice.id) ? 'checked' : ''}
                />
                ${renderChoiceContent(choice)}
              </label>
            `,
          )
          .join('')}
      </fieldset>
      <p class="form-message" data-quiz-message></p>
      ${response ? renderExplanation(current.key, response.correct, current.question.answers, current.question.explanation) : ''}
      <div class="quiz-control-row">
        <button class="secondary-button" type="button" data-prev ${session.currentIndex === 0 ? 'disabled' : ''}>이전</button>
        <button class="primary-button" type="button" data-check>${response ? '다시 확인' : '정답 확인'}</button>
        <button class="secondary-button" type="button" data-next ${session.currentIndex === session.questions.length - 1 ? 'disabled' : ''}>다음</button>
      </div>
    </article>
    <section class="grading-panel" aria-label="최종 채점">
      <p class="muted">모든 문제에 답안을 체크하면 전체 채점 결과를 볼 수 있습니다.</p>
      <div class="grading-actions">
        <button class="secondary-button" type="button" data-fill-ones>모든 답안 1번 체크</button>
        <button class="primary-button" type="button" data-grade-all ${allAnswered ? '' : 'disabled'}>채점하기</button>
      </div>
    </section>
    ${renderFooter()}
  `;

  bindQuizEvents(page, session);
  return page;
}

function bindQuizEvents(page: HTMLElement, session: QuizSession): void {
  page.querySelectorAll<HTMLInputElement>('input[name="answer"]').forEach((input) => {
    input.addEventListener('change', () => {
      saveDraftAnswer(
        session,
        session.questions[session.currentIndex]?.key ?? '',
        readSelectedAnswers(page),
      );
      refreshRoute();
    });
  });

  page.querySelector<HTMLButtonElement>('[data-check]')?.addEventListener('click', () => {
    const selected = readSelectedAnswers(page);

    if (selected.length === 0) {
      const message = page.querySelector<HTMLElement>('[data-quiz-message]');
      if (message) {
        message.textContent = '정답을 선택한 뒤 확인해 주세요.';
      }
      return;
    }

    answerCurrentQuestion(session, selected);
    refreshRoute();
  });

  page.querySelectorAll<HTMLButtonElement>('[data-question-index]').forEach((button) => {
    button.addEventListener('click', () => {
      const nextIndex = Number(button.dataset.questionIndex);
      if (Number.isInteger(nextIndex)) {
        moveQuestion(session, nextIndex);
        refreshRoute();
      }
    });
  });

  page.querySelector<HTMLButtonElement>('[data-prev]')?.addEventListener('click', () => {
    moveQuestion(session, session.currentIndex - 1);
    refreshRoute();
  });

  page.querySelector<HTMLButtonElement>('[data-next]')?.addEventListener('click', () => {
    moveQuestion(session, session.currentIndex + 1);
    refreshRoute();
  });

  page.querySelector<HTMLButtonElement>('[data-grade-all]')?.addEventListener('click', () => {
    answerAllDraftQuestions(session);
    window.location.hash = '#/result';
  });

  page.querySelector<HTMLButtonElement>('[data-fill-ones]')?.addEventListener('click', () => {
    saveSession(fillAllWithFirstChoice(session));
    refreshRoute();
  });

  page.querySelector<HTMLButtonElement>('[data-bookmark]')?.addEventListener('click', () => {
    const current = session.questions[session.currentIndex];
    if (!current) {
      return;
    }

    toggleBookmark(current.key);
    refreshRoute();
  });
}

function fillAllWithFirstChoice(session: QuizSession): QuizSession {
  return {
    ...session,
    draftAnswers: {
      ...session.draftAnswers,
      ...Object.fromEntries(
        session.questions.flatMap((question) =>
          question.choices.some((choice) => choice.id === '1') ? [[question.key, ['1']]] : [],
        ),
      ),
    },
  };
}

function renderQuestionNavigator(session: QuizSession): string {
  return `
    <section class="question-map quiz-map" aria-label="문제 바로가기">
      <div class="question-map-grid">
        ${session.questions
          .map((question, index) => {
            const bookmarked = isBookmarked(question.key);
            const response = session.responses[question.key];
            const selected = session.draftAnswers[question.key] ?? response?.selected ?? [];
            const status = response ? 'checked' : selected.length > 0 ? 'answered' : 'unanswered';
            const current = index === session.currentIndex;
            const label = `${index + 1}번 ${statusLabel(status)}${bookmarked ? ', 북마크' : ''}`;

            return `
              <button
                class="question-map-item is-${status} ${current ? 'is-current' : ''} ${bookmarked ? 'is-bookmarked' : ''}"
                type="button"
                data-question-index="${index}"
                aria-label="${label}"
                aria-current="${current ? 'step' : 'false'}"
              >
                <span>${index + 1}</span>
                ${bookmarked ? '<small aria-hidden="true">★</small>' : ''}
              </button>
            `;
          })
          .join('')}
      </div>
      <div class="question-map-legend" aria-label="문제 상태 범례">
        <span><i class="legend-current"></i>현재</span>
        <span><i class="legend-unanswered"></i>답안체크안함</span>
        <span><i class="legend-answered"></i>답안체크함</span>
        <span><i class="legend-checked"></i>정답확인</span>
        <span><i class="legend-bookmarked"></i>북마크</span>
      </div>
    </section>
  `;
}

function statusLabel(status: 'checked' | 'answered' | 'unanswered'): string {
  switch (status) {
    case 'checked':
      return '정답확인';
    case 'answered':
      return '답안체크함';
    case 'unanswered':
      return '답안체크안함';
  }
}

function readSelectedAnswers(page: HTMLElement): string[] {
  return Array.from(page.querySelectorAll<HTMLInputElement>('input[name="answer"]:checked')).map(
    (input) => input.value,
  );
}

function renderNav(): string {
  return renderTopNav('quiz', [
    { href: '#/select', label: '문제 선택', id: 'select' },
    { href: '#/mock-exam', label: '모의 시험', id: 'mock-exam' },
    { href: '#/quiz', label: '풀이', id: 'quiz' },
    { href: '#/result', label: '결과', id: 'result' },
    { href: '#/backup', label: '데이터 관리', id: 'backup' },
  ]);
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

function refreshRoute(): void {
  window.location.hash = `#/quiz?ts=${Date.now()}`;
}
