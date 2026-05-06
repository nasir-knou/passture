import type { UserDataExport, WrongAnswerRecord } from '../types/user-data';
import { loadBookmarks, loadWrongAnswers, saveBookmarks, saveWrongAnswers } from './storage';

const appName = 'passture';
const version = 1;
const keyPattern = /^[a-z0-9-]+:[a-z0-9-]+:[a-z]\d{2}-\d{2}$/;

export type ImportMode = 'merge' | 'overwrite';

export function createUserDataExport(now = new Date()): UserDataExport {
  return {
    app: appName,
    version,
    exportedAt: now.toISOString(),
    bookmarks: loadBookmarks(),
    wrongAnswers: loadWrongAnswers(),
  };
}

export function createBackupFilename(now = new Date()): string {
  return `passture-user-data-${now.toISOString().slice(0, 10)}.json`;
}

export function importUserData(value: unknown, mode: ImportMode): UserDataExport {
  const incoming = validateUserDataExport(value);

  if (mode === 'overwrite') {
    saveBookmarks(incoming.bookmarks);
    saveWrongAnswers(incoming.wrongAnswers);
    return createUserDataExport();
  }

  saveBookmarks([...loadBookmarks(), ...incoming.bookmarks]);
  saveWrongAnswers(mergeWrongAnswers(loadWrongAnswers(), incoming.wrongAnswers));
  return createUserDataExport();
}

export function validateUserDataExport(value: unknown): UserDataExport {
  const data = expectRecord(value, 'backup');

  if (data.app !== appName) {
    throw new Error('백업 파일의 app 값이 passture가 아닙니다.');
  }

  if (data.version !== version) {
    throw new Error('지원하지 않는 백업 버전입니다.');
  }

  const exportedAt = expectString(data.exportedAt, 'backup.exportedAt');
  const bookmarks = expectStringArray(data.bookmarks, 'backup.bookmarks');
  const wrongAnswers = expectWrongAnswers(data.wrongAnswers);

  for (const bookmark of bookmarks) {
    expectProblemKey(bookmark, 'backup.bookmarks');
  }

  return {
    app: appName,
    version,
    exportedAt,
    bookmarks,
    wrongAnswers,
  };
}

function mergeWrongAnswers(
  current: Record<string, WrongAnswerRecord>,
  incoming: Record<string, WrongAnswerRecord>,
): Record<string, WrongAnswerRecord> {
  const merged = { ...current };

  for (const [key, next] of Object.entries(incoming)) {
    const previous = merged[key];
    if (!previous) {
      merged[key] = next;
      continue;
    }

    merged[key] = {
      wrongCount: Math.max(previous.wrongCount, next.wrongCount),
      lastWrongAt:
        previous.lastWrongAt > next.lastWrongAt ? previous.lastWrongAt : next.lastWrongAt,
    };
  }

  return merged;
}

function expectWrongAnswers(value: unknown): Record<string, WrongAnswerRecord> {
  const records = expectRecord(value, 'backup.wrongAnswers');
  const result: Record<string, WrongAnswerRecord> = {};

  for (const [key, recordValue] of Object.entries(records)) {
    expectProblemKey(key, 'backup.wrongAnswers');
    const record = expectRecord(recordValue, `backup.wrongAnswers.${key}`);
    const wrongCount = record.wrongCount;
    const lastWrongAt = expectString(record.lastWrongAt, `backup.wrongAnswers.${key}.lastWrongAt`);

    if (typeof wrongCount !== 'number' || !Number.isFinite(wrongCount) || wrongCount < 0) {
      throw new Error(`backup.wrongAnswers.${key}.wrongCount 값이 올바르지 않습니다.`);
    }

    result[key] = { wrongCount, lastWrongAt };
  }

  return result;
}

function expectProblemKey(value: string, fieldPath: string): void {
  if (!keyPattern.test(value)) {
    throw new Error(`${fieldPath}에 올바르지 않은 문제 키가 있습니다.`);
  }
}

function expectStringArray(value: unknown, fieldPath: string): string[] {
  if (!Array.isArray(value) || !value.every((item) => typeof item === 'string')) {
    throw new Error(`${fieldPath} 값은 문자열 배열이어야 합니다.`);
  }

  return value;
}

function expectString(value: unknown, fieldPath: string): string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`${fieldPath} 값은 문자열이어야 합니다.`);
  }

  return value;
}

function expectRecord(value: unknown, fieldPath: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error(`${fieldPath} 값은 객체여야 합니다.`);
  }

  return value as Record<string, unknown>;
}
