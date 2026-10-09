import type { Choice, Passage, QuestionImage } from '../types/question';
import { isNoteLine, parseChoiceExplanation } from '../lib/explanation';
import { extractMathTokens } from '../lib/math-tokens';
import { renderDiagram } from './diagrams';
import { renderMathText } from './rich-text';
import { escapeHtml } from './shared';

export function renderRichText(value: string, className?: string): string {
  const body = renderMathText(value);
  return className ? `<span class="${className}">${body}</span>` : body;
}

export function renderBlockRichText(value: string, className: string): string {
  return `<div class="${className}">${renderMathText(value)}</div>`;
}

export function renderAnswerExplanationBody(
  choices: readonly Choice[],
  answers: readonly string[],
  explanation: string,
): string {
  const parsed = parseChoiceExplanation(explanation);
  const note = renderExplanationNote(parsed.noteLines);

  if (parsed.choiceReasons.size === 0) {
    if (!note) {
      return renderBlockRichText(explanation, 'explanation-body');
    }

    const body = explanation
      .split('\n')
      .filter((line) => !isNoteLine(line))
      .join('\n')
      .trim();

    return `
      <div class="explanation-body">
        ${body ? `<div>${renderMathText(body)}</div>` : ''}
        ${note}
      </div>
    `;
  }

  return `
    <div class="explanation-body">
      ${choices
        .map((choice, index) => {
          const isAnswer = answers.includes(choice.id);
          const reason = parsed.choiceReasons.get(choice.id);
          const choiceText = isMultilineChoiceText(choice.text)
            ? renderChoiceText(choice.text)
            : choice.text
              ? ` ${renderChoiceText(choice.text)}`
              : '';

          return `
            <p>
              <strong>${index + 1}번 (${isAnswer ? '정답' : '오답'})</strong>${choiceText}
              ${reason ? `<br />${renderRichText(reason)}` : ''}
            </p>
          `;
        })
        .join('')}
      ${
        parsed.coreLines.length > 0
          ? `
            <p><strong>핵심 개념</strong><br />${renderRichText(parsed.coreLines.join('\n'))}</p>
          `
          : ''
      }
      ${
        parsed.otherLines.length > 0
          ? renderBlockRichText(parsed.otherLines.join('\n'), 'explanation-extra')
          : ''
      }
      ${note}
    </div>
  `;
}

export function formatAnswerSummary(
  choices: readonly Choice[],
  answers: readonly string[],
): string {
  return answers
    .map((answer) => {
      const index = choices.findIndex((choice) => choice.id === answer);
      return index >= 0 ? `${index + 1}번` : answer;
    })
    .join(', ');
}

/** 보기 번호(표시 순서 기준)를 원문자로 나열한다. 선택지를 섞어도 화면의 번호와 맞는다. */
export function formatCircledChoiceNumbers(
  choices: readonly Choice[],
  selected: readonly string[],
): string {
  return choices
    .map((choice, index) => (selected.includes(choice.id) ? circledNumber(index + 1) : ''))
    .join('');
}

function circledNumber(value: number): string {
  return value >= 1 && value <= 20 ? String.fromCodePoint(0x2460 + value - 1) : `(${value})`;
}

export function renderChoiceContent(choice: Choice): string {
  return `
    <span class="choice-content">
      ${renderChoiceText(choice.text, 'choice-text')}
      ${choice.image ? renderImage(choice.image, 'choice-image') : ''}
      ${choice.diagram ? renderDiagram(choice.diagram, 'choice-diagram') : ''}
    </span>
  `;
}

/** 수식 밖에 줄바꿈이 있는 보기(코드 등)는 공백·들여쓰기를 살려 고정폭으로 표시한다. */
function renderChoiceText(value: string | undefined, className?: string): string {
  const text = (value ?? '').replace(/\n$/, '');
  if (text.length === 0) {
    return '';
  }

  if (!isMultilineChoiceText(text)) {
    return renderRichText(text, className);
  }

  return renderRichText(
    text,
    className ? `${className} choice-text-multiline` : 'choice-text-multiline',
  );
}

function isMultilineChoiceText(value: string | undefined): boolean {
  const text = (value ?? '').replace(/\n$/, '');
  let outsideMath = '';
  let cursor = 0;

  for (const token of extractMathTokens(text)) {
    outsideMath += text.slice(cursor, token.start);
    cursor = token.end;
  }
  outsideMath += text.slice(cursor);

  return outsideMath.includes('\n');
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
              : passage.diagram
                ? renderDiagram(passage.diagram, 'passage-diagram')
                : passage.type === 'text'
                  ? renderBlockRichText(passage.body ?? '', 'passage-text')
                  : `<pre><code>${renderCodeText(passage.body ?? '', passage.highlights ?? [])}</code></pre>`
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

function renderCodeText(value: string, highlights: readonly string[]): string {
  if (highlights.length === 0) {
    return escapeHtml(value);
  }

  const sortedHighlights = [...highlights].filter(Boolean).sort((a, b) => b.length - a.length);
  const ranges: { end: number; start: number }[] = [];

  for (const highlight of sortedHighlights) {
    let cursor = 0;
    while (cursor < value.length) {
      const start = value.indexOf(highlight, cursor);
      if (start === -1) {
        break;
      }

      const end = start + highlight.length;
      if (!ranges.some((range) => start < range.end && end > range.start)) {
        ranges.push({ start, end });
      }
      cursor = end;
    }
  }

  if (ranges.length === 0) {
    return escapeHtml(value);
  }

  ranges.sort((a, b) => a.start - b.start);

  let html = '';
  let cursor = 0;
  for (const range of ranges) {
    html += escapeHtml(value.slice(cursor, range.start));
    html += `<mark class="code-highlight">${escapeHtml(value.slice(range.start, range.end))}</mark>`;
    cursor = range.end;
  }
  html += escapeHtml(value.slice(cursor));

  return html;
}

function renderExplanationNote(lines: readonly string[]): string {
  if (lines.length === 0) {
    return '';
  }

  return `<div class="explanation-note">${lines.map((line) => `<p>${renderMathText(line)}</p>`).join('')}</div>`;
}
