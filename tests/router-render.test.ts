// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createRouter, type Router } from '../src/router';

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function pageWith(text: string): HTMLElement {
  const element = document.createElement('main');
  element.textContent = text;
  return element;
}

async function navigate(hash: string): Promise<void> {
  window.location.hash = hash;
  window.dispatchEvent(new HashChangeEvent('hashchange'));
  await Promise.resolve();
}

describe('createRouter rendering', () => {
  let root: HTMLElement;
  let router: Router | undefined;

  beforeEach(() => {
    window.history.replaceState(null, '', '/');
    root = document.createElement('div');
    document.body.append(root);
    vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined);
  });

  afterEach(() => {
    router?.stop();
    router = undefined;
    root.remove();
  });

  it('discards a stale render that finishes after a newer navigation', async () => {
    const slowHome = deferred<HTMLElement>();
    const routes = {
      '/': vi.fn(() => slowHome.promise),
      '/quiz': vi.fn(async () => pageWith('quiz page')),
    };
    router = createRouter(root, routes);

    router.start();
    expect(root.textContent).toContain('불러오는 중');

    await navigate('#/quiz');
    await vi.waitFor(() => expect(root.textContent).toBe('quiz page'));

    slowHome.resolve(pageWith('stale home'));
    await slowHome.promise;
    await Promise.resolve();

    expect(root.textContent).toBe('quiz page');
    expect(routes['/']).toHaveBeenCalled();
  });

  it('discards a stale error from an earlier render', async () => {
    const slowHome = deferred<HTMLElement>();
    router = createRouter(root, {
      '/': () => slowHome.promise,
      '/quiz': async () => pageWith('quiz page'),
    });

    router.start();
    await navigate('#/quiz');
    await vi.waitFor(() => expect(root.textContent).toBe('quiz page'));

    slowHome.reject(new Error('late failure'));
    await slowHome.promise.catch(() => undefined);
    await Promise.resolve();

    expect(root.textContent).toBe('quiz page');
  });

  it('renders an escaped error page for the current route', async () => {
    router = createRouter(root, {
      '/': async () => {
        throw new Error('<b>catalog</b> 실패');
      },
    });

    router.start();

    await vi.waitFor(() =>
      expect(root.querySelector('h1')?.textContent).toBe('페이지를 불러오지 못했습니다'),
    );
    expect(root.querySelector('.lead')?.innerHTML).toBe('&lt;b&gt;catalog&lt;/b&gt; 실패');
  });

  it('falls back to the home route for unknown paths', async () => {
    window.location.hash = '#/does-not-exist';
    router = createRouter(root, { '/': async () => pageWith('home') });

    router.start();

    await vi.waitFor(() => expect(root.textContent).toBe('home'));
  });

  it('ignores renders that finish after stop()', async () => {
    const slowHome = deferred<HTMLElement>();
    router = createRouter(root, { '/': () => slowHome.promise });

    router.start();
    router.stop();
    slowHome.resolve(pageWith('late'));
    await slowHome.promise;
    await Promise.resolve();

    expect(root.textContent).toContain('불러오는 중');
  });

  it('stops listening to hashchange after stop()', async () => {
    const quiz = vi.fn(async () => pageWith('quiz'));
    router = createRouter(root, { '/': async () => pageWith('home'), '/quiz': quiz });

    router.start();
    await vi.waitFor(() => expect(root.textContent).toBe('home'));
    router.stop();
    await navigate('#/quiz');

    expect(quiz).not.toHaveBeenCalled();
  });
});
