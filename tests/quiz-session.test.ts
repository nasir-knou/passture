import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  answerCurrentQuestion,
  createQuizSession,
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
    expect(session.questions[0]?.sourceTitle).toBe('2019 기출');
    expect(session.sourceSignature).toBe(
      'operating-systems:past-exams-2019:subjects/operating-systems/past-exams-2019.json',
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
});

function source(): LoadedQuestionSource {
  return {
    subjectId: 'operating-systems',
    sourceId: 'past-exams-2019',
    sourceTitle: '2019 기출',
    path: 'subjects/operating-systems/past-exams-2019.json',
    file: {
      subjectId: 'operating-systems',
      sourceId: 'past-exams-2019',
      title: '운영체제 2019 기출',
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
