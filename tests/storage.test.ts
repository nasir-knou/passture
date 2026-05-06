import { beforeEach, describe, expect, it, vi } from 'vitest';

import { isBookmarked, loadBookmarks, toggleBookmark } from '../src/lib/storage';

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
