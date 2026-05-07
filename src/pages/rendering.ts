import katex from 'katex';

import type {
  Choice,
  ClockPageReplacementDiagram,
  ChoiceDiagram,
  DataTableDiagram,
  MemoryFreeListDiagram,
  Passage,
  QuestionImage,
  ResourceAllocationGraphNode,
} from '../types/question';
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

export function renderAnswerExplanationBody(
  choices: readonly Choice[],
  answers: readonly string[],
  explanation: string,
): string {
  const parsed = parseChoiceExplanation(explanation);

  if (parsed.choiceReasons.size === 0) {
    return renderBlockRichText(explanation, 'explanation-body');
  }

  return `
    <div class="explanation-body">
      ${choices
        .map((choice, index) => {
          const isAnswer = answers.includes(choice.id);
          const reason = parsed.choiceReasons.get(choice.id);
          const choiceText = choice.text ? ` ${choice.text}` : '';

          return `
            <p>
              <strong>${index + 1}번 (${isAnswer ? '정답' : '오답'})</strong>${renderRichText(choiceText)}
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

export function renderChoiceContent(choice: Choice): string {
  return `
    <span class="choice-content">
      ${renderRichText(choice.text, 'choice-text')}
      ${choice.image ? renderImage(choice.image, 'choice-image') : ''}
      ${choice.diagram ? renderDiagram(choice.diagram, 'choice-diagram') : ''}
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
              : passage.diagram
                ? renderDiagram(passage.diagram, 'passage-diagram')
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

function renderDiagram(diagram: ChoiceDiagram, className: string): string {
  if (diagram.type === 'resource-allocation-graph') {
    const nodes = new Map(diagram.nodes.map((node) => [node.id, node]));
    const markerId = `rag-arrow-${hashDiagram(diagram)}`;

    return `
      <svg
        class="${className} resource-allocation-graph"
        viewBox="0 0 ${diagram.width} ${diagram.height}"
        role="img"
        aria-label="${escapeHtml(diagram.nodes.map((node) => node.label).join(', '))}"
      >
        <defs>
          <marker id="${markerId}" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M 0 0 L 10 5 L 0 10 z"></path>
          </marker>
        </defs>
        ${diagram.edges
          .map((edge) => {
            const from = nodes.get(edge.from);
            const to = nodes.get(edge.to);

            if (!from || !to) {
              return '';
            }

            const points = edgeEndpoint(from, to);
            return `<line class="rag-edge ${edge.style === 'dashed' ? 'rag-edge-dashed' : ''}" x1="${points.x1}" y1="${points.y1}" x2="${points.x2}" y2="${points.y2}" marker-end="url(#${markerId})" />`;
          })
          .join('')}
        ${diagram.nodes.map((node) => renderRagNode(node)).join('')}
      </svg>
    `;
  }

  if (diagram.type === 'memory-free-list') {
    return renderMemoryFreeListDiagram(diagram, className);
  }

  if (diagram.type === 'data-table') {
    return renderDataTableDiagram(diagram, className);
  }

  if (diagram.type === 'clock-page-replacement') {
    return renderClockPageReplacementDiagram(diagram, className);
  }

  return '';
}

function renderClockPageReplacementDiagram(
  diagram: ClockPageReplacementDiagram,
  className: string,
): string {
  const markerId = `clock-arrow-${hashDiagram(diagram)}`;
  const cx = diagram.width / 2;
  const cy = diagram.height / 2;
  const radius = Math.min(diagram.width, diagram.height) * 0.33;
  const innerRadius = radius * 0.48;
  const entries = diagram.entries;
  const step = (Math.PI * 2) / entries.length;
  const pointerAngle = -Math.PI / 2 + diagram.pointerIndex * step;
  const pointerX = cx + Math.cos(pointerAngle) * (innerRadius + 6);
  const pointerY = cy + Math.sin(pointerAngle) * (innerRadius + 6);

  return `
    <svg
      class="${className} clock-page-replacement"
      viewBox="0 0 ${diagram.width} ${diagram.height}"
      role="img"
      aria-label="${escapeHtml(entries.map((entry) => `${entry.page}, ${entry.referenceBit}`).join(', '))}"
    >
      <defs>
        <marker id="${markerId}" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M 0 0 L 10 5 L 0 10 z"></path>
        </marker>
      </defs>
      <circle class="clock-ring" cx="${cx}" cy="${cy}" r="${radius}"></circle>
      <circle class="clock-center" cx="${cx}" cy="${cy}" r="${innerRadius}"></circle>
      ${entries
        .map((entry, index) => {
          const angle = -Math.PI / 2 + index * step;
          const labelRadius = (radius + innerRadius) / 2;
          const x = cx + Math.cos(angle) * labelRadius;
          const y = cy + Math.sin(angle) * labelRadius;
          const dividerAngle = angle - step / 2;
          const x1 = cx + Math.cos(dividerAngle) * innerRadius;
          const y1 = cy + Math.sin(dividerAngle) * innerRadius;
          const x2 = cx + Math.cos(dividerAngle) * radius;
          const y2 = cy + Math.sin(dividerAngle) * radius;

          return `
            <line class="clock-divider" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"></line>
            <text x="${x}" y="${y}" text-anchor="middle" dominant-baseline="central">${escapeHtml(`${entry.page}, ${entry.referenceBit}`)}</text>
          `;
        })
        .join('')}
      <line class="clock-pointer" x1="${cx}" y1="${cy}" x2="${pointerX}" y2="${pointerY}" marker-end="url(#${markerId})"></line>
      <path class="clock-rotation" d="M ${cx + 24} ${cy - 32} C ${cx + 56} ${cy - 24}, ${cx + 58} ${cy + 14}, ${cx + 26} ${cy + 28}" marker-end="url(#${markerId})"></path>
    </svg>
  `;
}

function renderDataTableDiagram(diagram: DataTableDiagram, className: string): string {
  return `
    <div class="${className} data-table-diagram" role="img" aria-label="${escapeHtml(diagram.columns.join(', '))}">
      <table>
        <thead>
          <tr>
            ${diagram.columns.map((column) => `<th>${renderMathText(column)}</th>`).join('')}
          </tr>
        </thead>
        <tbody>
          ${diagram.rows
            .map(
              (row) => `
                <tr>
                  ${row.map((cell) => `<td>${renderMathText(cell)}</td>`).join('')}
                </tr>
              `,
            )
            .join('')}
        </tbody>
      </table>
    </div>
  `;
}

function renderMemoryFreeListDiagram(diagram: MemoryFreeListDiagram, className: string): string {
  const markerId = `memory-arrow-${hashDiagram(diagram)}`;
  const memoryX = 260;
  const memoryY = 36;
  const memoryWidth = 170;
  const freeBlocks: Array<{ centerY: number; label: string }> = [];
  let currentY = memoryY;

  const blocks = diagram.blocks.map((block) => {
    const height = memoryBlockHeight(block.kind, block.size);
    const y = currentY;
    currentY += height;

    if (block.kind === 'free') {
      freeBlocks.push({ centerY: y + height / 2, label: block.label });
    }

    return { ...block, height, y };
  });

  const linkedListX = 170;
  const linkedListY = memoryY + 16;

  return `
    <svg
      class="${className} memory-free-list"
      viewBox="0 0 ${diagram.width} ${diagram.height}"
      role="img"
      aria-label="${escapeHtml(diagram.blocks.map((block) => block.label).join(', '))}"
    >
      <defs>
        <marker id="${markerId}" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M 0 0 L 10 5 L 0 10 z"></path>
        </marker>
      </defs>
      <text class="memory-free-list-title" x="${linkedListX - 24}" y="${linkedListY - 12}">빈 공간 리스트</text>
      <rect class="memory-free-list-head" x="${linkedListX}" y="${linkedListY}" width="24" height="24"></rect>
      ${
        freeBlocks[0]
          ? `<line class="memory-free-list-arrow" x1="${linkedListX + 24}" y1="${linkedListY + 12}" x2="${memoryX - 6}" y2="${freeBlocks[0].centerY}" marker-end="url(#${markerId})" />`
          : ''
      }
      <g class="memory-stack">
        ${blocks
          .map(
            (block) => `
              <g>
                <rect class="memory-block memory-${block.kind}" x="${memoryX}" y="${block.y}" width="${memoryWidth}" height="${block.height}"></rect>
                <text x="${memoryX + memoryWidth / 2}" y="${block.y + block.height / 2}" text-anchor="middle" dominant-baseline="central">${escapeHtml(block.label)}</text>
              </g>
            `,
          )
          .join('')}
      </g>
      ${freeBlocks
        .slice(0, -1)
        .map((block, index) => {
          const next = freeBlocks[index + 1];
          const controlX = memoryX - 46;
          return `<path class="memory-free-list-arrow" d="M ${memoryX} ${block.centerY} C ${controlX} ${block.centerY}, ${controlX} ${next.centerY}, ${memoryX} ${next.centerY}" marker-end="url(#${markerId})" />`;
        })
        .join('')}
    </svg>
  `;
}

function memoryBlockHeight(kind: string, size: number | undefined): number {
  if (kind === 'os') {
    return 34;
  }

  if (kind === 'allocated') {
    return 34;
  }

  return Math.max(34, (size ?? 30) * 1.4);
}

function renderRagNode(node: ResourceAllocationGraphNode): string {
  const label = escapeHtml(formatSvgMathLabel(node.label));

  if (node.kind === 'process') {
    return `
      <g class="rag-node rag-process" transform="translate(${node.x} ${node.y})">
        <circle r="18"></circle>
        <text text-anchor="middle" dominant-baseline="central">${label}</text>
      </g>
    `;
  }

  return `
    <g class="rag-node rag-resource" transform="translate(${node.x} ${node.y})">
      ${node.units ? `<text class="rag-units" text-anchor="middle" x="0" y="-27">${node.units}</text>` : ''}
      <rect x="-15" y="-15" width="30" height="30"></rect>
      <text text-anchor="middle" dominant-baseline="central">${label}</text>
    </g>
  `;
}

function formatSvgMathLabel(value: string): string {
  return value.replaceAll('_1', '₁').replaceAll('_2', '₂').replaceAll('_3', '₃');
}

function hashDiagram(diagram: ChoiceDiagram): string {
  const value = JSON.stringify(diagram);
  let hash = 0;

  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }

  return hash.toString(36);
}

function edgeEndpoint(
  from: ResourceAllocationGraphNode,
  to: ResourceAllocationGraphNode,
): { x1: number; x2: number; y1: number; y2: number } {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length = Math.hypot(dx, dy) || 1;
  const ux = dx / length;
  const uy = dy / length;
  const fromRadius = from.kind === 'process' ? 18 : 15;
  const toRadius = to.kind === 'process' ? 18 : 15;

  return {
    x1: Math.round(from.x + ux * fromRadius),
    y1: Math.round(from.y + uy * fromRadius),
    x2: Math.round(to.x - ux * toRadius),
    y2: Math.round(to.y - uy * toRadius),
  };
}

interface ParsedExplanation {
  choiceReasons: Map<string, string>;
  coreLines: string[];
  otherLines: string[];
}

function parseChoiceExplanation(explanation: string): ParsedExplanation {
  const choiceReasons = new Map<string, string>();
  const coreLines: string[] = [];
  const otherLines: string[] = [];
  let section: 'other' | 'core' = 'other';

  for (const rawLine of explanation.split('\n')) {
    const line = rawLine.trim();

    if (line.length === 0) {
      continue;
    }

    const choiceMatch = line.match(/^선택지\s+([^\s(]+)\s*(?:\((?:정답|오답)\))?\s*:\s*(.+)$/);
    if (choiceMatch) {
      choiceReasons.set(choiceMatch[1], choiceMatch[2]);
      continue;
    }

    if (line === '핵심 개념:' || line === '핵심 개념') {
      section = 'core';
      continue;
    }

    if (section === 'core') {
      coreLines.push(line);
    } else {
      otherLines.push(line);
    }
  }

  return {
    choiceReasons,
    coreLines,
    otherLines,
  };
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
