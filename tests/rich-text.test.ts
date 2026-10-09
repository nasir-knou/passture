import { describe, expect, it } from 'vitest';

import { renderMathText } from '../src/pages/rich-text';

const mark = (text: string) => `<mark class="text-highlight">${text}</mark>`;

describe('renderMathText highlight pairing', () => {
  it('pairs == markers within a single line', () => {
    expect(renderMathText('a ==b== c ==d==')).toBe(`a ${mark('b')} c ${mark('d')}`);
  });

  it('does not pair == markers across lines', () => {
    expect(renderMathText('a ==b\nc== d')).toBe('a ==b<br />c== d');
  });

  it('pairs each line independently and leaves an odd marker literal', () => {
    expect(renderMathText('==x== ==y\n==z==')).toBe(`${mark('x')} ==y<br />${mark('z')}`);
  });

  it('escapes HTML inside and outside highlights', () => {
    expect(renderMathText('<i> ==<b>==')).toBe(`&lt;i&gt; ${mark('&lt;b&gt;')}`);
  });

  it('renders an empty pair as an empty mark', () => {
    expect(renderMathText('a ==== b')).toBe(`a ${mark('')} b`);
  });
});

describe('renderMathText precedence', () => {
  it('gives inline code precedence over math and highlight', () => {
    expect(renderMathText('`$a$ ==b==`')).toBe('<code class="inline-code">$a$ ==b==</code>');
  });

  it('keeps line breaks inside inline code as <br />', () => {
    expect(renderMathText('`a\nb`')).toBe('<code class="inline-code">a<br />b</code>');
  });

  it('gives math precedence over highlight', () => {
    const html = renderMathText('$a == b$ ==c==');

    expect(html).toContain('katex');
    expect(html.endsWith(` ${mark('c')}`)).toBe(true);
    expect(html.match(/text-highlight/g)).toHaveLength(1);
  });

  it('does not pair highlight markers across a math span', () => {
    const html = renderMathText('==a $x$ b==');

    expect(html).toContain('katex');
    expect(html).not.toContain('text-highlight');
    expect(html.startsWith('==a ')).toBe(true);
    expect(html.endsWith(' b==')).toBe(true);
  });

  it('does not pair highlight markers across inline code', () => {
    expect(renderMathText('==a `c` b==')).toBe('==a <code class="inline-code">c</code> b==');
  });

  it('renders display math between $$ markers', () => {
    expect(renderMathText('$$x^2$$')).toContain('katex-display');
  });
});
