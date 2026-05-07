import type { SourceKind } from '../types/catalog';

interface NavItem {
  href: string;
  label: string;
  id: string;
}

const defaultNavItems: NavItem[] = [
  { href: '#/select', label: '문제 선택', id: 'select' },
  { href: '#/mock-exam', label: '모의 시험', id: 'mock-exam' },
  { href: '#/history', label: '학습 기록', id: 'history' },
  { href: '#/backup', label: '데이터 관리', id: 'backup' },
];

export function sourceKindLabel(kind: SourceKind): string {
  switch (kind) {
    case 'exam':
      return '기출';
    case 'textbook':
      return '교재';
    case 'workbook':
      return '워크북';
    case 'lecture':
      return '강의';
  }
}

export function renderTopNav(
  activeId: string,
  items: readonly NavItem[] = defaultNavItems,
): string {
  return `
    <nav class="top-nav" aria-label="주요 메뉴">
      <a class="nav-brand ${activeId === 'home' ? 'is-active' : ''}" href="#/" aria-label="PASSture 홈">
        <span aria-hidden="true">🐑</span><span class="brand-mark">PASS</span><span>ture</span>
      </a>
      <div class="nav-menu">
        ${items
          .map(
            (item) => `
              <a
                class="nav-link ${activeId === item.id ? 'is-active' : ''}"
                href="${item.href}"
                ${activeId === item.id ? 'aria-current="page"' : ''}
              >
                ${item.label}
              </a>
            `,
          )
          .join('')}
      </div>
    </nav>
  `;
}

export function renderFooter(): string {
  return `
    <footer class="site-footer">
      <p>모든 기출·교재·강의 관련 권리는 한국방송통신대학교 및 한국방송통신대학교 출판문화원에 있습니다.</p>
      <p>Passture는 비영리 학습 목적의 문제풀이 도구이며, 권리자 요청 시 관련 자료를 삭제합니다.</p>
      <p>Contact: nasir17.dev@gmail.com</p>
      <p>Code MIT License.</p>
    </footer>
  `;
}

export function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}
