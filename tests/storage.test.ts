import { beforeEach, describe, expect, it, vi } from 'vitest';

import { isBookmarked, loadBookmarks, loadWrongAnswers, recordWrongAnswer, toggleBookmark } from '../src/lib/storage';

describe('bookmark storage', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', createMemoryStorage());
  });

  it('toggles bookmarks under pt.bookmarks', () => {
    expect(toggleBookmark('operating-systems:past-exams-2019:e19-01')).toBe(true);
    expect(isBookmarked('operating-systems:past-exams-2019:e19-01')).toBe(true);
    expect(loadBookmarks()).toEqual(['operating-systems:past-exams-2019:e19-01']);

    expect(toggleBookmark('operating-systems:past-exams-2019:e19-01')).toBe(false);
    expect(loadBookmarks()).toEqual([]);
  });

  it('records wrong answer counts under pt.wrongAnswers', () => {
    const key = 'operating-systems:past-exams-2019:e19-01';

    recordWrongAnswer(key, new Date('2026-05-06T00:00:00.000Z'));
    recordWrongAnswer(key, new Date('2026-05-06T00:01:00.000Z'));

    expect(loadWrongAnswers()[key]).toEqual({
      wrongCount: 2,
      lastWrongAt: '2026-05-06T00:01:00.000Z',
    });
  });
});

function createMemoryStorage(): Storage {
  const values = new Map<string, string>();

  return {
    get length() {
      return values.size;
    },
    clear() {
      values.clear();
    },
    getItem(key: string) {
      return values.get(key) ?? null;
    },
    key(index: number) {
      return Array.from(values.keys())[index] ?? null;
    },
    removeItem(key: string) {
      values.delete(key);
    },
    setItem(key: string, value: string) {
      values.set(key, value);
    },
  };
}
