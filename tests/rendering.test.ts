import { describe, expect, it } from 'vitest';

import {
  formatCircledChoiceNumbers,
  renderAnswerExplanationBody,
  renderChoiceContent,
  renderPassages,
  renderRichText,
} from '../src/pages/rendering';
import { parseChoiceExplanation } from '../src/lib/explanation';

describe('rich text rendering', () => {
  it('renders an escaped dollar as a literal dollar sign', () => {
    expect(renderRichText('입력 끝 표시 \\$')).toBe('입력 끝 표시 $');
  });

  it('does not pair escaped dollars into math', () => {
    const html = renderRichText('FOLLOW(A) = {a, \\$} 이고 FOLLOW(B) = {b, \\$} 이다.');

    expect(html).toBe('FOLLOW(A) = {a, $} 이고 FOLLOW(B) = {b, $} 이다.');
    expect(html).not.toContain('katex');
  });

  it('keeps math rendering next to escaped dollars', () => {
    const html = renderRichText('비용 \\$5, 식 $x^2$');

    expect(html.startsWith('비용 $5, 식 ')).toBe(true);
    expect(html).toContain('katex');
  });

  it('leaves an unpaired dollar as text', () => {
    expect(renderRichText('a, b, $')).toBe('a, b, $');
  });
});

describe('inline code', () => {
  it('renders backtick spans as escaped code without math or highlight', () => {
    const html = renderRichText('조건 `if(i==4) $x$ <b>` 와 ==강조==');

    expect(html).toBe(
      '조건 <code class="inline-code">if(i==4) $x$ &lt;b&gt;</code> 와 <mark class="text-highlight">강조</mark>',
    );
  });

  it('keeps math outside code spans', () => {
    const html = renderRichText('`a$b` 와 $x^2$');

    expect(html.startsWith('<code class="inline-code">a$b</code> 와 ')).toBe(true);
    expect(html).toContain('katex');
  });

  it('leaves an unmatched backtick literal', () => {
    expect(renderRichText('`a` 와 `b')).toBe('<code class="inline-code">a</code> 와 `b');
  });
});

describe('choice text', () => {
  it('renders multi-line choices preserving whitespace without a trailing blank line', () => {
    const html = renderChoiceContent({ id: '1', text: 'struct a{\n   int x;\n};\n' });

    expect(html).toContain(
      '<span class="choice-text choice-text-multiline">struct a{<br />   int x;<br />};</span>',
    );
  });

  it('does not treat display math blocks as multi-line code', () => {
    const html = renderChoiceContent({ id: '1', text: '$$\nA=1\n$$\n' });

    expect(html).not.toContain('choice-text-multiline');
    expect(html).not.toContain('<br />');
  });

  it('renders nothing for empty choice text', () => {
    const html = renderChoiceContent({ id: '1', text: '' });

    expect(html).not.toContain('choice-text');
  });

  it('omits the explanation header text for empty choices', () => {
    const html = renderAnswerExplanationBody(
      [
        { id: '1', text: '' },
        { id: '2', text: 'B' },
      ],
      ['1'],
      '선택지 1: 맞다.\n선택지 2: 틀리다.',
    );

    expect(html).toContain('<strong>1번 (정답)</strong>\n');
    expect(html).toContain('<strong>2번 (오답)</strong> B');
  });

  it('shows multi-line choice text in the explanation header as a code block', () => {
    const html = renderAnswerExplanationBody(
      [{ id: '1', text: 'a;\n  b;\n' }],
      ['1'],
      '선택지 1: 맞다.',
    );

    expect(html).toContain(
      '<strong>1번 (정답)</strong><span class="choice-text-multiline">a;<br />  b;</span>',
    );
  });
});

describe('explanation notes', () => {
  const choices = [
    { id: '1', text: 'A' },
    { id: '2', text: 'B' },
  ];

  it('moves ※ lines out of the core concept into a note block', () => {
    const html = renderAnswerExplanationBody(
      choices,
      ['1'],
      '선택지 1: 맞다.\n선택지 2: 틀리다.\n핵심 개념:\n개념 설명.\n※ 원본 표기: X\n※ 둘째 주석',
    );

    const core = html.slice(html.indexOf('핵심 개념'), html.indexOf('explanation-note'));
    expect(core).toContain('개념 설명.');
    expect(core).not.toContain('※');
    expect(html).toContain(
      '<div class="explanation-note"><p>※ 원본 표기: X</p><p>※ 둘째 주석</p></div>',
    );
    expect(html.indexOf('explanation-note')).toBeGreaterThan(html.indexOf('핵심 개념'));
  });

  it('splits ※ lines in explanations without choice lines', () => {
    const html = renderAnswerExplanationBody(choices, ['1'], '자원을 관리한다.\n※ 원본 표기: Y');

    expect(html).toContain('<div>자원을 관리한다.</div>');
    expect(html).toContain('<div class="explanation-note"><p>※ 원본 표기: Y</p></div>');
  });

  it('keeps plain explanations unchanged when there is no ※ line', () => {
    expect(renderAnswerExplanationBody(choices, ['1'], '자원을 관리한다.')).toBe(
      '<div class="explanation-body">자원을 관리한다.</div>',
    );
  });
});

describe('choice explanation parsing', () => {
  it('keeps a reason that starts with a colon under the plain choice id', () => {
    const parsed = parseChoiceExplanation(
      '선택지 1: :는 ex 명령 모드로 들어간다.\n선택지 2: 틀리다.',
    );

    expect([...parsed.choiceReasons.keys()]).toEqual(['1', '2']);
    expect(parsed.choiceReasons.get('1')).toBe(':는 ex 명령 모드로 들어간다.');
  });

  it('parses normal and (정답)/(오답) choice lines', () => {
    const parsed = parseChoiceExplanation(
      '선택지 1 (정답): 맞다.\n선택지 2(오답) : 틀리다.\n선택지 3: a: b 형태.\n핵심 개념:\n개념.',
    );

    expect(Object.fromEntries(parsed.choiceReasons)).toEqual({
      '1': '맞다.',
      '2': '틀리다.',
      '3': 'a: b 형태.',
    });
    expect(parsed.coreLines).toEqual(['개념.']);
  });

  it('renders the reason for a choice whose reason starts with a colon', () => {
    const html = renderAnswerExplanationBody(
      [
        { id: '1', text: 'A' },
        { id: '2', text: 'B' },
      ],
      ['1'],
      '선택지 1: :는 ex 명령이다.\n선택지 2: 틀리다.',
    );

    expect(html).toContain(':는 ex 명령이다.');
  });
});

describe('circled choice numbers', () => {
  it('uses the displayed position of shuffled choices', () => {
    const shuffled = [
      { id: '3', text: 'C' },
      { id: '1', text: 'A' },
      { id: '2', text: 'B' },
    ];

    expect(formatCircledChoiceNumbers(shuffled, ['1'])).toBe('②');
    expect(formatCircledChoiceNumbers(shuffled, ['2', '3'])).toBe('①③');
  });
});

describe('data-table diagram', () => {
  it('renders a real table with a hidden caption instead of role="img"', () => {
    const html = renderPassages([
      {
        id: 'g-table',
        type: 'diagram',
        diagram: { type: 'data-table', columns: ['상태', '\\$'], rows: [['0', 'acc']] },
      },
    ]);
    expect(html).not.toContain('role="img"');
    expect(html).toContain('<caption class="sr-only">표: 상태, $</caption>');
    expect(html).toContain('<th scope="col">');
  });
});

describe('==emphasis==', () => {
  it('pairs delimiters within a line', () => {
    expect(renderRichText('a ==b== c')).toBe('a <mark class="text-highlight">b</mark> c');
  });

  it('never pairs delimiters across a line break', () => {
    expect(renderRichText('a == b\nc == d')).toBe('a == b<br />c == d');
    expect(renderRichText('==x==\n==y')).toBe('<mark class="text-highlight">x</mark><br />==y');
  });
});
