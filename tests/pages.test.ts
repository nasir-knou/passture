// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  answerQuestion,
  createQuizSession,
  saveDraftAnswer,
  saveSelectedSources,
  sessionKey,
  type LoadedQuestionSource,
} from '../src/lib/quiz-session';
import {
  finishSession,
  mockExamSessionKey,
  saveMockExamConfig,
  saveMockExamSession,
  setAnswer,
  type MockExamSession,
} from '../src/lib/mock-exam-session';
import {
  loadBookmarks,
  loadWrongAnswers,
  saveBookmarks,
  saveWrongAnswers,
} from '../src/lib/storage';
import { renderHistoryPage } from '../src/pages/history';
import { renderMockExamResultPage } from '../src/pages/mock-exam-result';
import { renderMockExamTestPage } from '../src/pages/mock-exam-test';
import { renderQuizPage } from '../src/pages/quiz';
import { renderResultPage } from '../src/pages/result';
import type { Catalog } from '../src/types/catalog';
import type { QuestionFile } from '../src/types/question';
import { makeQuestion, makeQuestionFile, mockDataFetch } from './helpers';

// data-loader 캐시가 모듈 상태이므로 테스트마다 다른 파일 경로를 쓴다.
let pathCounter = 0;
function uniquePath(name: string): string {
  pathCounter += 1;
  return `subjects/os/${name}-${pathCounter}.json`;
}

function osFile(sourceId = 'past-exams-2019'): QuestionFile {
  return makeQuestionFile('os', sourceId, [
    makeQuestion('e19-01', { prompt: '운영체제의 역할은?' }),
    makeQuestion('e19-02', {
      type: 'ox',
      choices: [
        { id: 'O', text: 'O' },
        { id: 'X', text: 'X' },
      ],
      answers: ['X'],
    }),
  ]);
}

function catalogFor(paths: Array<{ id: string; path: string }>): Catalog {
  return {
    version: 1,
    subjects: [
      {
        id: 'os',
        title: '운영체제',
        semester: 2,
        sources: paths.map(({ id, path }) => ({ id, title: `${id} 제목`, path, kind: 'exam' })),
      },
    ],
  };
}

function loadedSource(path: string, file: QuestionFile): LoadedQuestionSource {
  return {
    subjectId: 'os',
    subjectTitle: '운영체제',
    sourceId: file.sourceId,
    sourceTitle: `${file.sourceId} 제목`,
    path,
    file,
  };
}

beforeEach(() => {
  sessionStorage.clear();
  localStorage.clear();
  window.history.replaceState(null, '', '/');
  document.body.replaceChildren();
});

afterEach(async () => {
  // 시험 화면이 남아 있으면 문서에서 떼고 타이머를 한 번 돌려 정리(disposeExam)되게 한다.
  document.body.replaceChildren();
  if (vi.isFakeTimers()) {
    vi.advanceTimersByTime(1000);
  }
  vi.useRealTimers();
  // happy-dom은 location.hash 변경 시 hashchange를 비동기로 보내므로 다음 테스트로 넘기지 않는다.
  await new Promise((resolve) => setTimeout(resolve, 0));
});

/** happy-dom에는 window.confirm이 없으므로 직접 붙인다. */
function stubConfirm(answer: boolean) {
  const confirm = vi.fn((_message?: string) => answer);
  Object.defineProperty(window, 'confirm', { value: confirm, configurable: true, writable: true });
  return confirm;
}

describe('quiz page', () => {
  it('renders the current question and records a draft answer and a checked answer', async () => {
    const path = uniquePath('quiz');
    const file = osFile();
    const fetchMock = mockDataFetch({ [path]: file });
    const catalog = catalogFor([{ id: file.sourceId, path }]);
    saveSelectedSources([
      {
        subjectId: 'os',
        subjectTitle: '운영체제',
        sourceId: file.sourceId,
        sourceTitle: '2019 기말',
        path,
      },
    ]);

    const page = await renderQuizPage(catalog);
    document.body.append(page);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(page.querySelector('h1')?.textContent).toBe('문제 1 / 2');
    expect(page.querySelector('.question-prompt')?.textContent).toBe('운영체제의 역할은?');
    const inputs = [...page.querySelectorAll<HTMLInputElement>('input[name="answer"]')];
    expect(inputs.map((input) => [input.type, input.value])).toEqual([
      ['radio', '1'],
      ['radio', '2'],
      ['radio', '3'],
      ['radio', '4'],
    ]);

    inputs[1]!.checked = true;
    inputs[1]!.dispatchEvent(new Event('change', { bubbles: true }));

    const stored = JSON.parse(sessionStorage.getItem(sessionKey)!) as {
      draftAnswers: Record<string, string[]>;
      responses: Record<string, unknown>;
    };
    expect(stored.draftAnswers).toEqual({ 'os:past-exams-2019:e19-01': ['2'] });
    expect(stored.responses).toEqual({});
    expect(window.location.hash).toMatch(/^#\/quiz\?ts=\d+$/);

    // 같은 세션을 다시 그리면 선택한 답이 체크되어 있다.
    const rerendered = await renderQuizPage(catalog);
    expect(
      rerendered.querySelector<HTMLInputElement>('input[name="answer"][value="2"]')?.checked,
    ).toBe(true);
    expect(rerendered.querySelector('.progress-summary')?.textContent).toContain('답안 체크 1/2');

    rerendered.querySelector<HTMLButtonElement>('[data-check]')!.click();

    const checked = JSON.parse(sessionStorage.getItem(sessionKey)!) as {
      responses: Record<string, { selected: string[]; correct: boolean }>;
    };
    expect(checked.responses['os:past-exams-2019:e19-01']).toMatchObject({
      selected: ['2'],
      correct: false,
    });
    expect(Object.keys(loadWrongAnswers())).toEqual(['os:past-exams-2019:e19-01']);

    const afterCheck = await renderQuizPage(catalog);
    expect(afterCheck.querySelector('.explanation h2')?.textContent).toBe('오답');
    expect(afterCheck.querySelector('.choice-row.is-answer input')?.getAttribute('value')).toBe(
      '1',
    );
  });

  it('asks for a selection before checking an answer', async () => {
    const path = uniquePath('quiz');
    const file = osFile();
    mockDataFetch({ [path]: file });

    const page = await renderQuizPage(catalogFor([{ id: file.sourceId, path }]));
    page.querySelector<HTMLButtonElement>('[data-check]')!.click();

    expect(page.querySelector('[data-quiz-message]')?.textContent).toBe(
      '정답을 선택한 뒤 확인해 주세요.',
    );
    expect(loadWrongAnswers()).toEqual({});
  });
});

describe('result page', () => {
  it('renders a stored version-2 session after a reload by refetching the question file', async () => {
    const path = uniquePath('result');
    const file = osFile();
    let session = createQuizSession([loadedSource(path, file)]);
    session = answerQuestion(session, 'os:past-exams-2019:e19-01', ['1']);
    session = saveDraftAnswer(session, 'os:past-exams-2019:e19-02', ['O']);
    session = answerQuestion(session, 'os:past-exams-2019:e19-02', ['O']);
    expect(sessionStorage.getItem(sessionKey)).not.toContain('운영체제의 역할은?');
    const fetchMock = mockDataFetch({ [path]: file });

    const page = await renderResultPage(catalogFor([{ id: file.sourceId, path }]));

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(page.querySelector('h1')?.textContent).toBe('결과');
    expect(
      [...page.querySelectorAll('.score-grid .score-card strong')].map((el) => el.textContent),
    ).toEqual(['2', '2', '1', '50%']);
    expect(page.textContent).toContain('운영체제의 역할은?');
  });

  it('shows the empty state when the stored session is from an old format', async () => {
    sessionStorage.setItem(sessionKey, JSON.stringify({ id: 'old', questions: [] }));
    mockDataFetch({});

    const page = await renderResultPage(catalogFor([]));

    expect(page.querySelector('h1')?.textContent).toBe('결과가 없습니다');
    expect(sessionStorage.getItem(sessionKey)).toBeNull();
  });

  it('renders the mock exam result from a stored version-2 session', async () => {
    const path = uniquePath('mock-result');
    const file = osFile();
    const fetchMock = mockDataFetch({ [path]: file });
    let session = mockExamSession(path, file);
    session = setAnswer(session, 'os:past-exams-2019:e19-01', ['1']);
    session = finishSession(session);
    expect(JSON.parse(sessionStorage.getItem(mockExamSessionKey)!).version).toBe(2);

    const page = await renderMockExamResultPage();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(page.querySelector('h1')?.textContent).toBe('모의 시험 결과');
    expect(page.querySelector('.mock-result-tabs .exam-tab-count')?.textContent).toBe('(1/2)');
  });
});

describe('mock exam test page', () => {
  function startConfig(path: string) {
    saveMockExamConfig({
      subjects: [
        {
          subjectId: 'os',
          subjectTitle: '운영체제',
          questionMode: 'all',
          source: {
            subjectId: 'os',
            subjectTitle: '운영체제',
            sourceId: 'past-exams-2019',
            sourceTitle: '2019 기말',
            path,
            kind: 'exam',
          },
        },
      ],
      totalMinutes: 25,
      startTime: '10:00',
      endTime: '10:25',
    });
  }

  async function mountExam(): Promise<HTMLElement> {
    const path = uniquePath('exam');
    mockDataFetch({ [path]: osFile() });
    startConfig(path);
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'Date'] });
    vi.setSystemTime(new Date(2026, 4, 9, 10, 0, 0));
    window.history.replaceState(null, '', '#/mock-exam/test');

    const page = await renderMockExamTestPage();
    document.body.append(page);
    return page;
  }

  function storedStatus(): string | undefined {
    const raw = sessionStorage.getItem(mockExamSessionKey);
    return raw ? (JSON.parse(raw) as { status: string }).status : undefined;
  }

  function beforeUnloadPrevented(): boolean {
    const event = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(event);
    return event.defaultPrevented;
  }

  function leaveTo(hash: string): void {
    window.history.replaceState(null, '', hash);
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  }

  it('counts the timer down every second and finishes the exam when time runs out', async () => {
    const page = await mountExam();
    const timer = () => page.querySelector('[data-timer]')?.textContent?.trim();

    expect(timer()).toBe('25:00');
    expect(vi.getTimerCount()).toBe(1);

    vi.advanceTimersByTime(1000);
    expect(timer()).toBe('24:59');

    vi.advanceTimersByTime(20 * 60 * 1000 - 1000);
    expect(timer()).toBe('05:00');
    expect(page.querySelector('[data-timer]')?.classList.contains('is-warning')).toBe(true);

    vi.advanceTimersByTime(5 * 60 * 1000);
    expect(storedStatus()).toBe('finished');
    expect(window.location.hash).toBe('#/mock-exam/result');
    expect(vi.getTimerCount()).toBe(0);
    expect(beforeUnloadPrevented()).toBe(false);
  });

  it('records answers into the stored session and the answer grid', async () => {
    const page = await mountExam();
    const input = page.querySelector<HTMLInputElement>(
      'input[data-answer-input][data-question-key="os:past-exams-2019:e19-01"][value="3"]',
    )!;

    input.checked = true;
    input.dispatchEvent(new Event('change', { bubbles: true }));

    const stored = JSON.parse(sessionStorage.getItem(mockExamSessionKey)!) as {
      subjects: Array<{ answers: Record<string, string[]> }>;
    };
    expect(stored.subjects[0]!.answers).toEqual({ 'os:past-exams-2019:e19-01': ['3'] });
    expect(page.querySelector('.exam-tab-count')?.textContent).toBe('(1/2)');
    expect(page.querySelector('[data-grid-row] .exam-grid-answer-circle')).not.toBeNull();

    page.querySelector<HTMLButtonElement>('[data-exit-btn]')!.click();
    page.querySelector<HTMLButtonElement>('[data-modal-confirm]')!.click();
    expect(storedStatus()).toBe('finished');
  });

  it('installs the exit guard and keeps the exam when leaving is declined', async () => {
    await mountExam();
    const confirm = stubConfirm(false);

    expect(beforeUnloadPrevented()).toBe(true);

    leaveTo('#/select');

    expect(confirm).toHaveBeenCalledTimes(1);
    expect(window.location.hash).toBe('#/mock-exam/test');
    expect(storedStatus()).toBe('in-progress');
    expect(vi.getTimerCount()).toBe(1);
    expect(beforeUnloadPrevented()).toBe(true);

    // 되돌린 이동으로 생기는 hashchange는 한 번 건너뛴다.
    leaveTo('#/mock-exam/test');
    confirm.mockReturnValue(true);
    leaveTo('#/select');

    expect(confirm).toHaveBeenCalledTimes(2);
    expect(storedStatus()).toBe('finished');
    expect(vi.getTimerCount()).toBe(0);
    expect(beforeUnloadPrevented()).toBe(false);

    leaveTo('#/history');
    expect(confirm).toHaveBeenCalledTimes(2);
  });

  it('removes the exit guard and timer when the exam is finished from the modal', async () => {
    const page = await mountExam();
    const confirm = stubConfirm(true);

    page.querySelector<HTMLButtonElement>('[data-exit-btn]')!.click();
    expect(page.querySelector<HTMLElement>('[data-exit-modal]')?.hidden).toBe(false);
    page.querySelector<HTMLButtonElement>('[data-modal-confirm]')!.click();

    expect(storedStatus()).toBe('finished');
    expect(window.location.hash).toBe('#/mock-exam/result');
    expect(vi.getTimerCount()).toBe(0);
    expect(beforeUnloadPrevented()).toBe(false);
    leaveTo('#/select');
    expect(confirm).not.toHaveBeenCalled();
  });

  it('disposes the timer and guard once the page is detached by the router', async () => {
    const page = await mountExam();
    const confirm = stubConfirm(true);

    page.remove();
    vi.advanceTimersByTime(1000);

    expect(vi.getTimerCount()).toBe(0);
    expect(beforeUnloadPrevented()).toBe(false);
    leaveTo('#/select');
    expect(confirm).not.toHaveBeenCalled();
    expect(storedStatus()).toBe('in-progress');
  });

  it('shows a link back to settings when there is no config', async () => {
    mockDataFetch({});

    const page = await renderMockExamTestPage();

    expect(page.querySelector('.exam-error a')?.getAttribute('href')).toBe('#/mock-exam');
  });
});

describe('history page', () => {
  const record = { wrongCount: 2, lastWrongAt: '2026-01-01T00:00:00.000Z' };

  it('renders tracked questions and prunes keys that no longer exist', async () => {
    const pathA = uniquePath('history-a');
    const pathB = uniquePath('history-b');
    const fileA = osFile('past-exams-2019');
    const fileB = osFile('past-exams-2018');
    const fetchMock = mockDataFetch({ [pathA]: fileA, [pathB]: fileB });
    saveBookmarks(['os:past-exams-2019:e19-01', 'os:past-exams-2019:deleted']);
    saveWrongAnswers({ 'os:past-exams-2018:e19-02': record, 'gone:source:q': record });

    const page = await renderHistoryPage(
      catalogFor([
        { id: 'past-exams-2019', path: pathA },
        { id: 'past-exams-2018', path: pathB },
      ]),
    );

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(page.querySelector('h1')?.textContent).toBe('학습 기록');
    expect(
      [...page.querySelectorAll('[data-history-item] summary strong')].map((el) => el.textContent),
    ).toEqual(['os:past-exams-2018:e19-02', 'os:past-exams-2019:e19-01']);
    expect(page.textContent).toContain('오답 2회');
    expect(loadBookmarks()).toEqual(['os:past-exams-2019:e19-01']);
    expect(Object.keys(loadWrongAnswers())).toEqual(['os:past-exams-2018:e19-02']);
  });

  it('does not prune anything when a question file fails to load', async () => {
    const pathA = uniquePath('history-a');
    const pathB = uniquePath('history-missing');
    mockDataFetch({ [pathA]: osFile() });
    saveBookmarks(['os:past-exams-2019:e19-01', 'os:past-exams-2019:deleted']);
    saveWrongAnswers({ 'gone:source:q': record });

    await expect(
      renderHistoryPage(
        catalogFor([
          { id: 'past-exams-2019', path: pathA },
          { id: 'past-exams-2018', path: pathB },
        ]),
      ),
    ).rejects.toThrow('요청 실패 (404)');

    expect(loadBookmarks()).toEqual(['os:past-exams-2019:deleted', 'os:past-exams-2019:e19-01']);
    expect(Object.keys(loadWrongAnswers())).toEqual(['gone:source:q']);
  });

  it('renders the empty state without loading files when nothing is tracked', async () => {
    const fetchMock = mockDataFetch({});

    const page = await renderHistoryPage(catalogFor([{ id: 'x', path: uniquePath('x') }]));

    expect(fetchMock).not.toHaveBeenCalled();
    expect(page.querySelector('.panel h2')?.textContent).toBe('기록 없음');
  });
});

function mockExamSession(path: string, file: QuestionFile): MockExamSession {
  const source = {
    subjectId: 'os',
    subjectTitle: '운영체제',
    sourceId: file.sourceId,
    sourceTitle: '2019 기말',
    path,
    kind: 'exam' as const,
  };
  const session: MockExamSession = {
    id: 'mock',
    config: {
      subjects: [{ subjectId: 'os', subjectTitle: '운영체제', questionMode: 'all', source }],
      totalMinutes: 25,
      startTime: '10:00',
      endTime: '10:25',
      questionOrder: 'default',
      choiceOrder: 'default',
    },
    subjects: [
      {
        subjectId: 'os',
        subjectTitle: '운영체제',
        questions: file.questions.map((question) => ({
          key: `os:${file.sourceId}:${question.id}`,
          subjectId: 'os',
          subjectTitle: '운영체제',
          sourceId: file.sourceId,
          sourceTitle: '2019 기말',
          question,
          passages: [],
          choices: question.choices,
        })),
        answers: {},
      },
    ],
    activeSubjectIndex: 0,
    startedAt: new Date().toISOString(),
    bookmarks: [],
    status: 'in-progress',
  };
  saveMockExamSession(session);
  return session;
}
