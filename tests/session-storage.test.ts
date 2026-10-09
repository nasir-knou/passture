// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  loadMockExamSession,
  loadMockExamSessionStatus,
  mockExamSessionKey,
  saveMockExamSession,
  type MockExamSession,
} from '../src/lib/mock-exam-session';
import {
  createQuizSession,
  loadSession,
  saveSession,
  sessionKey,
  type LoadedQuestionSource,
  type QuizSession,
} from '../src/lib/quiz-session';
import { onStorageFailure, safeSetItem } from '../src/lib/safe-storage';
import type { QuestionFile } from '../src/types/question';
import {
  createMemoryStorage,
  makeQuestion,
  makeQuestionFile,
  mockDataFetch,
  quotaExceededError,
} from './helpers';

// data-loader는 성공한 요청을 모듈 단위로 캐시하므로 테스트마다 다른 경로를 쓴다.
let pathCounter = 0;
function uniquePath(sourceId: string): string {
  pathCounter += 1;
  return `subjects/os/${sourceId}-${pathCounter}.json`;
}

let storage: ReturnType<typeof createMemoryStorage>;

beforeEach(() => {
  storage = createMemoryStorage();
  vi.stubGlobal('sessionStorage', storage);
  vi.stubGlobal('localStorage', createMemoryStorage());
});

describe('quiz session storage (version 2)', () => {
  function loadedSource(path: string): LoadedQuestionSource {
    const file = makeQuestionFile('os', 'past-exams-2019', [
      makeQuestion('e19-01'),
      makeQuestion('e19-02', { type: 'multi-answer', answers: ['1', '3'] }),
      makeQuestion('e19-03', { passageRefs: ['p1'] }),
    ]);
    file.passages = [{ id: 'p1', type: 'text', body: '지문 본문' }];
    return {
      subjectId: 'os',
      subjectTitle: '운영체제',
      sourceId: 'past-exams-2019',
      sourceTitle: '2019 기말',
      path,
      file,
    };
  }

  it('stores only question references and rehydrates them from the question file', async () => {
    const path = uniquePath('past-exams-2019');
    const source = loadedSource(path);
    const fetchMock = mockDataFetch({ [path]: source.file });
    const created = createQuizSession([source]);
    const reordered = created.questions[1]!;
    const session: QuizSession = {
      ...created,
      currentIndex: 1,
      questions: created.questions.map((question, index) =>
        index === 1
          ? { ...question, choices: [...question.choices].reverse(), chapter: 4 }
          : question,
      ),
      draftAnswers: { [reordered.key]: ['1', '3'] },
      responses: {
        [created.questions[0]!.key]: {
          selected: ['2'],
          correct: false,
          checkedAt: '2026-01-01T00:00:00.000Z',
        },
      },
    };

    expect(saveSession(session)).toBe(true);

    const raw = JSON.parse(storage.getItem(sessionKey)!) as Record<string, unknown>;
    expect(raw.version).toBe(2);
    expect(raw.questions).toEqual([
      { source: 0, id: 'e19-01' },
      { source: 0, id: 'e19-02', choices: ['4', '3', '2', '1'], chapter: 4 },
      { source: 0, id: 'e19-03' },
    ]);
    expect(storage.getItem(sessionKey)).not.toContain('지문 본문');
    expect(storage.getItem(sessionKey)).not.toContain('e19-01 문제');

    const loaded = await loadSession();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0]![0])).toMatch(new RegExp(`/data/${path}$`));
    expect(loaded).toEqual(session);
    expect(loaded!.questions[2]!.passages).toEqual([{ id: 'p1', type: 'text', body: '지문 본문' }]);
  });

  it('drops questions that disappeared from the file and clamps currentIndex', async () => {
    const path = uniquePath('past-exams-2019');
    const source = loadedSource(path);
    const session = { ...createQuizSession([source]), currentIndex: 2 };
    saveSession(session);
    mockDataFetch({
      [path]: { ...source.file, questions: source.file.questions.slice(0, 1) },
    });

    const loaded = await loadSession();

    expect(loaded!.questions.map((question) => question.question.id)).toEqual(['e19-01']);
    expect(loaded!.currentIndex).toBe(0);
  });

  it('clears the stored session when no question survives', async () => {
    const path = uniquePath('past-exams-2019');
    saveSession(createQuizSession([loadedSource(path)]));
    mockDataFetch({ [path]: { ...loadedSource(path).file, questions: [] } });

    await expect(loadSession()).resolves.toBeUndefined();
    expect(storage.getItem(sessionKey)).toBeNull();
  });

  it('keeps the stored session and throws when the question file cannot be loaded', async () => {
    const path = uniquePath('past-exams-2019');
    saveSession(createQuizSession([loadedSource(path)]));
    mockDataFetch({});

    await expect(loadSession()).rejects.toThrow(/요청 실패 \(404\)/);
    expect(storage.getItem(sessionKey)).not.toBeNull();
  });

  it.each([
    ['corrupt JSON', '{"version":2,'],
    ['an array', '[]'],
    [
      'the old full-question format',
      JSON.stringify({
        id: 'old',
        sourceSignature: 'sig',
        currentIndex: 0,
        sources: [],
        questions: [{ key: 'a:b:c', question: makeQuestion('c') }],
        draftAnswers: {},
        responses: {},
      }),
    ],
    [
      'a version-2 session with an out-of-range source index',
      JSON.stringify({
        version: 2,
        id: 'x',
        sourceSignature: 'sig',
        currentIndex: 0,
        sources: [
          {
            subjectId: 'os',
            subjectTitle: '운영체제',
            sourceId: 's',
            sourceTitle: 'S',
            path: 'subjects/os/s.json',
          },
        ],
        questions: [{ source: 1, id: 'e19-01' }],
        draftAnswers: {},
        responses: {},
      }),
    ],
    [
      'a version-2 session with a malformed response',
      JSON.stringify({
        version: 2,
        id: 'x',
        sourceSignature: 'sig',
        sources: [],
        questions: [],
        responses: { k: { selected: '1', correct: true, checkedAt: 'now' } },
      }),
    ],
  ])('discards %s without fetching', async (_label, raw) => {
    const fetchMock = mockDataFetch({});
    storage.setItem(sessionKey, raw);

    await expect(loadSession()).resolves.toBeUndefined();
    expect(storage.getItem(sessionKey)).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('mock exam session storage (version 2)', () => {
  function mockSession(path: string, file: QuestionFile): MockExamSession {
    const source = {
      subjectId: 'os',
      subjectTitle: '운영체제',
      sourceId: 'past-exams-2019',
      sourceTitle: '2019 기말',
      path,
      kind: 'exam' as const,
    };
    const questions = file.questions.map((question) => ({
      key: `os:past-exams-2019:${question.id}`,
      subjectId: 'os',
      subjectTitle: '운영체제',
      sourceId: 'past-exams-2019',
      sourceTitle: '2019 기말',
      question,
      passages: [],
      choices: question.choices,
    }));
    questions[0] = { ...questions[0]!, choices: [...questions[0]!.choices].reverse() };

    return {
      id: 'mock-1',
      config: {
        subjects: [{ subjectId: 'os', subjectTitle: '운영체제', questionMode: 'sample25', source }],
        totalMinutes: 25,
        startTime: '10:00',
        endTime: '10:25',
        questionOrder: 'default',
        choiceOrder: 'random',
      },
      subjects: [
        {
          subjectId: 'os',
          subjectTitle: '운영체제',
          questions,
          answers: { [questions[0]!.key]: ['2'] },
        },
      ],
      activeSubjectIndex: 0,
      startedAt: '2026-01-01T10:00:00.000Z',
      bookmarks: [questions[1]!.key],
      status: 'in-progress',
    };
  }

  const file = makeQuestionFile('os', 'past-exams-2019', [
    makeQuestion('e19-01'),
    makeQuestion('e19-02'),
  ]);

  it('round-trips through sessionStorage and rehydrates from the question file', async () => {
    const path = uniquePath('mock');
    const session = mockSession(path, file);
    const fetchMock = mockDataFetch({ [path]: file });

    expect(saveMockExamSession(session)).toBe(true);

    const raw = JSON.parse(storage.getItem(mockExamSessionKey)!) as {
      version: number;
      subjects: Array<{ questions: unknown[] }>;
    };
    expect(raw.version).toBe(2);
    expect(raw.subjects[0]!.questions).toEqual([
      { id: 'e19-01', choices: ['4', '3', '2', '1'] },
      { id: 'e19-02' },
    ]);
    expect(loadMockExamSessionStatus()).toBe('in-progress');
    expect(fetchMock).not.toHaveBeenCalled();

    await expect(loadMockExamSession()).resolves.toEqual(session);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('discards the old format (no version) and corrupt data', async () => {
    const path = uniquePath('mock');
    const fetchMock = mockDataFetch({ [path]: file });
    const legacy = mockSession(path, file);
    storage.setItem(mockExamSessionKey, JSON.stringify(legacy));

    await expect(loadMockExamSession()).resolves.toBeUndefined();
    expect(storage.getItem(mockExamSessionKey)).toBeNull();

    storage.setItem(mockExamSessionKey, 'not json');
    expect(loadMockExamSessionStatus()).toBeUndefined();
    expect(storage.getItem(mockExamSessionKey)).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('discards a stored session whose subjects do not match its config', async () => {
    const path = uniquePath('mock');
    mockDataFetch({ [path]: file });
    const session = mockSession(path, file);
    saveMockExamSession({ ...session, subjects: [...session.subjects, ...session.subjects] });

    await expect(loadMockExamSession()).resolves.toBeUndefined();
    expect(storage.getItem(mockExamSessionKey)).toBeNull();
  });

  it('clears the session when every question vanished from the file', async () => {
    const path = uniquePath('mock');
    saveMockExamSession(mockSession(path, file));
    mockDataFetch({ [path]: { ...file, questions: [makeQuestion('other')] } });

    await expect(loadMockExamSession()).resolves.toBeUndefined();
    expect(storage.getItem(mockExamSessionKey)).toBeNull();
  });
});

describe('storage failures', () => {
  let unsubscribe: (() => void) | undefined;

  afterEach(() => {
    unsubscribe?.();
    unsubscribe = undefined;
  });

  it('safeSetItem returns false and notifies listeners on QuotaExceededError', () => {
    const listener = vi.fn();
    unsubscribe = onStorageFailure(listener);
    const failing = createMemoryStorage();
    failing.setItem = () => {
      throw quotaExceededError();
    };

    expect(safeSetItem(failing, 'k', 'v', '테스트 값')).toBe(false);
    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener.mock.calls[0]![0]).toContain('저장 공간이 부족해 테스트 값');
    expect((listener.mock.calls[0]![1] as Error).name).toBe('QuotaExceededError');
  });

  it('uses the private-mode message for other storage errors and warns without listeners', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const failing = createMemoryStorage();
    failing.setItem = () => {
      throw new Error('SecurityError');
    };

    expect(safeSetItem(failing, 'k', 'v', '값')).toBe(false);
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('사생활 보호 모드'),
      expect.any(Error),
    );
  });

  it('saveSession and saveMockExamSession report quota failures', () => {
    const listener = vi.fn();
    unsubscribe = onStorageFailure(listener);
    storage.setItem = () => {
      throw quotaExceededError();
    };
    const path = uniquePath('quota');
    const source: LoadedQuestionSource = {
      subjectId: 'os',
      subjectTitle: '운영체제',
      sourceId: 's',
      sourceTitle: 'S',
      path,
      file: makeQuestionFile('os', 's', [makeQuestion('e19-01')]),
    };

    expect(saveSession(createQuizSession([source]))).toBe(false);
    expect(saveMockExamSession(mockSession(path))).toBe(false);
    expect(listener).toHaveBeenCalledTimes(2);
    expect(listener.mock.calls.map(([message]) => message)).toEqual([
      expect.stringContaining('풀이 진행 상황'),
      expect.stringContaining('모의 시험 진행 상황'),
    ]);

    function mockSession(sourcePath: string): MockExamSession {
      return {
        id: 'm',
        config: {
          subjects: [
            {
              subjectId: 'os',
              subjectTitle: '운영체제',
              questionMode: 'all',
              source: { ...source, path: sourcePath, kind: 'exam' },
            },
          ],
          totalMinutes: 25,
          startTime: '10:00',
          endTime: '10:25',
        },
        subjects: [{ subjectId: 'os', subjectTitle: '운영체제', questions: [], answers: {} }],
        activeSubjectIndex: 0,
        startedAt: '2026-01-01T10:00:00.000Z',
        bookmarks: [],
        status: 'in-progress',
      };
    }
  });

  it('unsubscribed listeners are no longer called', () => {
    const listener = vi.fn();
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    onStorageFailure(listener)();
    const failing = createMemoryStorage();
    failing.setItem = () => {
      throw quotaExceededError();
    };

    safeSetItem(failing, 'k', 'v', '값');
    expect(listener).not.toHaveBeenCalled();
  });
});
