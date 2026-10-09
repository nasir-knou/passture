// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest';

type DataLoader = typeof import('../src/lib/data-loader');

let loader: DataLoader;

beforeEach(async () => {
  // 캐시가 모듈 상태이므로 테스트마다 새로 불러온다.
  vi.resetModules();
  vi.stubEnv('DEV', false);
  loader = await import('../src/lib/data-loader');
});

function jsonResponse(value: unknown): Response {
  return new Response(JSON.stringify(value), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}

describe('data-loader caching', () => {
  it('does not cache a failed question file request and retries on the next call', async () => {
    const file = { subjectId: 'os', sourceId: 's', title: 'S', kind: 'exam', questions: [] };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response('down', { status: 503 }))
      .mockResolvedValueOnce(jsonResponse(file));
    vi.stubGlobal('fetch', fetchMock);

    await expect(loader.loadQuestionFile('subjects/os/s.json')).rejects.toThrow(
      'data/subjects/os/s.json 요청 실패 (503)',
    );
    await expect(loader.loadQuestionFile('subjects/os/s.json')).resolves.toEqual(file);
    expect(fetchMock).toHaveBeenCalledTimes(2);

    // 성공한 요청은 캐시되어 다시 가져오지 않는다.
    await loader.loadQuestionFile('subjects/os/s.json');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('does not cache a network error for the catalog', async () => {
    const catalog = { version: 1, subjects: [] };
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValueOnce(jsonResponse(catalog));
    vi.stubGlobal('fetch', fetchMock);

    await expect(loader.loadCatalog()).rejects.toThrow('Failed to fetch');
    await expect(loader.loadCatalog()).resolves.toEqual(catalog);
    await loader.loadCatalog();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(String(fetchMock.mock.calls[0]![0])).toMatch(/\/data\/catalog\.json$/);
  });

  it('shares one in-flight request between concurrent callers', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ lectures: [] }));
    vi.stubGlobal('fetch', fetchMock);

    const [first, second] = await Promise.all([
      loader.loadSyllabus('subjects/os/syllabus.json'),
      loader.loadSyllabus('subjects/os/syllabus.json'),
    ]);

    expect(first).toBe(second);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('rejects an HTML fallback page served instead of JSON and retries afterwards', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response('<!doctype html><html></html>', {
          status: 200,
          headers: { 'content-type': 'text/html' },
        }),
      )
      .mockResolvedValueOnce(jsonResponse({ ok: true }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(loader.loadQuestionFile('subjects/os/x.json')).rejects.toThrow(
      '대신 HTML을 받았습니다',
    );
    await expect(loader.loadQuestionFile('subjects/os/x.json')).resolves.toEqual({ ok: true });
  });

  it('reads YAML sources without caching on the dev server', async () => {
    vi.stubEnv('DEV', true);
    const fetchMock = vi
      .fn()
      .mockImplementation(async () => new Response('subjectId: os\nquestions: []\n'));
    vi.stubGlobal('fetch', fetchMock);

    await expect(loader.loadQuestionFile('subjects/os/s.json')).resolves.toEqual({
      subjectId: 'os',
      questions: [],
    });
    await loader.loadQuestionFile('subjects/os/s.json');
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(String(fetchMock.mock.calls[0]![0])).toMatch(/\/data\/subjects\/os\/s\.yaml$/);
  });
});
