import { describe, expect, it } from 'vitest';

import { calcMockExamTimes, extractMockExamQuestions } from '../src/lib/mock-exam-session';
import type { QuizSessionQuestion } from '../src/lib/quiz-session';
import type { SourceKind } from '../src/types/catalog';

describe('mock exam question extraction', () => {
  it('keeps a 25-question exam source as-is', () => {
    const questions = questionsFor('e19', 25);

    expect(extractMockExamQuestions(questions, 'exam').map((q) => q.question.id)).toEqual(
      questions.map((q) => q.question.id),
    );
  });

  it('extracts 25 questions from a 35-question exam source', () => {
    const selected = extractMockExamQuestions(questionsFor('e19', 35), 'exam');

    expect(selected).toHaveLength(25);
    expect(new Set(selected.map((q) => q.question.id)).size).toBe(25);
  });

  it('spreads textbook-like sources across the full ID group range', () => {
    const selected = extractMockExamQuestions(groupedQuestions('b', 7, 5), 'workbook');
    const counts = countByGroup(selected);

    expect(selected).toHaveLength(25);
    expect([...counts.values()].sort()).toEqual([3, 3, 3, 4, 4, 4, 4]);
  });

  it('fills shortages from other groups when some groups have too few questions', () => {
    const sparse = [
      ...questionsFor('b01', 1),
      ...questionsFor('b02', 1),
      ...questionsFor('b03', 30),
    ];

    const selected = extractMockExamQuestions(sparse, 'workbook');
    const counts = countByGroup(selected);

    expect(selected).toHaveLength(25);
    expect(counts.get('01')).toBe(1);
    expect(counts.get('02')).toBe(1);
    expect(counts.get('03')).toBe(23);
  });

  it('fills shortages from the full remaining candidate pool', () => {
    const sparse = [
      ...questionsFor('b01', 1),
      ...questionsFor('b02', 10),
      ...questionsFor('b03', 10),
      ...questionsFor('b04', 10),
    ];

    const selected = extractMockExamQuestions(sparse, 'workbook');
    const counts = countByGroup(selected);

    expect(selected).toHaveLength(25);
    expect(counts.get('01')).toBe(1);
    expect((counts.get('02') ?? 0) + (counts.get('03') ?? 0) + (counts.get('04') ?? 0)).toBe(24);
    expect(counts.get('02')).toBeGreaterThanOrEqual(6);
    expect(counts.get('03')).toBeGreaterThanOrEqual(6);
    expect(counts.get('04')).toBeGreaterThanOrEqual(6);
  });
});

describe('mock exam time calculation', () => {
  it('uses the provided start date as the exam start time', () => {
    expect(calcMockExamTimes(2, new Date(2026, 4, 9, 13, 42))).toEqual({
      totalMinutes: 50,
      startTime: '13:42',
      endTime: '14:32',
    });
  });

  it('wraps the displayed end time after midnight', () => {
    expect(calcMockExamTimes(1, new Date(2026, 0, 1, 23, 50))).toEqual({
      totalMinutes: 25,
      startTime: '23:50',
      endTime: '00:15',
    });
  });
});

function groupedQuestions(
  prefix: string,
  groupCount: number,
  perGroup: number,
): QuizSessionQuestion[] {
  return Array.from({ length: groupCount }, (_, groupIndex) =>
    questionsFor(`${prefix}${String(groupIndex + 1).padStart(2, '0')}`, perGroup),
  ).flat();
}

function questionsFor(prefix: string, count: number): QuizSessionQuestion[] {
  return Array.from({ length: count }, (_, index) =>
    question(`${prefix}-${String(index + 1).padStart(2, '0')}`),
  );
}

function question(id: string, kind: SourceKind = 'workbook'): QuizSessionQuestion {
  return {
    key: `subject:source:${id}`,
    subjectId: 'subject',
    subjectTitle: '과목',
    sourceId: 'source',
    sourceTitle: '출처',
    question: {
      id,
      type: 'multiple-choice',
      prompt: 'prompt',
      choices: [
        { id: '1', text: 'A' },
        { id: '2', text: 'B' },
      ],
      answers: ['1'],
      explanation: 'explanation',
      tags: [kind],
    },
    passages: [],
    choices: [
      { id: '1', text: 'A' },
      { id: '2', text: 'B' },
    ],
  };
}

function countByGroup(questions: QuizSessionQuestion[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const q of questions) {
    const group = q.question.id.match(/^[a-z]+(\d+)/i)?.[1] ?? '00';
    counts.set(group, (counts.get(group) ?? 0) + 1);
  }
  return counts;
}
