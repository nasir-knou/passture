import { describe, expect, it } from 'vitest';

import { normalizeRoute, shouldResetPageScroll } from '../src/router';

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

describe('shouldResetPageScroll', () => {
  it('resets only when entering the select page from another route', () => {
    expect(shouldResetPageScroll('/select', undefined)).toBe(true);
    expect(shouldResetPageScroll('/select', '/')).toBe(true);
    expect(shouldResetPageScroll('/select', '/select')).toBe(false);
    expect(shouldResetPageScroll('/quiz', '/select')).toBe(false);
  });
});
