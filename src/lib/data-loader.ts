import type { Catalog } from '../types/catalog';
import type { QuestionFile } from '../types/question';

const catalogPath = 'data/catalog.json';
const questionFileCache = new Map<string, Promise<QuestionFile>>();
let catalogCache: Promise<Catalog> | undefined;

export function loadCatalog(): Promise<Catalog> {
  catalogCache ??= fetchJson<Catalog>(catalogPath);
  return catalogCache;
}

export function loadQuestionFile(path: string): Promise<QuestionFile> {
  const cached = questionFileCache.get(path);

  if (cached) {
    return cached;
  }

  const request = fetchJson<QuestionFile>(`data/${path}`);
  questionFileCache.set(path, request);
  return request;
}

function fetchJson<T>(relativePath: string): Promise<T> {
  const url = new URL(relativePath, getBaseUrl()).toString();

  return fetch(url).then((response) => {
    if (!response.ok) {
      throw new Error(`${relativePath} 요청 실패 (${response.status})`);
    }

    return response.json() as Promise<T>;
  });
}

function getBaseUrl(): string {
  return new URL(import.meta.env.BASE_URL, window.location.origin).toString();
}
