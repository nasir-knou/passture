import { describe, expect, it } from 'vitest';

import { isCorrectAnswer } from '../src/lib/scorer';

describe('isCorrectAnswer', () => {
  it('scores single-answer questions', () => {
    expect(isCorrectAnswer(['1'], ['1'])).toBe(true);
    expect(isCorrectAnswer(['2'], ['1'])).toBe(false);
  });

  it('scores multi-answer questions regardless of selection order', () => {
    expect(isCorrectAnswer(['3', '1'], ['1', '3'])).toBe(true);
    expect(isCorrectAnswer(['1'], ['1', '3'])).toBe(false);
  });
});
