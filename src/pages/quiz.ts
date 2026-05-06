import type { Catalog } from '../types/catalog';
import { loadQuestionFile } from '../lib/data-loader';
import {
  answerCurrentQuestion,
  defaultSelectedSources,
  getOrCreateSession,
  loadPracticeScope,
  loadSelectedSources,
  moveQuestion,
  type LoadedQuestionSource,
  type QuizSession,
} from '../lib/quiz-session';
import { isBookmarked, loadBookmarks, loadWrongAnswers, toggleBookmark } from '../lib/storage';
import { escapeHtml, renderFooter } from './shared';
import type { Passage, QuestionImage } from '../types/question';

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
  const selected = new Set(response?.selected ?? []);
  const bookmarked = isBookmarked(current.key);

  page.innerHTML = `
    ${renderNav()}
    <section class="quiz-header">
      <div>
        <p class="eyebrow">${escapeHtml(current.sourceTitle)}</p>
        <h1>문제 ${progress}</h1>
      </div>
      <div class="quiz-actions">
        <button class="secondary-button" type="button" data-bookmark>
          ${bookmarked ? '북마크 해제' : '북마크'}
        </button>
        <a class="text-link" href="#/result">결과 보기</a>
      </div>
    </section>
    <article class="question-card">
      ${renderPassages(current.passages)}
      <p class="question-prompt">${escapeHtml(current.question.prompt)}</p>
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
                  ${response ? 'disabled' : ''}
                />
                <span>${escapeHtml(choice.text)}</span>
              </label>
            `,
          )
          .join('')}
      </fieldset>
      <p class="form-message" data-quiz-message></p>
      ${response ? renderExplanation(response.correct, current.question.answers, current.question.explanation) : ''}
      <div class="action-row split">
        <button class="secondary-button" type="button" data-prev ${session.currentIndex === 0 ? 'disabled' : ''}>이전</button>
        ${
          response
            ? `<button class="primary-button" type="button" data-next>${session.currentIndex === session.questions.length - 1 ? '결과 보기' : '다음'}</button>`
            : '<button class="primary-button" type="button" data-check>정답 확인</button>'
        }
      </div>
    </article>
    ${renderFooter()}
  `;

  bindQuizEvents(page, session);
  return page;
}

function bindQuizEvents(page: HTMLElement, session: QuizSession): void {
  page.querySelector<HTMLButtonElement>('[data-check]')?.addEventListener('click', () => {
    const selected = Array.from(
      page.querySelectorAll<HTMLInputElement>('input[name="answer"]:checked'),
    ).map((input) => input.value);

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

  page.querySelector<HTMLButtonElement>('[data-prev]')?.addEventListener('click', () => {
    moveQuestion(session, session.currentIndex - 1);
    refreshRoute();
  });

  page.querySelector<HTMLButtonElement>('[data-next]')?.addEventListener('click', () => {
    if (session.currentIndex >= session.questions.length - 1) {
      window.location.hash = '#/result';
      return;
    }

    moveQuestion(session, session.currentIndex + 1);
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

function renderNav(): string {
  return `
    <nav class="top-nav" aria-label="주요 메뉴">
      <a href="#/">홈</a>
      <a href="#/select">문제 선택</a>
      <a href="#/result">결과</a>
    </nav>
  `;
}

function renderPassages(passages: readonly Passage[]): string {
  if (passages.length === 0) {
    return '';
  }

  return passages
    .map(
      (passage) => `
        <section class="passage">
          <p class="muted">${escapeHtml(passage.id)}${passage.language ? ` · ${escapeHtml(passage.language)}` : ''}</p>
          ${passage.image ? renderImage(passage.image) : `<pre><code>${escapeHtml(passage.body ?? '')}</code></pre>`}
        </section>
      `,
    )
    .join('');
}

function renderImage(image: QuestionImage): string {
  return `
    <img
      class="question-image"
      src="${escapeHtml(image.path)}"
      alt="${escapeHtml(image.alt)}"
      loading="lazy"
    />
  `;
}

function renderQuestionImages(images: readonly QuestionImage[]): string {
  if (images.length === 0) {
    return '';
  }

  return `
    <div class="question-images">
      ${images.map(renderImage).join('')}
    </div>
  `;
}

function renderExplanation(
  correct: boolean,
  answers: readonly string[],
  explanation: string,
): string {
  return `
    <section class="explanation ${correct ? 'correct' : 'incorrect'}">
      <h2>${correct ? '정답' : '오답'}</h2>
      <p>정답: ${answers.map(escapeHtml).join(', ')}</p>
      <p>${escapeHtml(explanation)}</p>
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
