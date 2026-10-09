import { describe, expect, it } from 'vitest';

import { validateCatalog, validateQuestionFile } from '../scripts/build-data';
import type { CatalogSource } from '../src/types/catalog';

const examSource: CatalogSource = {
  id: 'past-exams-2019',
  title: '2019 기출',
  path: 'subjects/operating-systems/past-exams-2019.json',
  kind: 'exam',
  year: 2019,
};

const textbookSource: CatalogSource = {
  id: 'textbook',
  title: '교재 문제',
  path: 'subjects/algorithms/textbook.json',
  kind: 'textbook',
};

describe('data validation', () => {
  it('rejects duplicate question IDs', () => {
    expect(() =>
      validateQuestionFile(
        {
          subjectId: 'operating-systems',
          sourceId: 'past-exams-2019',
          title: '운영체제 2019 기출',
          kind: 'exam',
          year: 2019,
          questions: [validQuestion('e19-01'), validQuestion('e19-01')],
        },
        'operating-systems',
        examSource,
      ),
    ).toThrow(/unique/);
  });

  it('rejects missing passage references', () => {
    expect(() =>
      validateQuestionFile(
        {
          subjectId: 'operating-systems',
          sourceId: 'past-exams-2019',
          title: '운영체제 2019 기출',
          kind: 'exam',
          year: 2019,
          questions: [
            {
              ...validQuestion('e19-01'),
              passageRefs: ['g19-missing'],
            },
          ],
        },
        'operating-systems',
        examSource,
      ),
    ).toThrow(/missing passage/);
  });

  it('rejects choices whose unquoted text was split on commas', () => {
    expect(() =>
      validateQuestionFile(
        {
          subjectId: 'operating-systems',
          sourceId: 'past-exams-2019',
          title: '운영체제 2019 기출',
          kind: 'exam',
          year: 2019,
          questions: [
            {
              ...validQuestion('e19-01'),
              choices: [
                { id: '1', text: '$(4', '2': null, '1)$': null },
                { id: '2', text: '문서 편집' },
              ],
            },
          ],
        },
        'operating-systems',
        examSource,
      ),
    ).toThrow(/unknown keys/);
  });

  it('rejects unknown question keys such as passages instead of passageRefs', () => {
    expect(() =>
      validateQuestionFile(
        {
          subjectId: 'operating-systems',
          sourceId: 'past-exams-2019',
          title: '운영체제 2019 기출',
          kind: 'exam',
          year: 2019,
          passages: [{ id: 'g19-01', type: 'text', body: '지문' }],
          questions: [{ ...validQuestion('e19-01'), passages: ['g19-01'] }],
        },
        'operating-systems',
        examSource,
      ),
    ).toThrow(/unknown keys \(passages\)/);
  });

  it('rejects math that KaTeX cannot parse', () => {
    expect(() =>
      validateQuestionFile(
        {
          subjectId: 'operating-systems',
          sourceId: 'past-exams-2019',
          title: '운영체제 2019 기출',
          kind: 'exam',
          year: 2019,
          questions: [
            { ...validQuestion('e19-01'), prompt: '$\\\\begin{bmatrix}1&2\\end{bmatrix}$의 값은?' },
          ],
        },
        'operating-systems',
        examSource,
      ),
    ).toThrow(/invalid math/);
  });

  it('does not parse dollars inside inline code as math', () => {
    expect(() =>
      validateQuestionFile(
        {
          subjectId: 'operating-systems',
          sourceId: 'past-exams-2019',
          title: '운영체제 2019 기출',
          kind: 'exam',
          year: 2019,
          questions: [
            { ...validQuestion('e19-01'), prompt: '`echo $HOME $\\begin` 명령의 결과는?' },
          ],
        },
        'operating-systems',
        examSource,
      ),
    ).not.toThrow();
  });

  it('accepts empty choice text when the choice has a diagram', () => {
    expect(() =>
      validateQuestionFile(
        {
          subjectId: 'operating-systems',
          sourceId: 'past-exams-2019',
          title: '운영체제 2019 기출',
          kind: 'exam',
          year: 2019,
          questions: [
            {
              ...validQuestion('e19-01'),
              choices: [
                {
                  id: '1',
                  text: '',
                  diagram: {
                    type: 'data-table',
                    columns: ['A'],
                    rows: [['1']],
                  },
                },
                { id: '2', text: '문서 편집' },
              ],
            },
          ],
        },
        'operating-systems',
        examSource,
      ),
    ).not.toThrow();
  });

  it('rejects answers that are not choice IDs', () => {
    expect(() =>
      validateQuestionFile(
        {
          subjectId: 'operating-systems',
          sourceId: 'past-exams-2019',
          title: '운영체제 2019 기출',
          kind: 'exam',
          year: 2019,
          questions: [
            {
              ...validQuestion('e19-01'),
              answers: ['9'],
            },
          ],
        },
        'operating-systems',
        examSource,
      ),
    ).toThrow(/choices\.id/);
  });

  it('rejects exam IDs without the e prefix', () => {
    expect(() =>
      validateQuestionFile(
        {
          subjectId: 'operating-systems',
          sourceId: 'past-exams-2019',
          title: '운영체제 2019 기출',
          kind: 'exam',
          year: 2019,
          questions: [validQuestion('19-01')],
        },
        'operating-systems',
        examSource,
      ),
    ).toThrow(/e\{yy\}-\{nn\}/);
  });

  it('accepts the catalog shape', () => {
    expect(() =>
      validateCatalog({
        version: 1,
        subjects: [
          {
            id: 'operating-systems',
            title: '운영체제',
            semester: 1,
            sources: [examSource],
          },
        ],
      }),
    ).not.toThrow();
  });

  it('rejects missing subject semesters', () => {
    expect(() =>
      validateCatalog({
        version: 1,
        subjects: [
          {
            id: 'operating-systems',
            title: '운영체제',
            sources: [examSource],
          },
        ],
      }),
    ).toThrow(/semester/);
  });

  it('rejects invalid subject semesters', () => {
    expect(() =>
      validateCatalog({
        version: 1,
        subjects: [
          {
            id: 'operating-systems',
            title: '운영체제',
            semester: 3,
            sources: [examSource],
          },
        ],
      }),
    ).toThrow(/must be 1 or 2/);
  });

  it('accepts textbook IDs and choice images', () => {
    expect(() =>
      validateQuestionFile(
        {
          subjectId: 'algorithms',
          sourceId: 'textbook',
          title: '알고리즘 교재 문제',
          kind: 'textbook',
          questions: [
            {
              ...validQuestion('t01-01'),
              choices: [
                {
                  id: '1',
                  text: '①',
                  image: {
                    path: 'package.json',
                    alt: '테스트 선택지 이미지',
                  },
                },
                { id: '2', text: '②' },
              ],
            },
          ],
        },
        'algorithms',
        textbookSource,
      ),
    ).not.toThrow();
  });

  it('rejects malformed textbook IDs', () => {
    expect(() =>
      validateQuestionFile(
        {
          subjectId: 'algorithms',
          sourceId: 'textbook',
          title: '알고리즘 교재 문제',
          kind: 'textbook',
          questions: [validQuestion('b01-01')],
        },
        'algorithms',
        textbookSource,
      ),
    ).toThrow(/t\{chapter\}-\{nn\}/);
  });
});

describe('answer and explanation validation', () => {
  const threeChoices = [
    { id: '1', text: '자원 관리' },
    { id: '2', text: '문서 편집' },
    { id: '3', text: '스케줄링' },
  ];

  function validateSingle(question: Record<string, unknown>) {
    return () =>
      validateQuestionFile(
        {
          subjectId: 'operating-systems',
          sourceId: 'past-exams-2019',
          title: '운영체제 2019 기출',
          kind: 'exam',
          year: 2019,
          questions: [{ ...validQuestion('e19-01'), ...question }],
        },
        'operating-systems',
        examSource,
      );
  }

  it('rejects multiple-choice questions with more than one answer', () => {
    expect(validateSingle({ answers: ['1', '2'] })).toThrow(/exactly 1 answer for multiple-choice/);
  });

  it('rejects multi-answer questions with fewer than two answers', () => {
    expect(validateSingle({ type: 'multi-answer', choices: threeChoices, answers: ['1'] })).toThrow(
      /at least 2 answers for multi-answer/,
    );
  });

  it('accepts multi-answer questions with two or more answers', () => {
    expect(
      validateSingle({ type: 'multi-answer', choices: threeChoices, answers: ['1', '3'] }),
    ).not.toThrow();
  });

  it('rejects duplicate answers', () => {
    expect(
      validateSingle({ type: 'multi-answer', choices: threeChoices, answers: ['1', '1'] }),
    ).toThrow(/duplicates answer 1/);
  });

  it('rejects ox questions without exactly two choices', () => {
    expect(validateSingle({ type: 'ox', choices: threeChoices, answers: ['1'] })).toThrow(
      /exactly 2 choices for ox/,
    );
  });

  it('rejects ox questions with more than one answer', () => {
    expect(
      validateSingle({
        type: 'ox',
        choices: [
          { id: 'O', text: 'O' },
          { id: 'X', text: 'X' },
        ],
        answers: ['O', 'X'],
      }),
    ).toThrow(/exactly 1 answer for ox/);
  });

  it('accepts ox questions with two choices and one answer', () => {
    expect(
      validateSingle({
        type: 'ox',
        choices: [
          { id: 'O', text: 'O' },
          { id: 'X', text: 'X' },
        ],
        answers: ['X'],
      }),
    ).not.toThrow();
  });

  it('rejects explanation lines that reference a missing choice', () => {
    expect(validateSingle({ explanation: '선택지 1: 맞다.\n선택지 5: 없는 보기.' })).toThrow(
      /missing choice "5"/,
    );
  });

  it('accepts explanation lines whose reason starts with a colon', () => {
    expect(
      validateSingle({ explanation: '선택지 1 (정답): :는 ex 명령이다.\n선택지 2: 틀리다.' }),
    ).not.toThrow();
  });
});

function validQuestion(id: string) {
  return {
    id,
    type: 'multiple-choice',
    prompt: '운영체제의 주된 역할은?',
    choices: [
      { id: '1', text: '자원 관리' },
      { id: '2', text: '문서 편집' },
    ],
    answers: ['1'],
    explanation: '운영체제는 자원을 관리한다.',
  };
}
