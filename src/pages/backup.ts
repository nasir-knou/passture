import {
  createBackupFilename,
  createUserDataExport,
  importUserData,
  type ImportMode,
} from '../lib/backup';
import { clearPracticeState } from '../lib/quiz-session';
import { clearUserData } from '../lib/storage';
import { renderFooter, renderTopNav } from './shared';

export function renderBackupPage(): HTMLElement {
  const page = document.createElement('main');
  page.className = 'app-shell';
  page.innerHTML = `
    ${renderTopNav('backup')}
    <section class="page-header backup-header">
      <p class="eyebrow">data</p>
      <h1>데이터 관리</h1>
      <p class="lead backup-lead">Passture는 별도의 서버/데이터베이스를 사용하지 않고 데이터를 로컬 브라우저에만 저장합니다.</p>
      <p class="lead backup-lead">북마크와 오답 기록을 백업·복원하고, 현재 풀이 상태나 학습 기록을 초기화합니다.</p>
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
      <article class="panel">
        <h2>초기화</h2>
        <p class="muted">현재 풀이 세션만 지우거나, 브라우저에 저장된 북마크와 오답 기록을 모두 지웁니다.</p>
        <div class="action-row">
          <button class="secondary-button" type="button" data-reset-practice>현재 풀이 초기화</button>
          <button class="secondary-button danger-button" type="button" data-reset-user-data>
            학습 기록 초기화
          </button>
        </div>
        <p class="form-message" data-reset-message></p>
      </article>
    </section>
    ${renderFooter()}
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

  page.querySelector<HTMLButtonElement>('[data-reset-practice]')?.addEventListener('click', () => {
    if (!window.confirm('현재 풀이 세션과 선택 옵션을 초기화할까요?')) {
      return;
    }

    clearPracticeState();
    setMessage(
      page.querySelector<HTMLElement>('[data-reset-message]'),
      '현재 풀이를 초기화했습니다.',
    );
  });

  page.querySelector<HTMLButtonElement>('[data-reset-user-data]')?.addEventListener('click', () => {
    if (!window.confirm('북마크와 오답 기록을 모두 초기화할까요? 이 작업은 되돌릴 수 없습니다.')) {
      return;
    }

    clearUserData();
    clearPracticeState();
    setMessage(
      page.querySelector<HTMLElement>('[data-reset-message]'),
      '북마크와 오답 기록을 초기화했습니다.',
    );
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
