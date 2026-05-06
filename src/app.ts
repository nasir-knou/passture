import { loadCatalog } from './lib/data-loader';
import { createRouter } from './router';
import { renderBackupPage } from './pages/backup';
import { renderBookmarksPage } from './pages/bookmarks';
import { renderHomePage } from './pages/home';
import { renderQuizPage } from './pages/quiz';
import { renderResultPage } from './pages/result';
import { renderSelectPage } from './pages/select';

export function startApp(root: HTMLElement): void {
  const router = createRouter(root, {
    '/': async () => renderHomePage(await loadCatalog()),
    '/select': async () => renderSelectPage(await loadCatalog()),
    '/quiz': async () => renderQuizPage(await loadCatalog()),
    '/result': async () => renderResultPage(),
    '/bookmarks': async () => renderBookmarksPage(),
    '/backup': async () => renderBackupPage(),
  });

  router.start();
}
