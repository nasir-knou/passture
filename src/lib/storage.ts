const bookmarksKey = 'pt.bookmarks';
const wrongAnswersKey = 'pt.wrongAnswers';

export interface WrongAnswerRecord {
  wrongCount: number;
  lastWrongAt: string;
}

export function loadBookmarks(): string[] {
  return readStringArray(bookmarksKey);
}

export function saveBookmarks(bookmarks: readonly string[]): void {
  localStorage.setItem(bookmarksKey, JSON.stringify([...new Set(bookmarks)].sort()));
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

export function saveWrongAnswers(wrongAnswers: Record<string, WrongAnswerRecord>): void {
  localStorage.setItem(wrongAnswersKey, JSON.stringify(wrongAnswers));
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
