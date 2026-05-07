import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  createBackupFilename,
  createUserDataExport,
  importUserData,
  validateUserDataExport,
} from '../src/lib/backup';

describe('backup', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', createMemoryStorage());
  });

  it('exports stored bookmarks', () => {
    localStorage.setItem(
      'pt.bookmarks',
      JSON.stringify(['operating-systems:past-exams-2019:e19-01']),
    );

    expect(createUserDataExport(new Date('2026-05-06T00:00:00.000Z'))).toMatchObject({
      app: 'passture',
      version: 1,
      exportedAt: '2026-05-06T00:00:00.000Z',
      bookmarks: ['operating-systems:past-exams-2019:e19-01'],
    });
  });

  it('creates filenames with date and time', () => {
    expect(createBackupFilename(new Date('2026-05-06T01:02:03.000Z'))).toBe(
      'passture-user-data-20260506-010203.json',
    );
  });

  it('merges imported bookmarks without duplicates', () => {
    localStorage.setItem(
      'pt.bookmarks',
      JSON.stringify(['operating-systems:past-exams-2019:e19-01']),
    );

    importUserData(
      validBackup({
        bookmarks: [
          'operating-systems:past-exams-2019:e19-01',
          'operating-systems:past-exams-2019:e19-02',
        ],
      }),
      'merge',
    );

    expect(JSON.parse(localStorage.getItem('pt.bookmarks') ?? '[]')).toEqual([
      'operating-systems:past-exams-2019:e19-01',
      'operating-systems:past-exams-2019:e19-02',
    ]);
  });

  it('rejects invalid imports', () => {
    expect(() => validateUserDataExport({ app: 'other' })).toThrow(/passture/);
    expect(localStorage.getItem('pt.bookmarks')).toBeNull();
  });
});

function validBackup(overrides: Record<string, unknown> = {}) {
  return {
    app: 'passture',
    version: 1,
    exportedAt: '2026-05-06T00:00:00.000Z',
    bookmarks: [],
    wrongAnswers: {},
    ...overrides,
  };
}

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
