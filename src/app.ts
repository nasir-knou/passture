import { loadCatalog } from './lib/data-loader';
import { onStorageFailure } from './lib/safe-storage';
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
  onStorageFailure((message) => showStorageNotice(message));

  const router = createRouter(root, {
    '/': async () => renderHomePage(await loadCatalog()),
    '/select': async () => renderSelectPage(await loadCatalog()),
    '/mock-exam': async () => renderMockExamPage(await loadCatalog()),
    '/mock-exam/test': async () => renderMockExamTestPage(),
    '/mock-exam/result': async () => renderMockExamResultPage(),
    '/quiz': async () => renderQuizPage(await loadCatalog()),
    '/result': async () => renderResultPage(await loadCatalog()),
    '/history': async () => renderHistoryPage(await loadCatalog()),
    '/bookmarks': async () => {
      window.location.hash = '#/history';
      return renderHistoryPage(await loadCatalog());
    },
    '/backup': async () => renderBackupPage(),
  });

  router.start();
}

const storageNoticeDuration = 6000;

/** 저장 실패를 화면 하단에 잠시 띄운다. 같은 알림이 이미 떠 있으면 문구와 시간만 갱신한다. */
function showStorageNotice(message: string): void {
  let notice = document.querySelector<HTMLElement>('[data-storage-notice]');

  if (!notice) {
    notice = document.createElement('div');
    notice.dataset.storageNotice = '';
    notice.setAttribute('role', 'alert');
    Object.assign(notice.style, {
      position: 'fixed',
      left: '50%',
      bottom: '16px',
      transform: 'translateX(-50%)',
      maxWidth: 'calc(100% - 32px)',
      padding: '12px 16px',
      borderRadius: '8px',
      background: '#b42318',
      color: '#ffffff',
      fontSize: '14px',
      lineHeight: '1.5',
      boxShadow: '0 4px 16px rgba(0, 0, 0, 0.2)',
      zIndex: '1000',
    });
    document.body.append(notice);
  }

  notice.textContent = message;
  window.clearTimeout(Number(notice.dataset.timeoutId));
  const target = notice;
  notice.dataset.timeoutId = String(
    window.setTimeout(() => target.remove(), storageNoticeDuration),
  );
}
