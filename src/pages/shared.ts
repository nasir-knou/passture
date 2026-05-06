import type { SourceKind } from '../types/catalog';

export function sourceKindLabel(kind: SourceKind): string {
  switch (kind) {
    case 'exam':
      return '기출';
    case 'workbook':
      return '교재';
    case 'lecture':
      return '강의';
  }
}

export function renderFooter(): string {
  return `
    <footer class="site-footer">
      <p>비영리 학습 목적의 문제풀이 도구입니다. 기출·교재 관련 권리는 각 권리자에게 있으며, 권리자 요청 시 관련 자료를 삭제합니다.</p>
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
