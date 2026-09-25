import { describe, expect, it } from 'vitest';

import { getDefaultSemester } from '../src/pages/shared';

describe('getDefaultSemester', () => {
  it('picks the 1st semester from February through July', () => {
    expect(getDefaultSemester(new Date(2026, 1, 1))).toBe(1);
    expect(getDefaultSemester(new Date(2026, 6, 31))).toBe(1);
  });

  it('picks the 2nd semester from August through January', () => {
    expect(getDefaultSemester(new Date(2026, 7, 1))).toBe(2);
    expect(getDefaultSemester(new Date(2026, 11, 31))).toBe(2);
    expect(getDefaultSemester(new Date(2027, 0, 31))).toBe(2);
  });
});
