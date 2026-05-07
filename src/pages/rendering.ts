import katex from 'katex';

import type { Choice, Passage, QuestionImage } from '../types/question';
import { escapeHtml } from './shared';

type MathToken = {
  displayMode: boolean;
  end: number;
  raw: string;
  start: number;
};

export function renderRichText(value: string, className?: string): string {
  const body = renderMathText(value);
  return className ? `<span class="${className}">${body}</span>` : body;
}

export function renderBlockRichText(value: string, className: string): string {
  return `<div class="${className}">${renderMathText(value)}</div>`;
}

export function renderChoiceContent(choice: Choice): string {
  return `
    <span class="choice-content">
      ${renderRichText(choice.text, 'choice-text')}
      ${choice.image ? renderImage(choice.image, 'choice-image') : ''}
    </span>
  `;
}

export function renderPassages(passages: readonly Passage[]): string {
  if (passages.length === 0) {
    return '';
  }

  return passages
    .map(
      (passage) => `
        <section class="passage">
          ${
            passage.image
              ? renderImage(passage.image)
              : passage.type === 'text'
                ? renderBlockRichText(passage.body ?? '', 'passage-text')
                : `<pre><code>${escapeHtml(passage.body ?? '')}</code></pre>`
          }
        </section>
      `,
    )
    .join('');
}

export function renderImage(image: QuestionImage, className = 'question-image'): string {
  return `
    <img
      class="${className}"
      src="${escapeHtml(image.path)}"
      alt="${escapeHtml(image.alt)}"
      loading="lazy"
    />
  `;
}

export function renderQuestionImages(images: readonly QuestionImage[]): string {
  if (images.length === 0) {
    return '';
  }

  return `
    <div class="question-images">
      ${images.map((image) => renderImage(image)).join('')}
    </div>
  `;
}

function renderMathText(value: string): string {
  let html = '';
  let cursor = 0;

  while (cursor < value.length) {
    const token = findNextMathToken(value, cursor);
    if (!token) {
      html += escapeHtml(value.slice(cursor)).replaceAll('\n', '<br />');
      break;
    }

    html += escapeHtml(value.slice(cursor, token.start)).replaceAll('\n', '<br />');
    html += renderMathToken(token.raw, token.displayMode);
    cursor = token.end;
  }

  return html;
}

function findNextMathToken(value: string, from: number): MathToken | undefined {
  const displayStart = value.indexOf('$$', from);
  const inlineStart = value.indexOf('$', from);

  if (displayStart === -1 && inlineStart === -1) {
    return undefined;
  }

  if (displayStart !== -1 && (inlineStart === -1 || displayStart <= inlineStart)) {
    const end = value.indexOf('$$', displayStart + 2);
    if (end !== -1) {
      return {
        displayMode: true,
        start: displayStart,
        end: end + 2,
        raw: value.slice(displayStart + 2, end).trim(),
      };
    }
  }

  const start = inlineStart;
  const end = value.indexOf('$', start + 1);
  if (start !== -1 && end !== -1) {
    return {
      displayMode: false,
      start,
      end: end + 1,
      raw: value.slice(start + 1, end).trim(),
    };
  }

  return undefined;
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
