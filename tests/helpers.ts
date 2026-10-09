import { vi } from 'vitest';

import type { QuizSessionQuestion } from '../src/lib/quiz-session';
import type { Question, QuestionFile } from '../src/types/question';

/** Map 기반 Storage. setItem을 바꿔 끼우면 저장 실패도 흉내 낼 수 있다. */
export function createMemoryStorage(): Storage & { values: Map<string, string> } {
  const values = new Map<string, string>();

  return {
    values,
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
      values.set(key, String(value));
    },
  };
}

export function quotaExceededError(): Error {
  const error = new Error('quota exceeded');
  error.name = 'QuotaExceededError';
  return error;
}

export function makeQuestion(id: string, overrides: Partial<Question> = {}): Question {
  return {
    id,
    type: 'multiple-choice',
    prompt: `${id} 문제`,
    choices: [
      { id: '1', text: `${id} 보기 1` },
      { id: '2', text: `${id} 보기 2` },
      { id: '3', text: `${id} 보기 3` },
      { id: '4', text: `${id} 보기 4` },
    ],
    answers: ['1'],
    explanation: `${id} 해설`,
    ...overrides,
  };
}

export function makeQuestionFile(
  subjectId: string,
  sourceId: string,
  questions: Question[],
  kind: QuestionFile['kind'] = 'exam',
): QuestionFile {
  return { subjectId, sourceId, title: `${subjectId} ${sourceId}`, kind, questions };
}

export function makeSessionQuestion(
  id: string,
  overrides: Partial<Question> = {},
): QuizSessionQuestion {
  const question = makeQuestion(id, overrides);
  return {
    key: `subject:source:${id}`,
    subjectId: 'subject',
    subjectTitle: '과목',
    sourceId: 'source',
    sourceTitle: '출처',
    question,
    passages: [],
    choices: question.choices,
  };
}

export function idsFor(prefix: string, count: number): string[] {
  return Array.from(
    { length: count },
    (_, index) => `${prefix}-${String(index + 1).padStart(2, '0')}`,
  );
}

/**
 * data-loader가 읽는 JSON 파일을 경로별로 돌려주는 fetch 대역.
 * 프로덕션 분기(JSON + 캐시)를 타도록 DEV를 끈다.
 */
export function mockDataFetch(files: Record<string, unknown>) {
  vi.stubEnv('DEV', false);
  const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    const url = new URL(String(input));
    const path = url.pathname.replace(/^\/data\//, '');
    if (!(path in files)) {
      return new Response('not found', { status: 404 });
    }

    return new Response(JSON.stringify(files[path]), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}
