import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  validateOutdatedDocument,
  validateQuestionChapters,
  validateSyllabus,
} from '../scripts/build-data';
import { parseQuestionGroup, resolveQuestionChapter } from '../src/lib/chapter';
import {
  buildChapterIndex,
  countSelectedQuestions,
  createChapterSessionInput,
  loadChapterSelection,
  saveChapterSelection,
  type ChapterIndexSource,
} from '../src/lib/chapter-practice';
import { getOrCreateSession, saveSelectedSources } from '../src/lib/quiz-session';
import type { CatalogSource, CatalogSubject } from '../src/types/catalog';
import type { Question, QuestionFile } from '../src/types/question';
import type { Syllabus } from '../src/types/syllabus';

const syllabus: Syllabus = {
  subjectId: 'intro',
  title: '개론',
  chapters: [
    { no: 1, title: '데이터' },
    { no: 2, title: '자료구조' },
    { no: 3, title: '알고리즘' },
  ],
  lectures: [
    { no: 1, title: '데이터 (1)', chapters: [1] },
    { no: 2, title: '데이터 (2)', chapters: [1] },
    { no: 3, title: '자료구조와 알고리즘', chapters: [2, 3] },
  ],
};

describe('question chapter resolution', () => {
  it('parses the first numeric group of an ID', () => {
    expect(parseQuestionGroup('b03-07')).toBe(3);
    expect(parseQuestionGroup('l11-04')).toBe(11);
    expect(parseQuestionGroup('e19-01')).toBe(19);
  });

  it('uses the ID chapter for workbooks and the lecture mapping for lectures', () => {
    expect(resolveQuestionChapter({ id: 'b02-01' }, 'workbook', syllabus)).toBe(2);
    expect(resolveQuestionChapter({ id: 'l02-01' }, 'lecture', syllabus)).toBe(1);
    // 여러 장을 다루는 강은 첫 장이 주 장이다.
    expect(resolveQuestionChapter({ id: 'l03-01' }, 'lecture', syllabus)).toBe(2);
    expect(resolveQuestionChapter({ id: 'l09-01' }, 'lecture', syllabus)).toBeUndefined();
  });

  it('requires an explicit chapter for intensive sources', () => {
    expect(resolveQuestionChapter({ id: 'i02-01' }, 'intensive', syllabus)).toBeUndefined();
    expect(resolveQuestionChapter({ id: 'i02-01', chapter: 3 }, 'intensive', syllabus)).toBe(3);
  });

  it('requires an explicit chapter for exams and skips outdated questions', () => {
    expect(resolveQuestionChapter({ id: 'e19-01' }, 'exam', syllabus)).toBeUndefined();
    expect(resolveQuestionChapter({ id: 'e19-01', chapter: 3 }, 'exam', syllabus)).toBe(3);
    expect(
      resolveQuestionChapter({ id: 'e19-01', outdated: true }, 'exam', syllabus),
    ).toBeUndefined();
  });
});

describe('syllabus and chapter validation', () => {
  it('accepts a valid syllabus', () => {
    expect(() => validateSyllabus(structuredClone(syllabus), 'intro')).not.toThrow();
  });

  it('rejects lectures that reference missing chapters', () => {
    expect(() =>
      validateSyllabus(
        { ...syllabus, lectures: [{ no: 1, title: '없는 장', chapters: [9] }] },
        'intro',
      ),
    ).toThrow(/missing chapter 9/);
  });

  it('requires parts to cover every chapter exactly once', () => {
    const parts = (chapters: number[][]) =>
      chapters.map((list, index) => ({ no: index + 1, title: `부 ${index + 1}`, chapters: list }));

    expect(() =>
      validateSyllabus({ ...syllabus, parts: parts([[1, 2], [3]]) }, 'intro'),
    ).not.toThrow();
    expect(() => validateSyllabus({ ...syllabus, parts: parts([[1, 2]]) }, 'intro')).toThrow(
      /missing 3/,
    );
    expect(() =>
      validateSyllabus(
        {
          ...syllabus,
          parts: parts([
            [1, 2],
            [2, 3],
          ]),
        },
        'intro',
      ),
    ).toThrow(/another part/);
  });

  it('allows outdated only on exam questions', () => {
    expect(() =>
      validateQuestionChapters(
        file('workbook', [{ ...question('b01-01'), outdated: true }], 'workbook'),
        { id: 'workbook', title: '워크북', path: 'subjects/intro/workbook.json', kind: 'workbook' },
        syllabus,
      ),
    ).toThrow(/only allowed on exam/);
  });

  it('rejects exam questions without chapter or outdated', () => {
    expect(() =>
      validateQuestionChapters(file('exam', [question('e19-01')]), examSource, syllabus),
    ).toThrow(/has no chapter/);
  });

  it('rejects chapters that are not in the syllabus', () => {
    expect(() =>
      validateQuestionChapters(
        file('exam', [{ ...question('e19-01'), chapter: 7 }]),
        examSource,
        syllabus,
      ),
    ).toThrow(/chapter 7 is not in syllabus/);
  });

  it('rejects chapter fields on subjects without a syllabus', () => {
    expect(() =>
      validateQuestionChapters(
        file('exam', [{ ...question('e19-01'), chapter: 1 }]),
        examSource,
        undefined,
      ),
    ).toThrow(/no syllabus/);
  });

  it('returns outdated keys', () => {
    expect(
      validateQuestionChapters(
        file('exam', [
          { ...question('e19-01'), chapter: 1 },
          { ...question('e19-02'), outdated: true },
        ]),
        examSource,
        syllabus,
      ),
    ).toEqual(['intro:past-exams-2019:e19-02']);
  });

  it('requires docs/outdated.md to match outdated questions exactly', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'passture-outdated-'));
    fs.mkdirSync(path.join(root, 'docs'));
    const doc = path.join(root, 'docs', 'outdated.md');

    expect(() => validateOutdatedDocument([], root)).not.toThrow();
    expect(() => validateOutdatedDocument(['intro:past-exams-2019:e19-02'], root)).toThrow(
      /missing outdated/,
    );

    fs.writeFileSync(
      doc,
      [
        '형식: `{subjectId}:{sourceId}:{questionId}` 예: `intro:past-exams-2019:e19-99`',
        '- `intro:past-exams-2019:e19-02` — 주제 — 근거',
        '- `intro:basic-intensive:i02-101` — 세 자리 번호도 읽는다',
      ].join('\n'),
    );
    expect(() =>
      validateOutdatedDocument(
        ['intro:past-exams-2019:e19-02', 'intro:basic-intensive:i02-101'],
        root,
      ),
    ).not.toThrow();
    expect(() => validateOutdatedDocument(['intro:basic-intensive:i02-101'], root)).toThrow(
      /not marked outdated/,
    );
  });
});

describe('chapter practice session', () => {
  beforeEach(() => {
    vi.stubGlobal('sessionStorage', createMemoryStorage());
    vi.stubGlobal('crypto', { randomUUID: () => 'test-session' });
  });

  it('counts questions per chapter and category', () => {
    const index = chapterIndex();

    expect(index.counts.get(1)).toEqual({ lecture: 1, material: 0, exam: 1 });
    expect(index.counts.get(2)).toEqual({ lecture: 1, material: 1, exam: 0 });
    expect(index.outdatedCount).toBe(1);
    expect(
      countSelectedQuestions(index, { subjectId: 'intro', chapters: [1, 2], categories: ['exam'] }),
    ).toBe(1);
    // 북마크/오답 범위를 반영하면 세션과 같은 수를 센다.
    expect(
      countSelectedQuestions(
        index,
        { subjectId: 'intro', chapters: [1, 2], categories: ['lecture', 'material', 'exam'] },
        new Set(['intro:workbook:b02-01', 'intro:past-exams-2019:e19-02']),
      ),
    ).toBe(1);
  });

  it('builds a session filtered by chapter and ordered by chapter then category', () => {
    const index = chapterIndex();
    const input = createChapterSessionInput(index, {
      subjectId: 'intro',
      chapters: [1, 2],
      categories: ['lecture', 'material', 'exam'],
    });
    const session = getOrCreateSession(
      input.sources,
      'all',
      input.include,
      undefined,
      input.grouping,
    );

    expect(session.questions.map((item) => item.key)).toEqual([
      'intro:lecture-exercises:l01-01',
      'intro:past-exams-2019:e19-01',
      'intro:lecture-exercises:l03-01',
      'intro:workbook:b02-01',
    ]);
    expect(session.questions.map((item) => item.chapter)).toEqual([1, 1, 2, 2]);
  });

  it('recreates the session when the chapter selection changes', () => {
    const index = chapterIndex();
    const first = createChapterSessionInput(index, {
      subjectId: 'intro',
      chapters: [1],
      categories: ['exam'],
    });
    const second = createChapterSessionInput(index, {
      subjectId: 'intro',
      chapters: [2],
      categories: ['lecture'],
    });

    const firstSession = getOrCreateSession(
      first.sources,
      'all',
      first.include,
      undefined,
      first.grouping,
    );
    const secondSession = getOrCreateSession(
      second.sources,
      'all',
      second.include,
      undefined,
      second.grouping,
    );

    expect(firstSession.sourceSignature).not.toBe(secondSession.sourceSignature);
    expect(secondSession.questions.map((item) => item.key)).toEqual([
      'intro:lecture-exercises:l03-01',
    ]);
  });

  it('stores the chapter selection until a source selection replaces it', () => {
    saveChapterSelection({ subjectId: 'intro', chapters: [2, 1], categories: ['exam'] });
    expect(loadChapterSelection()).toEqual({
      subjectId: 'intro',
      chapters: [2, 1],
      categories: ['exam'],
    });

    saveSelectedSources([
      {
        subjectId: 'intro',
        subjectTitle: '개론',
        sourceId: 'past-exams-2019',
        sourceTitle: '2019 기말',
        path: 'subjects/intro/past-exams-2019.json',
      },
    ]);
    expect(loadChapterSelection()).toBeUndefined();
  });
});

const examSource: CatalogSource = {
  id: 'past-exams-2019',
  title: '2019 기말',
  path: 'subjects/intro/past-exams-2019.json',
  kind: 'exam',
  year: 2019,
};

function chapterIndex() {
  const subject: CatalogSubject = {
    id: 'intro',
    title: '개론',
    semester: 2,
    syllabus: 'subjects/intro/syllabus.json',
    sources: [],
  };
  const sources: ChapterIndexSource[] = [
    indexSource('past-exams-2019', 'exam', 0, [
      { ...question('e19-01'), chapter: 1 },
      { ...question('e19-02'), outdated: true },
    ]),
    indexSource('workbook', 'workbook', 1, [question('b02-01')]),
    indexSource('lecture-exercises', 'lecture', 2, [question('l03-01'), question('l01-01')]),
  ];

  return buildChapterIndex(subject, syllabus, sources);
}

function indexSource(
  sourceId: string,
  kind: CatalogSource['kind'],
  order: number,
  questions: Question[],
): ChapterIndexSource {
  return {
    subjectId: 'intro',
    subjectTitle: '개론',
    sourceId,
    sourceTitle: sourceId,
    path: `subjects/intro/${sourceId}.json`,
    kind,
    category: kind === 'exam' ? 'exam' : kind === 'lecture' ? 'lecture' : 'material',
    order,
    file: file(kind, questions, sourceId),
  };
}

function file(
  kind: CatalogSource['kind'],
  questions: Question[],
  sourceId = 'past-exams-2019',
): QuestionFile {
  return { subjectId: 'intro', sourceId, title: sourceId, kind, questions };
}

function question(id: string): Question {
  return {
    id,
    type: 'multiple-choice',
    prompt: `${id} 문제`,
    choices: [
      { id: '1', text: '하나' },
      { id: '2', text: '둘' },
    ],
    answers: ['1'],
    explanation: '해설',
  };
}

function createMemoryStorage(): Storage {
  const values = new Map<string, string>();

  return {
    get length() {
      return values.size;
    },
    clear: () => values.clear(),
    getItem: (key) => values.get(key) ?? null,
    key: (index) => [...values.keys()][index] ?? null,
    removeItem: (key) => {
      values.delete(key);
    },
    setItem: (key, value) => {
      values.set(key, value);
    },
  };
}
