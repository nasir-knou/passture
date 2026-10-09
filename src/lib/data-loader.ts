import type { Catalog } from '../types/catalog';
import type { QuestionFile } from '../types/question';
import type { Syllabus } from '../types/syllabus';

const catalogPath = 'data/catalog.json';
const questionFileCache = new Map<string, Promise<QuestionFile>>();
const syllabusCache = new Map<string, Promise<Syllabus>>();
let catalogCache: Promise<Catalog> | undefined;

export function loadCatalog(): Promise<Catalog> {
  if (import.meta.env.DEV) {
    return fetchYaml<Catalog>('data/catalog.yaml');
  }

  if (!catalogCache) {
    const request = fetchJson<Catalog>(catalogPath);
    catalogCache = request;
    // 일시적인 실패가 캐시에 남지 않도록 실패한 요청은 지워 다음 호출에서 다시 시도한다.
    request.catch(() => {
      if (catalogCache === request) {
        catalogCache = undefined;
      }
    });
  }

  return catalogCache;
}

export function loadQuestionFile(path: string): Promise<QuestionFile> {
  if (import.meta.env.DEV) {
    return fetchYaml<QuestionFile>(toYamlPath(path));
  }

  return cachedFetchJson(questionFileCache, path);
}

export function loadSyllabus(path: string): Promise<Syllabus> {
  if (import.meta.env.DEV) {
    return fetchYaml<Syllabus>(toYamlPath(path));
  }

  return cachedFetchJson(syllabusCache, path);
}

function cachedFetchJson<T>(cache: Map<string, Promise<T>>, path: string): Promise<T> {
  const cached = cache.get(path);

  if (cached) {
    return cached;
  }

  const request = fetchJson<T>(`data/${path}`);
  cache.set(path, request);
  // 일시적인 실패가 캐시에 남지 않도록 실패한 요청은 지워 다음 호출에서 다시 시도한다.
  request.catch(() => {
    if (cache.get(path) === request) {
      cache.delete(path);
    }
  });
  return request;
}

function toYamlPath(path: string): string {
  return `data/${path.replace(/\.json$/, '.yaml')}`;
}

async function fetchJson<T>(relativePath: string): Promise<T> {
  const url = new URL(relativePath, getBaseUrl()).toString();
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`${relativePath} 요청 실패 (${response.status})`);
  }

  const text = await response.text();
  const contentType = response.headers.get('content-type') ?? '';

  if (!contentType.includes('application/json') && text.trimStart().startsWith('<')) {
    throw new Error(`${relativePath} 대신 HTML을 받았습니다.`);
  }

  return JSON.parse(text) as T;
}

// 개발 서버에서는 빌드 없이 YAML 원본을 바로 읽는다. js-yaml은 이 분기 안에서만
// 동적으로 불러오므로 프로덕션 번들에서는 제외된다.
async function fetchYaml<T>(relativePath: string): Promise<T> {
  if (!import.meta.env.DEV) {
    throw new Error(`${relativePath}: YAML 원본은 개발 서버에서만 읽을 수 있습니다.`);
  }

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
