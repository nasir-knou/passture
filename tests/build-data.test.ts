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
            sources: [examSource],
          },
        ],
      }),
    ).not.toThrow();
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
