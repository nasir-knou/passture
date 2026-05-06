import {
  createBackupFilename,
  createUserDataExport,
  importUserData,
  type ImportMode,
} from '../lib/backup';

export function renderBackupPage(): HTMLElement {
  const page = document.createElement('main');
  page.className = 'app-shell';
  page.innerHTML = `
    <nav class="top-nav" aria-label="주요 메뉴">
      <a href="#/">홈</a>
      <a href="#/bookmarks">북마크</a>
      <a href="#/select">문제 선택</a>
    </nav>
    <section class="page-header">
      <p class="eyebrow">backup</p>
      <h1>백업 / 복원</h1>
      <p class="lead">북마크와 오답 기록을 JSON 파일로 내보내고 가져옵니다.</p>
    </section>
    <section class="stack">
      <article class="panel">
        <h2>내보내기</h2>
        <p class="muted">현재 브라우저의 사용자 데이터를 JSON 파일로 저장합니다.</p>
        <div class="action-row">
          <button class="primary-button" type="button" data-export>내보내기</button>
        </div>
      </article>
      <article class="panel">
        <h2>가져오기</h2>
        <input class="file-input" type="file" accept="application/json,.json" data-import-file />
        <div class="action-row">
          <button class="secondary-button" type="button" data-import="merge">병합</button>
          <button class="secondary-button" type="button" data-import="overwrite">덮어쓰기</button>
        </div>
        <p class="form-message" data-backup-message></p>
      </article>
    </section>
  `;

  page.querySelector<HTMLButtonElement>('[data-export]')?.addEventListener('click', () => {
    downloadJson();
  });

  page.querySelectorAll<HTMLButtonElement>('[data-import]').forEach((button) => {
    button.addEventListener('click', () => {
      const mode = button.dataset.import as ImportMode;
      void importSelectedFile(page, mode);
    });
  });

  return page;
}

function downloadJson(): void {
  const data = createUserDataExport();
  const blob = new Blob([`${JSON.stringify(data, null, 2)}\n`], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = createBackupFilename();
  link.click();
  URL.revokeObjectURL(url);
}

async function importSelectedFile(page: HTMLElement, mode: ImportMode): Promise<void> {
  const message = page.querySelector<HTMLElement>('[data-backup-message]');
  const input = page.querySelector<HTMLInputElement>('[data-import-file]');
  const file = input?.files?.[0];

  if (!file) {
    setMessage(message, '가져올 JSON 파일을 선택해 주세요.');
    return;
  }

  try {
    const text = await file.text();
    importUserData(JSON.parse(text), mode);
    setMessage(message, mode === 'merge' ? '백업을 병합했습니다.' : '백업으로 덮어썼습니다.');
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '가져오기에 실패했습니다.';
    setMessage(message, errorMessage);
  }
}

function setMessage(element: HTMLElement | null, message: string): void {
  if (element) {
    element.textContent = message;
  }
}
