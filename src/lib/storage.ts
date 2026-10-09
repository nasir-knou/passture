import { safeSetItem } from './safe-storage';

const bookmarksKey = 'pt.bookmarks';
const wrongAnswersKey = 'pt.wrongAnswers';

export interface WrongAnswerRecord {
  wrongCount: number;
  lastWrongAt: string;
}

export function loadBookmarks(): string[] {
  return readStringArray(bookmarksKey);
}

export function saveBookmarks(bookmarks: readonly string[]): boolean {
  return safeSetItem(
    localStorage,
    bookmarksKey,
    JSON.stringify([...new Set(bookmarks)].sort()),
    '북마크',
  );
}

export function isBookmarked(key: string): boolean {
  return loadBookmarks().includes(key);
}

export function toggleBookmark(key: string): boolean {
  const bookmarks = new Set(loadBookmarks());

  if (bookmarks.has(key)) {
    bookmarks.delete(key);
    saveBookmarks([...bookmarks]);
    return false;
  }

  bookmarks.add(key);
  saveBookmarks([...bookmarks]);
  return true;
}

export function removeBookmark(key: string): void {
  saveBookmarks(loadBookmarks().filter((bookmark) => bookmark !== key));
}

export function loadWrongAnswers(): Record<string, WrongAnswerRecord> {
  const raw = localStorage.getItem(wrongAnswersKey);
  if (!raw) {
    return {};
  }

  try {
    const parsed = JSON.parse(raw) as Record<string, WrongAnswerRecord>;
    return typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

export function saveWrongAnswers(wrongAnswers: Record<string, WrongAnswerRecord>): boolean {
  return safeSetItem(localStorage, wrongAnswersKey, JSON.stringify(wrongAnswers), '오답 기록');
}

export function recordWrongAnswer(key: string, now = new Date()): void {
  const wrongAnswers = loadWrongAnswers();
  const previous = wrongAnswers[key];

  wrongAnswers[key] = {
    wrongCount: (previous?.wrongCount ?? 0) + 1,
    lastWrongAt: now.toISOString(),
  };

  saveWrongAnswers(wrongAnswers);
}

/**
 * 더 이상 존재하지 않는 문제 키를 북마크·오답 기록에서 지운다.
 * validKeys는 카탈로그의 모든 문제 파일을 성공적으로 불러온 뒤 만든 전체 키 집합이어야 한다.
 */
export function pruneUserData(validKeys: ReadonlySet<string>): {
  bookmarks: number;
  wrongAnswers: number;
} {
  const bookmarks = loadBookmarks();
  const keptBookmarks = bookmarks.filter((key) => validKeys.has(key));
  const wrongAnswers = loadWrongAnswers();
  const keptWrongAnswers = Object.fromEntries(
    Object.entries(wrongAnswers).filter(([key]) => validKeys.has(key)),
  );
  const removedBookmarks = bookmarks.length - keptBookmarks.length;
  const removedWrongAnswers =
    Object.keys(wrongAnswers).length - Object.keys(keptWrongAnswers).length;

  if (removedBookmarks > 0) {
    saveBookmarks(keptBookmarks);
  }

  if (removedWrongAnswers > 0) {
    saveWrongAnswers(keptWrongAnswers);
  }

  return { bookmarks: removedBookmarks, wrongAnswers: removedWrongAnswers };
}

export function clearUserData(): void {
  localStorage.removeItem(bookmarksKey);
  localStorage.removeItem(wrongAnswersKey);
}

function readStringArray(key: string): string[] {
  const raw = localStorage.getItem(key);
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === 'string')
      : [];
  } catch {
    return [];
  }
}
