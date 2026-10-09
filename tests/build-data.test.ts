import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { validateCatalog, validateQuestionFile } from '../scripts/build-data';
import { validateEmphasis } from '../scripts/validate/rich-text';
import type { CatalogSource } from '../src/types/catalog';

// 이미지 경로는 public/ 아래에서만 찾으므로 임시 저장소 루트를 만든다.
let imageRoot = '';
beforeAll(() => {
  imageRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'passture-build-data-'));
  fs.mkdirSync(path.join(imageRoot, 'public', 'images'), { recursive: true });
  fs.writeFileSync(path.join(imageRoot, 'public', 'images', 'figure.png'), '');
  fs.writeFileSync(path.join(imageRoot, 'outside.png'), '');
});

afterEach(() => {
  vi.restoreAllMocks();
});

afterAll(() => {
  fs.rmSync(imageRoot, { recursive: true, force: true });
});

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
                    path: 'images/figure.png',
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
        imageRoot,
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

function examFile(overrides: Record<string, unknown> = {}) {
  return {
    subjectId: 'operating-systems',
    sourceId: 'past-exams-2019',
    title: '운영체제 2019 기출',
    kind: 'exam',
    year: 2019,
    questions: [validQuestion('e19-01')],
    ...overrides,
  };
}

function validateExam(overrides: Record<string, unknown> = {}) {
  return () =>
    validateQuestionFile(examFile(overrides), 'operating-systems', examSource, imageRoot);
}

/** 지문 하나를 첫 문제가 참조하도록 넣어 검증한다. */
function validateWithPassage(passage: Record<string, unknown>) {
  return validateExam({
    passages: [{ id: 'g19-01', ...passage }],
    questions: [{ ...validQuestion('e19-01'), passageRefs: ['g19-01'] }],
  });
}

function validateWithDiagram(diagram: Record<string, unknown>) {
  return validateWithPassage({ type: 'diagram', diagram });
}

function simpleGraph(node: Record<string, unknown> = {}, edge: Record<string, unknown> = {}) {
  return {
    type: 'simple-graph',
    width: 100,
    height: 100,
    nodes: [
      { id: 'a', label: 'A', x: 10, y: 10, ...node },
      { id: 'b', label: 'B', x: 50, y: 50 },
    ],
    edges: [{ from: 'a', to: 'b', ...edge }],
  };
}

function ragDiagram(node: Record<string, unknown> = {}) {
  return {
    type: 'resource-allocation-graph',
    width: 100,
    height: 100,
    nodes: [
      { id: 'p1', kind: 'process', label: 'P_1', x: 10, y: 10, ...node },
      { id: 'r1', kind: 'resource', label: 'R_1', x: 50, y: 50, units: 2 },
    ],
    edges: [{ from: 'p1', to: 'r1', label: 'req', labelDx: 2, labelDy: -2 }],
  };
}

function catalogWith(sources: object[]) {
  return {
    version: 1,
    subjects: [{ id: 'operating-systems', title: '운영체제', semester: 1, sources }],
  };
}

describe('diagram key and style validation', () => {
  it('accepts every simple-graph node style the renderer reads', () => {
    expect(
      validateWithDiagram(
        simpleGraph(
          {
            shape: 'box',
            width: 40,
            height: 20,
            radius: 12,
            fontSize: 14,
            strokeWidth: 2,
            fillColor: '#111827',
            strokeColor: '#abc',
            textColor: 'white',
            tone: 'filled',
            hideLabel: false,
            hideNode: false,
            underline: true,
            labelDx: -4,
            labelDy: 0,
          },
          { label: '$w_1$', directed: true, curve: -10, style: 'dashed' },
        ),
      ),
    ).not.toThrow();
  });

  it('rejects unknown simple-graph node keys', () => {
    expect(validateWithDiagram(simpleGraph({ colour: 'red' }))).toThrow(
      /nodes\[0\] has unknown keys \(colour\)/,
    );
  });

  it('rejects unknown keys on the diagram and its edges', () => {
    expect(validateWithDiagram({ ...simpleGraph(), title: '그래프' })).toThrow(
      /diagram has unknown keys \(title\)/,
    );
    expect(validateWithDiagram(simpleGraph({}, { arrow: true }))).toThrow(
      /edges\[0\] has unknown keys \(arrow\)/,
    );
  });

  it('rejects malformed colors', () => {
    expect(validateWithDiagram(simpleGraph({ fillColor: '#12345' }))).toThrow(
      /fillColor must be a hex color/,
    );
    expect(validateWithDiagram(simpleGraph({ textColor: 'rgb(0,0,0)' }))).toThrow(
      /textColor must be a hex color/,
    );
  });

  it('rejects non-positive sizes', () => {
    expect(validateWithDiagram(simpleGraph({ radius: -1 }))).toThrow(
      /radius must be a non-negative number/,
    );
    expect(validateWithDiagram(simpleGraph({ radius: 0 }))).not.toThrow();
    expect(validateWithDiagram(simpleGraph({ strokeWidth: 0 }))).toThrow(
      /strokeWidth must be a positive number/,
    );
    expect(validateWithDiagram(simpleGraph({ fontSize: '12' }))).toThrow(/fontSize must be a/);
    expect(validateWithDiagram({ ...simpleGraph(), width: -1 })).toThrow(
      /width must be a positive number/,
    );
  });

  it('rejects tones and shapes outside the type enum', () => {
    expect(validateWithDiagram(simpleGraph({ tone: 'outline' }))).toThrow(/tone must be one of/);
    expect(validateWithDiagram(simpleGraph({ shape: 'triangle' }))).toThrow(/shape must be one of/);
  });

  it('rejects math errors in simple-graph labels', () => {
    expect(validateWithDiagram(simpleGraph({ label: '$\\frac{1$' }))).toThrow(/invalid math/);
    expect(validateWithDiagram(simpleGraph({}, { label: '$\\badcommand$' }))).toThrow(
      /edges\[0\]\.label has invalid math/,
    );
  });

  it('accepts resource-allocation-graph nodes and edges', () => {
    expect(validateWithDiagram(ragDiagram())).not.toThrow();
  });

  it('rejects simple-graph style keys on resource-allocation-graph nodes', () => {
    expect(validateWithDiagram(ragDiagram({ shape: 'box', hideLabel: true }))).toThrow(
      /unknown keys \(shape, hideLabel\)/,
    );
  });

  it('rejects unknown keys on the other diagram types', () => {
    expect(
      validateWithDiagram({
        type: 'ui-window',
        width: 100,
        height: 80,
        title: '창',
        components: [{ kind: 'label', label: '이름', x: 1, y: 1, color: 'red' }],
      }),
    ).toThrow(/components\[0\] has unknown keys \(color\)/);
    expect(
      validateWithDiagram({
        type: 'memory-free-list',
        width: 100,
        height: 80,
        blocks: [{ id: 'a', kind: 'free', label: '10K', colour: 'red' }],
      }),
    ).toThrow(/blocks\[0\] has unknown keys \(colour\)/);
    expect(
      validateWithDiagram({
        type: 'clock-page-replacement',
        width: 100,
        height: 100,
        pointerIndex: 0,
        entries: [{ page: '1', referenceBit: 0, dirty: 1 }],
      }),
    ).toThrow(/entries\[0\] has unknown keys \(dirty\)/);
    expect(
      validateWithDiagram({ type: 'data-table', columns: ['A'], rows: [['1']], caption: '표' }),
    ).toThrow(/diagram has unknown keys \(caption\)/);
  });

  it('checks math in data-table headers even for code tables', () => {
    expect(
      validateWithDiagram({
        type: 'data-table',
        cellFormat: 'code',
        columns: ['$\\frac{1$'],
        rows: [['$not math']],
      }),
    ).toThrow(/columns\[0\] has invalid math/);
    expect(
      validateWithDiagram({
        type: 'data-table',
        cellFormat: 'code',
        columns: ['$x_1$'],
        rows: [['echo $HOME $\\begin']],
      }),
    ).not.toThrow();
  });
});

describe('passage validation', () => {
  it('accepts each passage type with its own fields', () => {
    expect(validateWithPassage({ type: 'text', body: '지문 $x$' })).not.toThrow();
    expect(
      validateWithPassage({
        type: 'code',
        language: 'c',
        body: 'int x = 1;',
        highlights: ['x = 1'],
      }),
    ).not.toThrow();
    expect(
      validateWithPassage({ type: 'image', image: { path: 'images/figure.png', alt: '그림' } }),
    ).not.toThrow();
    expect(
      validateWithPassage({
        type: 'diagram',
        diagram: { type: 'data-table', columns: ['A'], rows: [['1']] },
      }),
    ).not.toThrow();
  });

  it('rejects unknown passage keys', () => {
    expect(validateWithPassage({ type: 'text', body: '지문', caption: '설명' })).toThrow(
      /not allowed for text passages \(caption\)/,
    );
  });

  it('rejects fields that belong to another passage type', () => {
    expect(
      validateWithPassage({
        type: 'text',
        body: '지문',
        image: { path: 'images/figure.png', alt: '그림' },
      }),
    ).toThrow(/not allowed for text passages \(image\)/);
    expect(validateWithPassage({ type: 'text', body: '지문', highlights: ['지문'] })).toThrow(
      /not allowed for text passages \(highlights\)/,
    );
    expect(
      validateWithPassage({
        type: 'image',
        image: { path: 'images/figure.png', alt: '그림' },
        body: 'x',
      }),
    ).toThrow(/not allowed for image passages \(body\)/);
  });

  it('rejects passages missing the content their type needs', () => {
    expect(validateWithPassage({ type: 'text' })).toThrow(/body must be a non-empty string/);
    expect(validateWithPassage({ type: 'code', language: 'c' })).toThrow(/body must be/);
    expect(validateWithPassage({ type: 'image' })).toThrow(/image is required/);
    expect(validateWithPassage({ type: 'diagram' })).toThrow(/diagram is required/);
  });

  it('rejects highlights that do not occur in the body', () => {
    expect(
      validateWithPassage({ type: 'code', body: 'int x = 1;', highlights: ['y = 2'] }),
    ).toThrow(/highlights\[0\] does not occur in the passage body/);
  });

  it('does not parse highlights as math', () => {
    expect(
      validateWithPassage({ type: 'code', body: 'echo $1 $2', highlights: ['$1 $2'] }),
    ).not.toThrow();
  });

  it('warns about passages no question references', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    validateExam({ passages: [{ id: 'g19-unused', type: 'text', body: '지문' }] })();
    expect(warn).toHaveBeenCalledWith(
      expect.stringMatching(
        /operating-systems:past-exams-2019:g19-unused passage is not referenced/,
      ),
    );
  });

  it('does not warn about referenced passages', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    validateWithPassage({ type: 'text', body: '지문' })();
    expect(warn).not.toHaveBeenCalled();
  });
});

describe('image path validation', () => {
  function validateImagePath(imagePath: string) {
    return validateExam({
      questions: [{ ...validQuestion('e19-01'), images: [{ path: imagePath, alt: '그림' }] }],
    });
  }

  it('accepts relative paths that exist under public/', () => {
    expect(validateImagePath('images/figure.png')).not.toThrow();
  });

  it('rejects leading slashes', () => {
    expect(validateImagePath('/images/figure.png')).toThrow(/no leading \//);
  });

  it('rejects parent directory segments', () => {
    expect(validateImagePath('images/../outside.png')).toThrow(/must not contain \.\./);
    expect(validateImagePath('../outside.png')).toThrow(/must not contain \.\./);
  });

  it('rejects URLs', () => {
    expect(validateImagePath('https://example.com/a.png')).toThrow(/not a URL/);
  });

  it('rejects files that exist only outside public/', () => {
    expect(validateImagePath('outside.png')).toThrow(/does not exist under public\//);
  });

  it('rejects unknown image keys', () => {
    expect(
      validateExam({
        questions: [
          {
            ...validQuestion('e19-01'),
            images: [{ path: 'images/figure.png', alt: '그림', width: 100 }],
          },
        ],
      }),
    ).toThrow(/images\[0\] has unknown keys \(width\)/);
  });
});

describe('question file and catalog shape', () => {
  it('rejects unknown top-level question-file keys', () => {
    expect(validateExam({ subject: 'operating-systems' })).toThrow(
      /questionFile has unknown keys \(subject\)/,
    );
  });

  it('rejects a file year that differs from the catalog year', () => {
    expect(validateExam({ year: 2018 })).toThrow(/year must be 2019/);
  });

  it('rejects a file year when the catalog source has none', () => {
    expect(() =>
      validateQuestionFile(
        {
          subjectId: 'algorithms',
          sourceId: 'textbook',
          title: '알고리즘 교재 문제',
          kind: 'textbook',
          year: 2019,
          questions: [validQuestion('t01-01')],
        },
        'algorithms',
        textbookSource,
      ),
    ).toThrow(/year must be absent/);
  });

  it('accepts answerKey strings without parsing them as math', () => {
    expect(
      validateExam({ questions: [{ ...validQuestion('e19-01'), answerKey: '$1 $2' }] }),
    ).not.toThrow();
    expect(validateExam({ questions: [{ ...validQuestion('e19-01'), answerKey: 3 }] })).toThrow(
      /answerKey must be a non-empty string/,
    );
  });

  it('rejects unknown catalog, subject, and source keys', () => {
    expect(() => validateCatalog({ ...catalogWith([examSource]), name: 'x' })).toThrow(
      /catalog has unknown keys \(name\)/,
    );
    expect(() =>
      validateCatalog({
        version: 1,
        subjects: [
          { id: 'operating-systems', title: '운영체제', semester: 1, sources: [], code: 'OS' },
        ],
      }),
    ).toThrow(/subjects\[0\] has unknown keys \(code\)/);
    expect(() => validateCatalog(catalogWith([{ ...examSource, questionCount: 3 }]))).toThrow(
      /sources\[0\] has unknown keys \(questionCount\)/,
    );
  });

  it('rejects source paths outside the subject directory', () => {
    expect(() =>
      validateCatalog(
        catalogWith([{ ...examSource, path: 'subjects/algorithms/past-exams-2019.json' }]),
      ),
    ).toThrow(/must be under subjects\/operating-systems\//);
    expect(() =>
      validateCatalog(
        catalogWith([{ ...examSource, path: 'subjects/operating-systems/../x.json' }]),
      ),
    ).toThrow(/must be under subjects\/operating-systems\//);
  });

  it('rejects duplicate source paths across subjects', () => {
    expect(() =>
      validateCatalog({
        version: 1,
        subjects: [
          { id: 'operating-systems', title: '운영체제', semester: 1, sources: [examSource] },
          {
            id: 'operating-systems-2',
            title: '운영체제 2',
            semester: 1,
            sources: [{ ...examSource, path: 'subjects/operating-systems-2/a.json' }],
          },
        ],
      }),
    ).not.toThrow();
    expect(() =>
      validateCatalog(catalogWith([examSource, { ...examSource, id: 'past-exams-2019-copy' }])),
    ).toThrow(/path must be unique/);
  });

  it('requires a year on exam sources', () => {
    const { year: _year, ...withoutYear } = examSource;
    expect(() => validateCatalog(catalogWith([withoutYear]))).toThrow(
      /year is required for exam sources/,
    );
    expect(() =>
      validateCatalog(
        catalogWith([{ ...textbookSource, path: 'subjects/operating-systems/textbook.json' }]),
      ),
    ).not.toThrow();
  });
});

describe('== emphasis validation', () => {
  it('accepts paired delimiters on each line', () => {
    expect(() => validateEmphasis('==강조== 그리고 ==또==', 'text')).not.toThrow();
    expect(() => validateEmphasis('==첫 줄==\n둘째 줄', 'text')).not.toThrow();
  });

  it('rejects an odd count on one line even when the whole text is even', () => {
    expect(() => validateEmphasis('==첫 줄\n둘째 줄==', 'text')).toThrow(
      /text line 1 has an unpaired ==/,
    );
  });

  it('ignores delimiters inside inline code and math', () => {
    expect(() => validateEmphasis('`a == b`이면 참', 'text')).not.toThrow();
    expect(() => validateEmphasis('$a == b$이면 참', 'text')).not.toThrow();
    expect(() => validateEmphasis('`x\ny` 다음 a == b', 'text')).toThrow(/text line 2/);
  });

  it('rejects pairs split by math, which the renderer does not join', () => {
    expect(() => validateEmphasis('==a $x$ b==', 'text')).toThrow(/text line 1 has an unpaired ==/);
    expect(() => validateEmphasis('==a== $x$ ==b==', 'text')).not.toThrow();
  });

  it('rejects an unpaired delimiter in a prompt', () => {
    expect(
      validateExam({ questions: [{ ...validQuestion('e19-01'), prompt: 'a == b인 경우는?' }] }),
    ).toThrow(/prompt line 1 has an unpaired ==/);
  });

  it('rejects an unpaired delimiter in a choice', () => {
    expect(
      validateExam({
        questions: [
          {
            ...validQuestion('e19-01'),
            choices: [
              { id: '1', text: 'str1==str2' },
              { id: '2', text: '문서 편집' },
            ],
          },
        ],
      }),
    ).toThrow(/choices\[0\]\.text line 1 has an unpaired ==/);
  });

  it('rejects an unpaired delimiter in an explanation line', () => {
    expect(
      validateExam({
        questions: [{ ...validQuestion('e19-01'), explanation: '첫 줄\n조건 i==3이 거짓이다.' }],
      }),
    ).toThrow(/explanation line 2 has an unpaired ==/);
  });

  it('rejects an unpaired delimiter in a text passage but not in a code passage', () => {
    expect(validateWithPassage({ type: 'text', body: 'until m == mOld' })).toThrow(
      /body line 1 has an unpaired ==/,
    );
    expect(validateWithPassage({ type: 'code', body: 'until m == mOld' })).not.toThrow();
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
