import type { Catalog } from '../types/catalog';
import type { QuestionFile } from '../types/question';

const catalogPath = 'data/catalog.json';
const questionFileCache = new Map<string, Promise<QuestionFile>>();
let catalogCache: Promise<Catalog> | undefined;

export function loadCatalog(): Promise<Catalog> {
  if (import.meta.env.DEV) {
    return fetchYaml<Catalog>('data/catalog.yaml');
  }

  catalogCache ??= fetchJson<Catalog>(catalogPath).catch((error: unknown) => {
    if (isHtmlFallbackError(error) && import.meta.env.DEV) {
      return fetchYaml<Catalog>('data/catalog.yaml');
    }

    throw error;
  });
  return catalogCache;
}

export function loadQuestionFile(path: string): Promise<QuestionFile> {
  if (import.meta.env.DEV) {
    return fetchYaml<QuestionFile>(`data/${path.replace(/\.json$/, '.yaml')}`);
  }

  const cached = questionFileCache.get(path);

  if (cached) {
    return cached;
  }

  const request = fetchJson<QuestionFile>(`data/${path}`).catch((error: unknown) => {
    if (isHtmlFallbackError(error) && import.meta.env.DEV) {
      return fetchYaml<QuestionFile>(`data/${path.replace(/\.json$/, '.yaml')}`);
    }

    throw error;
  });
  questionFileCache.set(path, request);
  return request;
}

function fetchJson<T>(relativePath: string): Promise<T> {
  const url = new URL(relativePath, getBaseUrl()).toString();

  return fetch(url, { cache: import.meta.env.DEV ? 'no-store' : 'default' }).then(async (response) => {
    if (!response.ok) {
      throw new Error(`${relativePath} 요청 실패 (${response.status})`);
    }

    const text = await response.text();
    const contentType = response.headers.get('content-type') ?? '';

    if (!contentType.includes('application/json') && text.trimStart().startsWith('<')) {
      throw new HtmlFallbackError(relativePath);
    }

    return JSON.parse(text) as T;
  });
}

async function fetchYaml<T>(relativePath: string): Promise<T> {
  const yaml = await import('js-yaml');
  const url = new URL(relativePath, getBaseUrl()).toString();
  const response = await fetch(url, { cache: 'no-store' });

  if (!response.ok) {
    throw new Error(`${relativePath} 요청 실패 (${response.status})`);
  }

  return yaml.load(await response.text()) as T;
}

function getBaseUrl(): string {
  return new URL(import.meta.env.BASE_URL, window.location.origin).toString();
}

class HtmlFallbackError extends Error {
  constructor(relativePath: string) {
    super(`${relativePath} 대신 HTML을 받았습니다.`);
  }
}

function isHtmlFallbackError(error: unknown): error is HtmlFallbackError {
  return error instanceof HtmlFallbackError;
}
