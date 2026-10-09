import katex from 'katex';

import { findNextMathToken, splitInlineCode } from '../lib/math-tokens';
import { escapeHtml } from './shared';

/**
 * 문제·보기·해설 공용 텍스트 렌더러.
 * 우선순위: 인라인 코드(`...`) > 수식($...$, $$...$$) > ==강조== > 일반 텍스트.
 */
export function renderMathText(value: string): string {
  return splitInlineCode(value)
    .map((segment) =>
      segment.code
        ? `<code class="inline-code">${escapeHtml(segment.text).replaceAll('\n', '<br />')}</code>`
        : renderMathSegment(segment.text),
    )
    .join('');
}

function renderMathSegment(value: string): string {
  let html = '';
  let cursor = 0;

  while (cursor < value.length) {
    const token = findNextMathToken(value, cursor);
    if (!token) {
      html += renderPlainRichText(value.slice(cursor));
      break;
    }

    html += renderPlainRichText(value.slice(cursor, token.start));
    html += renderMathToken(token.raw, token.displayMode);
    cursor = token.end;
  }

  return html;
}

/** `==강조==`는 한 줄 안에서만 짝을 맞춘다. 줄을 넘는 `==`는 글자 그대로 둔다. */
function renderPlainRichText(value: string): string {
  return value
    .split('\n')
    .map((line) => renderHighlightedLine(line))
    .join('<br />');
}

function renderHighlightedLine(line: string): string {
  let html = '';
  let cursor = 0;

  while (cursor < line.length) {
    const start = line.indexOf('==', cursor);
    if (start === -1) {
      html += renderPlainSegment(line.slice(cursor));
      break;
    }

    const end = line.indexOf('==', start + 2);
    if (end === -1) {
      html += renderPlainSegment(line.slice(cursor));
      break;
    }

    html += renderPlainSegment(line.slice(cursor, start));
    html += `<mark class="text-highlight">${renderPlainSegment(line.slice(start + 2, end))}</mark>`;
    cursor = end + 2;
  }

  return html;
}

/** 수식 밖 일반 텍스트. `\$`는 수식 구분자가 아닌 글자 그대로의 `$`로 표시한다. */
function renderPlainSegment(value: string): string {
  return escapeHtml(value.replaceAll('\\$', '$'));
}

function renderMathToken(value: string, displayMode: boolean): string {
  try {
    return katex.renderToString(value, {
      displayMode,
      output: 'html',
      strict: 'warn',
      throwOnError: false,
      trust: false,
    });
  } catch {
    return escapeHtml(displayMode ? `$$${value}$$` : `$${value}$`);
  }
}
