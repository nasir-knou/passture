import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  loadBookmarks,
  loadWrongAnswers,
  pruneUserData,
  saveBookmarks,
  saveWrongAnswers,
} from '../src/lib/storage';
import { createMemoryStorage } from './helpers';

let storage: ReturnType<typeof createMemoryStorage>;

beforeEach(() => {
  storage = createMemoryStorage();
  vi.stubGlobal('localStorage', storage);
});

const record = { wrongCount: 1, lastWrongAt: '2026-01-01T00:00:00.000Z' };

describe('pruneUserData', () => {
  it('removes bookmarks and wrong answers whose keys no longer exist', () => {
    saveBookmarks(['os:a:1', 'os:a:gone', 'ds:b:2']);
    saveWrongAnswers({ 'os:a:1': record, 'os:removed:9': record, 'ds:b:gone': record });

    const removed = pruneUserData(new Set(['os:a:1', 'ds:b:2']));

    expect(removed).toEqual({ bookmarks: 1, wrongAnswers: 2 });
    expect(loadBookmarks()).toEqual(['ds:b:2', 'os:a:1']);
    expect(loadWrongAnswers()).toEqual({ 'os:a:1': record });
  });

  it('does not write to storage when nothing needs pruning', () => {
    saveBookmarks(['os:a:1']);
    saveWrongAnswers({ 'os:a:1': record });
    const setItem = vi.spyOn(storage, 'setItem');

    expect(pruneUserData(new Set(['os:a:1', 'other']))).toEqual({ bookmarks: 0, wrongAnswers: 0 });
    expect(setItem).not.toHaveBeenCalled();
  });

  it('only rewrites the store that changed', () => {
    saveBookmarks(['os:a:1']);
    saveWrongAnswers({ 'os:a:1': record, 'os:a:2': record });
    const setItem = vi.spyOn(storage, 'setItem');

    pruneUserData(new Set(['os:a:1']));

    expect(setItem.mock.calls.map(([key]) => key)).toEqual(['pt.wrongAnswers']);
  });

  it('clears everything when no key is valid and tolerates corrupt stored data', () => {
    storage.setItem('pt.bookmarks', '{broken');
    saveWrongAnswers({ 'os:a:1': record });

    expect(pruneUserData(new Set())).toEqual({ bookmarks: 0, wrongAnswers: 1 });
    expect(loadWrongAnswers()).toEqual({});
  });
});
