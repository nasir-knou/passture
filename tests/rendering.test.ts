import { describe, expect, it } from 'vitest';

import { renderRichText } from '../src/pages/rendering';

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
