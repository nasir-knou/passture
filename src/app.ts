import { loadCatalog } from './lib/data-loader';
import { createRouter } from './router';
import { renderBackupPage } from './pages/backup';
import { renderHistoryPage } from './pages/history';
import { renderHomePage } from './pages/home';
import { renderMockExamPage } from './pages/mock-exam';
import { renderMockExamTestPage } from './pages/mock-exam-test';
import { renderMockExamResultPage } from './pages/mock-exam-result';
import { renderQuizPage } from './pages/quiz';
import { renderResultPage } from './pages/result';
import { renderSelectPage } from './pages/select';

export function startApp(root: HTMLElement): void {
  const router = createRouter(root, {
    '/': async () => renderHomePage(await loadCatalog()),
    '/select': async () => renderSelectPage(await loadCatalog()),
    '/mock-exam': async () => renderMockExamPage(await loadCatalog()),
    '/mock-exam/test': async () => renderMockExamTestPage(),
    '/mock-exam/result': async () => renderMockExamResultPage(),
    '/quiz': async () => renderQuizPage(await loadCatalog()),
    '/result': async () => renderResultPage(),
    '/history': async () => renderHistoryPage(await loadCatalog()),
    '/bookmarks': async () => {
      window.location.hash = '#/history';
      return renderHistoryPage(await loadCatalog());
    },
    '/backup': async () => renderBackupPage(),
  });

  router.start();
}
