export type RouteRenderer = () => HTMLElement | Promise<HTMLElement>;

export type Routes = Record<string, RouteRenderer>;

export interface Router {
  start: () => void;
  stop: () => void;
}

export function createRouter(root: HTMLElement, routes: Routes): Router {
  let active = true;

  const render = async () => {
    root.replaceChildren(renderLoading());

    try {
      const route = normalizeRoute(window.location.hash);
      const renderer = routes[route] ?? routes['/'];
      const page = await renderer();

      if (active) {
        root.replaceChildren(page);
        resetPageScroll();
      }
    } catch (error) {
      root.replaceChildren(renderError(error));
      resetPageScroll();
    }
  };

  return {
    start() {
      active = true;
      window.addEventListener('hashchange', render);
      void render();
    },
    stop() {
      active = false;
      window.removeEventListener('hashchange', render);
    },
  };
}

export function normalizeRoute(hash: string): string {
  const withoutHash = hash.startsWith('#') ? hash.slice(1) : hash;
  const withoutQuery = withoutHash.split('?')[0] ?? '';
  const route = withoutQuery || '/';

  if (route === '/') {
    return route;
  }

  return route.endsWith('/') ? route.slice(0, -1) : route;
}

function renderLoading(): HTMLElement {
  const container = document.createElement('main');
  container.className = 'app-shell';
  container.innerHTML = `<p class="muted">불러오는 중...</p>`;
  return container;
}

function renderError(error: unknown): HTMLElement {
  const container = document.createElement('main');
  container.className = 'app-shell';
  const message = error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.';
  container.innerHTML = `
    <section class="page-header">
      <p class="eyebrow">error</p>
      <h1>페이지를 불러오지 못했습니다</h1>
      <p class="lead">${escapeHtml(message)}</p>
    </section>
  `;
  return container;
}

function resetPageScroll(): void {
  window.scrollTo({ left: 0, top: 0, behavior: 'auto' });
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}
