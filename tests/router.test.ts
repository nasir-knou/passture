import { describe, expect, it } from 'vitest';

import { normalizeRoute } from '../src/router';

describe('normalizeRoute', () => {
  it('uses home for empty hashes', () => {
    expect(normalizeRoute('')).toBe('/');
    expect(normalizeRoute('#')).toBe('/');
  });

  it('strips query strings and trailing slashes', () => {
    expect(normalizeRoute('#/select?subject=operating-systems')).toBe('/select');
    expect(normalizeRoute('#/quiz/')).toBe('/quiz');
  });
});
