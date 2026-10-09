import { beforeEach, describe, expect, it, vi } from 'vitest';

import { loadQuestionFile } from '../src/lib/data-loader';
import {
  createMockExamSession,
  extractMockExamQuestions,
  gradeSession,
  loadMockExamConfig,
  type MockExamConfig,
  type MockExamSession,
} from '../src/lib/mock-exam-session';
import { isCorrectAnswer } from '../src/lib/scorer';
import type { QuestionFile } from '../src/types/question';
import {
  createMemoryStorage,
  idsFor,
  makeQuestion,
  makeQuestionFile,
  makeSessionQuestion,
} from './helpers';

vi.mock('../src/lib/data-loader', () => ({
  loadQuestionFile: vi.fn(),
}));

const loadQuestionFileMock = vi.mocked(loadQuestionFile);

beforeEach(() => {
  vi.stubGlobal('sessionStorage', createMemoryStorage());
  loadQuestionFileMock.mockReset();
});

describe('isCorrectAnswer', () => {
  it('treats an empty selection as wrong only when an answer exists', () => {
    expect(isCorrectAnswer([], ['1'])).toBe(false);
  });

  it('requires an exact set match for multi-answer questions', () => {
    expect(isCorrectAnswer(['1', '2', '3'], ['1', '3'])).toBe(false);
    expect(isCorrectAnswer(['1', '2'], ['1', '3'])).toBe(false);
    expect(isCorrectAnswer(['3', '1'], ['1', '3'])).toBe(true);
  });
});

describe('gradeSession', () => {
  it('marks unanswered questions wrong and requires exact multi-answer matches', () => {
    const single = makeSessionQuestion('e19-01');
    const multi = makeSessionQuestion('e19-02', { type: 'multi-answer', answers: ['1', '3'] });
    const multiPartial = makeSessionQuestion('e19-03', {
      type: 'multi-answer',
      answers: ['2', '4'],
    });
    const unanswered = makeSessionQuestion('e19-04');
    const emptyArray = makeSessionQuestion('e19-05');
    const session = mockSession([
      {
        subjectId: 'os',
        subjectTitle: '운영체제',
        questions: [single, multi, multiPartial, unanswered, emptyArray],
        answers: {
          [single.key]: ['1'],
          [multi.key]: ['3', '1'],
          [multiPartial.key]: ['2'],
          [emptyArray.key]: [],
        },
      },
    ]);

    const [grade] = gradeSession(session);

    expect(grade).toMatchObject({ subjectId: 'os', total: 5, answered: 3, correct: 2 });
    expect(grade!.results.map((result) => result.isCorrect)).toEqual([
      true,
      true,
      false,
      false,
      false,
    ]);
    expect(grade!.results[3]).toEqual({ key: unanswered.key, selected: [], isCorrect: false });
  });

  it('never counts an empty selection as correct, even for a question with no answers', () => {
    const noAnswer = makeSessionQuestion('e19-01', { answers: [] });
    const session = mockSession([
      { subjectId: 'os', subjectTitle: '운영체제', questions: [noAnswer], answers: {} },
    ]);

    expect(gradeSession(session)[0]!.correct).toBe(0);
  });

  it('grades each subject separately', () => {
    const a = makeSessionQuestion('e19-01');
    const b = makeSessionQuestion('e19-01', { answers: ['2'] });
    b.key = 'other:source:e19-01';
    const session = mockSession([
      { subjectId: 'a', subjectTitle: 'A', questions: [a], answers: { [a.key]: ['1'] } },
      { subjectId: 'b', subjectTitle: 'B', questions: [b], answers: { [b.key]: ['1'] } },
    ]);

    expect(gradeSession(session).map((grade) => grade.correct)).toEqual([1, 0]);
  });
});

describe('createMockExamSession sample25 ordering', () => {
  const ids = idsFor('e19', 40);
  const file: QuestionFile = makeQuestionFile(
    'os',
    'past-exams-2019',
    ids.map((id) => makeQuestion(id)),
    'exam',
  );

  it('keeps sampled questions in original file order when questionOrder is default', async () => {
    loadQuestionFileMock.mockResolvedValue(file);
    const session = await createMockExamSession(config({ questionOrder: 'default' }));
    const selected = session.subjects[0]!.questions.map((q) => q.question.id);

    expect(selected).toHaveLength(25);
    expect(new Set(selected).size).toBe(25);
    expect(selected).toEqual([...selected].sort((a, b) => ids.indexOf(a) - ids.indexOf(b)));
    expect(loadQuestionFileMock).toHaveBeenCalledWith('subjects/os/past-exams-2019.json');
  });

  it('shuffles sampled questions when questionOrder is random', async () => {
    loadQuestionFileMock.mockResolvedValue(file);
    // Math.random() = 0이면 shuffled()는 한 칸씩 회전시키므로 원래 순서가 유지되지 않는다.
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const session = await createMockExamSession(config({ questionOrder: 'random' }));
    const selected = session.subjects[0]!.questions.map((q) => q.question.id);

    expect(selected).toHaveLength(25);
    expect(selected).not.toEqual([...selected].sort((a, b) => ids.indexOf(a) - ids.indexOf(b)));
  });

  it('uses every question in original order for questionMode all', async () => {
    loadQuestionFileMock.mockResolvedValue(file);
    const session = await createMockExamSession(config({ questionMode: 'all' }));

    expect(session.subjects[0]!.questions.map((q) => q.question.id)).toEqual(ids);
  });

  it('saves the new session and recomputes exam times from the start moment', async () => {
    loadQuestionFileMock.mockResolvedValue(file);
    const session = await createMockExamSession(
      config({ totalMinutes: 999, startTime: '00:00', endTime: '00:00' }),
    );

    expect(session.config.totalMinutes).toBe(25);
    expect(session.status).toBe('in-progress');
    expect(sessionStorage.getItem('pt.mockExamSession')).not.toBeNull();
  });
});

describe('extractMockExamQuestions grouped distribution', () => {
  it('assigns remainder questions to random groups rather than the first groups', () => {
    // shuffled([1..7])는 Math.random() = 0일 때 [2,3,4,5,6,7,1]이 되어 2~5그룹이 하나씩 더 받는다.
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const questions = [1, 2, 3, 4, 5, 6, 7].flatMap((group) =>
      idsFor(`b${String(group).padStart(2, '0')}`, 5).map((id) => makeSessionQuestion(id)),
    );

    const counts = countByGroup(extractMockExamQuestions(questions, 'workbook'));

    expect(Object.fromEntries(counts)).toEqual({ 1: 3, 2: 4, 3: 4, 4: 4, 5: 4, 6: 3, 7: 3 });
  });

  it('allocates base + remainder exactly when every group has enough questions', () => {
    const questions = [1, 2, 3, 4].flatMap((group) =>
      idsFor(`l${group}`, 10).map((id) => makeSessionQuestion(id)),
    );

    for (let run = 0; run < 20; run += 1) {
      const counts = [...countByGroup(extractMockExamQuestions(questions, 'lecture')).values()];
      expect(counts.reduce((sum, count) => sum + count, 0)).toBe(25);
      expect(counts.sort()).toEqual([6, 6, 6, 7]);
    }
  });

  it('uses group-0 questions only to fill shortages', () => {
    const grouped = [1, 2].flatMap((group) =>
      idsFor(`b0${group}`, 5).map((id) => makeSessionQuestion(id)),
    );
    const ungrouped = idsFor('x', 30).map((id) => makeSessionQuestion(`-${id}`));

    const selected = extractMockExamQuestions([...grouped, ...ungrouped], 'workbook');
    const counts = countByGroup(selected);

    expect(selected).toHaveLength(25);
    expect(counts.get(1)).toBe(5);
    expect(counts.get(2)).toBe(5);
    expect(counts.get(0)).toBe(15);
  });

  it('falls back to a random 25 when no question has a group number', () => {
    const questions = idsFor('x', 40).map((id) => makeSessionQuestion(`-${id}`));
    const selected = extractMockExamQuestions(questions, 'textbook');

    expect(selected).toHaveLength(25);
    expect(new Set(selected).size).toBe(25);
  });

  it('returns picks in original order even for grouped sources', () => {
    const questions = [1, 2, 3].flatMap((group) =>
      idsFor(`b0${group}`, 12).map((id) => makeSessionQuestion(id)),
    );
    const order = new Map(questions.map((question, index) => [question, index]));
    const selected = extractMockExamQuestions(questions, 'workbook');
    const indexes = selected.map((question) => order.get(question)!);

    expect(indexes).toEqual([...indexes].sort((a, b) => a - b));
  });
});

describe('normalizeMockExamConfig guards (via loadMockExamConfig)', () => {
  const source = {
    subjectId: 'os',
    subjectTitle: '운영체제',
    sourceId: 'past-exams-2019',
    sourceTitle: '2019 기말',
    path: 'subjects/os/past-exams-2019.json',
    kind: 'exam',
  };

  function stored(value: unknown): void {
    sessionStorage.setItem(
      'pt.mockExamConfig',
      typeof value === 'string' ? value : JSON.stringify(value),
    );
  }

  it('returns undefined when nothing or garbage is stored', () => {
    expect(loadMockExamConfig()).toBeUndefined();
    stored('{not json');
    expect(loadMockExamConfig()).toBeUndefined();
    stored('null');
    expect(loadMockExamConfig()).toBeUndefined();
    stored({ subjects: 'nope' });
    expect(loadMockExamConfig()).toBeUndefined();
    stored({ subjects: [] });
    expect(loadMockExamConfig()).toBeUndefined();
  });

  it('drops subjects without an id, title, or valid source and fails if none remain', () => {
    stored({
      subjects: [
        { subjectTitle: '제목 없음 ID', source },
        { subjectId: 'os', source },
        { subjectId: 'os', subjectTitle: '운영체제' },
        { subjectId: 'os', subjectTitle: '운영체제', source: { ...source, path: 3 } },
        { subjectId: 'os', subjectTitle: '운영체제', source: { ...source, sourceId: null } },
        null,
      ],
    });

    expect(loadMockExamConfig()).toBeUndefined();
  });

  it('fills defaults and normalizes enum fields', () => {
    stored({
      subjects: [
        { subjectId: 'os', subjectTitle: '운영체제', source, questionMode: 'bogus' },
        { subjectId: 'bad' },
        { subjectId: 'ds', subjectTitle: '자료구조', source, questionMode: 'all' },
      ],
      questionOrder: 'shuffle',
      choiceOrder: 'random',
    });

    const config = loadMockExamConfig();

    expect(config?.subjects.map((subject) => [subject.subjectId, subject.questionMode])).toEqual([
      ['os', 'sample25'],
      ['ds', 'all'],
    ]);
    expect(config?.totalMinutes).toBe(50);
    expect(config?.startTime).toMatch(/^\d\d:\d\d$/);
    expect(config?.endTime).toMatch(/^\d\d:\d\d$/);
    expect(config?.questionOrder).toBe('default');
    expect(config?.choiceOrder).toBe('random');
  });

  it('migrates the legacy sources array to a single source', () => {
    stored({
      subjects: [{ subjectId: 'os', subjectTitle: '운영체제', sources: [source, { ...source }] }],
      totalMinutes: 25,
      startTime: '10:00',
      endTime: '10:25',
    });

    expect(loadMockExamConfig()).toEqual({
      subjects: [{ subjectId: 'os', subjectTitle: '운영체제', questionMode: 'sample25', source }],
      totalMinutes: 25,
      startTime: '10:00',
      endTime: '10:25',
      questionOrder: 'default',
      choiceOrder: 'default',
    });
  });
});

function config(overrides: Partial<MockExamConfig> & { questionMode?: 'all' | 'sample25' } = {}) {
  const { questionMode = 'sample25', ...rest } = overrides;
  return {
    subjects: [
      {
        subjectId: 'os',
        subjectTitle: '운영체제',
        questionMode,
        source: {
          subjectId: 'os',
          subjectTitle: '운영체제',
          sourceId: 'past-exams-2019',
          sourceTitle: '2019 기말',
          path: 'subjects/os/past-exams-2019.json',
          kind: 'exam' as const,
        },
      },
    ],
    totalMinutes: 25,
    startTime: '10:00',
    endTime: '10:25',
    ...rest,
  } satisfies MockExamConfig;
}

function mockSession(subjects: MockExamSession['subjects']): MockExamSession {
  return {
    id: 'session',
    config: config(),
    subjects,
    activeSubjectIndex: 0,
    startedAt: new Date().toISOString(),
    bookmarks: [],
    status: 'finished',
  };
}

function countByGroup(questions: ReturnType<typeof makeSessionQuestion>[]): Map<number, number> {
  const counts = new Map<number, number>();
  for (const question of questions) {
    const group = Number(/^[a-z]+(\d+)/i.exec(question.question.id)?.[1] ?? 0);
    counts.set(group, (counts.get(group) ?? 0) + 1);
  }
  return counts;
}
