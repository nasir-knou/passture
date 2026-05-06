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

export function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}
