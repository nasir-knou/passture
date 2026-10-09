import type { DataTableDiagram } from '../../types/question';
import { renderMathText } from '../rich-text';
import { escapeHtml } from '../shared';

/**
 * 표는 스크린 리더가 행·열을 탐색할 수 있도록 실제 table로 둔다(role="img" 금지).
 * 표 자체에는 제목 데이터가 없으므로 열 이름으로 시각적으로 숨긴 caption을 만든다.
 */
export function renderDataTableDiagram(diagram: DataTableDiagram, className: string): string {
  const isCodeTable = diagram.cellFormat === 'code';
  const tableClass = isCodeTable ? 'data-table-code' : '';

  return `
    <div class="${className} data-table-diagram">
      <table class="${tableClass}">
        <caption class="sr-only">${escapeHtml(dataTableCaption(diagram))}</caption>
        <thead>
          <tr>
            ${diagram.columns.map((column) => `<th scope="col">${renderMathText(column)}</th>`).join('')}
          </tr>
        </thead>
        <tbody>
          ${diagram.rows
            .map(
              (row) => `
                <tr>
                  ${row.map((cell) => `<td>${renderDataTableCell(cell, isCodeTable)}</td>`).join('')}
                </tr>
              `,
            )
            .join('')}
        </tbody>
      </table>
    </div>
  `;
}

function dataTableCaption(diagram: DataTableDiagram): string {
  const columns = diagram.columns
    .map((column) => column.replaceAll('\\$', '$').trim())
    .filter(Boolean);
  return columns.length > 0 ? `표: ${columns.join(', ')}` : '표';
}

function renderDataTableCell(cell: string, isCodeTable: boolean): string {
  if (!isCodeTable) {
    return renderMathText(cell);
  }

  return `<pre><code>${escapeHtml(cell.trimEnd())}</code></pre>`;
}
