import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  answerAllDraftQuestions,
  answerCurrentQuestion,
  clearPracticeState,
  createQuizSession,
  getOrCreateSession,
  loadPracticeOptions,
  loadPracticeScope,
  loadSelectedSources,
  loadSession,
  savePracticeOptions,
  savePracticeScope,
  saveDraftAnswer,
  saveSession,
  saveSelectedSources,
  scoreSession,
  type LoadedQuestionSource,
} from '../src/lib/quiz-session';

describe('quiz session', () => {
  beforeEach(() => {
    vi.stubGlobal('sessionStorage', createMemoryStorage());
    vi.stubGlobal('crypto', { randomUUID: () => 'test-session' });
  });

  it('creates a shuffled session with source metadata', () => {
    const session = createQuizSession([source()]);

    expect(session.questions).toHaveLength(2);
    expect(session.questions[0]?.sourceTitle).toBe('2019 기말');
    expect(session.sourceSignature).toMatch(
      /^operating-systems:운영체제:past-exams-2019:subjects\/operating-systems\/past-exams-2019\.json:[a-z0-9]+$/,
    );
  });

  it('records answers and computes the result score', () => {
    const session = createQuizSession([source()]);
    const current = session.questions[session.currentIndex];
    const answered = answerCurrentQuestion(session, current.question.answers);
    const score = scoreSession(answered);

    expect(answered.responses[current.key]?.correct).toBe(true);
    expect(score.total).toBe(2);
    expect(score.answered).toBe(1);
    expect(score.correct).toBe(1);
    expect(score.percent).toBe(50);
  });

  it('stores draft answers separately from checked responses', () => {
    const session = createQuizSession([source()]);
    const current = session.questions[session.currentIndex];
    const updated = saveDraftAnswer(session, current.key, ['1']);

    expect(updated.draftAnswers[current.key]).toEqual(['1']);
    expect(updated.responses[current.key]).toBeUndefined();
  });

  it('recreates the session when loaded question content changes', () => {
    const firstSession = getOrCreateSession([source()]);
    const changedSource = source();
    changedSource.file.questions[0].explanation = '변경된 해설';
    const nextSession = getOrCreateSession([changedSource]);

    expect(nextSession.id).toBe('test-session');
    expect(nextSession.sourceSignature).not.toBe(firstSession.sourceSignature);
    expect(nextSession.questions[0]?.question.explanation).toBe('변경된 해설');
  });

  it('grades all draft answers at once', () => {
    const session = createQuizSession([source()]);
    const first = session.questions[0];
    const second = session.questions[1];
    const withFirst = saveDraftAnswer(session, first.key, ['1']);
    const withSecond = saveDraftAnswer(withFirst, second.key, ['X']);
    const graded = answerAllDraftQuestions(withSecond);

    expect(scoreSession(graded)).toMatchObject({
      total: 2,
      answered: 2,
      correct: 2,
      percent: 100,
    });
  });

  it('clears selected sources, options, scope, and current session', () => {
    const selectedSources = [
      {
        subjectId: 'operating-systems',
        subjectTitle: '운영체제',
        sourceId: 'past-exams-2019',
        sourceTitle: '2019 기말',
        path: 'subjects/operating-systems/past-exams-2019.json',
      },
    ];

    saveSelectedSources(selectedSources);
    savePracticeScope('wrong');
    savePracticeOptions({ questionOrder: 'random', choiceOrder: 'random' });
    saveSession(createQuizSession([source()]));
    clearPracticeState();

    expect(loadSelectedSources()).toEqual([]);
    expect(loadPracticeScope()).toBe('all');
    expect(loadPracticeOptions()).toEqual({ questionOrder: 'default', choiceOrder: 'default' });
    expect(loadSession()).toBeUndefined();
  });
});

function source(): LoadedQuestionSource {
  return {
    subjectId: 'operating-systems',
    subjectTitle: '운영체제',
    sourceId: 'past-exams-2019',
    sourceTitle: '2019 기말',
    path: 'subjects/operating-systems/past-exams-2019.json',
    file: {
      subjectId: 'operating-systems',
      sourceId: 'past-exams-2019',
      title: '운영체제 2019 기말',
      kind: 'exam',
      year: 2019,
      questions: [
        {
          id: 'e19-01',
          type: 'multiple-choice',
          prompt: '운영체제의 역할은?',
          choices: [
            { id: '1', text: '자원 관리' },
            { id: '2', text: '문서 편집' },
          ],
          answers: ['1'],
          explanation: '운영체제는 자원을 관리한다.',
        },
        {
          id: 'e19-02',
          type: 'ox',
          prompt: '스레드와 프로세스는 같다.',
          choices: [
            { id: 'O', text: 'O' },
            { id: 'X', text: 'X' },
          ],
          answers: ['X'],
          explanation: '둘은 다르다.',
        },
      ],
    },
  };
}

function createMemoryStorage(): Storage {
  const values = new Map<string, string>();

  return {
    get length() {
      return values.size;
    },
    clear() {
      values.clear();
    },
    getItem(key: string) {
      return values.get(key) ?? null;
    },
    key(index: number) {
      return Array.from(values.keys())[index] ?? null;
    },
    removeItem(key: string) {
      values.delete(key);
    },
    setItem(key: string, value: string) {
      values.set(key, value);
    },
  };
}
