import { escapeHtml } from './pages/shared';

export type RouteRenderer = () => HTMLElement | Promise<HTMLElement>;

export type Routes = Record<string, RouteRenderer>;

export interface Router {
  start: () => void;
  stop: () => void;
}

export function createRouter(root: HTMLElement, routes: Routes): Router {
  let active = true;
  let currentRoute: string | undefined;
  // 렌더마다 번호를 매겨, 늦게 끝난 이전 렌더가 더 최근 화면을 덮어쓰지 않게 한다.
  let renderSequence = 0;

  const render = async () => {
    const sequence = ++renderSequence;
    const isCurrent = () => active && sequence === renderSequence;
    root.replaceChildren(renderLoading());

    try {
      const route = normalizeRoute(window.location.hash);
      const renderer = routes[route] ?? routes['/'];
      const page = await renderer();

      if (isCurrent()) {
        root.replaceChildren(page);
        if (shouldResetPageScroll(route, currentRoute)) {
          resetPageScroll();
        }
        currentRoute = route;
      }
    } catch (error) {
      if (isCurrent()) {
        root.replaceChildren(renderError(error));
      }
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

export function shouldResetPageScroll(route: string, previousRoute: string | undefined): boolean {
  return route === '/select' && previousRoute !== '/select';
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
