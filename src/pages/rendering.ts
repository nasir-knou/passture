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
            const label = edge.label ? renderRagEdgeLabel(edge.label, points, edge.labelDx ?? 0, edge.labelDy ?? 0) : '';
            return `<line class="rag-edge ${edge.style === 'dashed' ? 'rag-edge-dashed' : ''}" x1="${points.x1}" y1="${points.y1}" x2="${points.x2}" y2="${points.y2}" marker-end="url(#${markerId})" />${label}`;
          })
          .join('')}
        ${diagram.nodes.map((node) => renderRagNode(node)).join('')}
      </svg>
    `;
  }

  if (diagram.type === 'simple-graph') {
    return renderSimpleGraphDiagram(diagram, className);
  }

  if (diagram.type === 'ui-window') {
    return renderUiWindowDiagram(diagram, className);
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

function renderUiWindowDiagram(diagram: ChoiceDiagram & { type: 'ui-window' }, className: string): string {
  const chromeHeight = 34;
  const contentY = chromeHeight;
  const componentHtml = diagram.components
    .map((component) => {
      if (component.kind === 'label') {
        return `<text class="ui-window-label" x="${component.x}" y="${component.y}" dominant-baseline="central">${renderMathText(component.label)}</text>`;
      }

      const size = component.kind === 'checkbox' ? 15 : 16;
      const controlX = component.x;
      const controlY = component.y - size / 2;
      const labelX = component.x + size + 6;
      const focusedWidth = Math.max(component.label.length * 8 + 6, 24);
      const focusBox = component.focused
        ? `<rect class="ui-window-focus" x="${labelX - 3}" y="${component.y - 12}" width="${focusedWidth}" height="22"></rect>`
        : '';

      if (component.kind === 'checkbox') {
        return `
          <g class="ui-window-control">
            <rect class="ui-window-checkbox" x="${controlX}" y="${controlY}" width="${size}" height="${size}"></rect>
            ${
              component.checked
                ? `<path class="ui-window-check" d="M ${controlX + 3} ${controlY + 8} L ${controlX + 7} ${controlY + 12} L ${controlX + 13} ${controlY + 4}"></path>`
                : ''
            }
            ${focusBox}
            <text x="${labelX}" y="${component.y}" dominant-baseline="central">${renderMathText(component.label)}</text>
          </g>
        `;
      }

      return `
        <g class="ui-window-control">
          <circle class="ui-window-radio" cx="${controlX + size / 2}" cy="${component.y}" r="${size / 2}"></circle>
          ${
            component.checked
              ? `<circle class="ui-window-radio-dot" cx="${controlX + size / 2}" cy="${component.y}" r="4"></circle>`
              : ''
          }
          ${focusBox}
          <text x="${labelX}" y="${component.y}" dominant-baseline="central">${renderMathText(component.label)}</text>
        </g>
      `;
    })
    .join('');

  return `
    <svg
      class="${className} ui-window"
      viewBox="0 0 ${diagram.width} ${diagram.height}"
      role="img"
      aria-label="${escapeHtml([diagram.title, ...diagram.components.map((component) => component.label)].join(', '))}"
    >
      <rect class="ui-window-frame" x="1" y="1" width="${diagram.width - 2}" height="${diagram.height - 2}" rx="2"></rect>
      <rect class="ui-window-titlebar" x="1" y="1" width="${diagram.width - 2}" height="${chromeHeight}"></rect>
      <text class="ui-window-title" x="32" y="18" dominant-baseline="central">${renderMathText(diagram.title)}</text>
      <rect class="ui-window-button" x="${diagram.width - 84}" y="8" width="22" height="16"></rect>
      <rect class="ui-window-button" x="${diagram.width - 56}" y="8" width="22" height="16"></rect>
      <rect class="ui-window-close" x="${diagram.width - 28}" y="8" width="22" height="16"></rect>
      <rect class="ui-window-content" x="10" y="${contentY + 10}" width="${diagram.width - 20}" height="${diagram.height - chromeHeight - 20}"></rect>
      ${componentHtml}
    </svg>
  `;
}

function renderSimpleGraphDiagram(diagram: ChoiceDiagram & { type: 'simple-graph' }, className: string): string {
  const nodes = new Map(diagram.nodes.map((node) => [node.id, node]));
  const markerId = `simple-graph-arrow-${hashDiagram(diagram)}`;

  return `
    <svg
      class="${className} simple-graph"
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

          const directed = edge.directed ?? diagram.directed ?? false;
          const points = simpleGraphEdgeEndpoint(from, to);
          const marker = directed ? ` marker-end="url(#${markerId})"` : '';
          const edgeClass = `simple-graph-edge ${edge.style === 'dashed' ? 'simple-graph-edge-dashed' : ''}`.trim();
          const isLoop = edge.from === edge.to;
          const edgeShape = isLoop
            ? `<path class="${edgeClass}" d="${simpleGraphLoopPath(from, edge.curve ?? 1)}"${marker}></path>`
            : edge.curve && edge.curve !== 0
              ? `<path class="${edgeClass}" d="${simpleGraphCurvePath(points, edge.curve)}"${marker}></path>`
              : `<line class="${edgeClass}" x1="${points.x1}" y1="${points.y1}" x2="${points.x2}" y2="${points.y2}"${marker}></line>`;
          const label = edge.label ? renderSimpleGraphEdgeLabel(edge.label, from, to, edge.curve ?? 0) : '';

          return `${edgeShape}${label}`;
        })
        .join('')}
      ${diagram.nodes
        .map(
          (node) => `
            <g class="simple-graph-node ${node.tone === 'filled' ? 'simple-graph-node-filled' : ''}">
              ${node.hideNode ? '' : renderSimpleGraphNodeShape(node)}
              ${
                node.hideLabel
                  ? ''
                  : `<text x="${node.x + (node.labelDx ?? 0)}" y="${node.y + (node.labelDy ?? 0)}" text-anchor="${node.labelDx === undefined ? 'middle' : node.labelDx < 0 ? 'end' : 'start'}" dominant-baseline="central"${renderSimpleGraphTextStyle(node)}>${renderMathText(node.label)}</text>`
              }
            </g>
          `,
        )
        .join('')}
    </svg>
  `;
}

function renderSimpleGraphNodeShape(node: {
  fillColor?: string;
  height?: number;
  radius?: number;
  shape?: 'circle' | 'box';
  strokeColor?: string;
  strokeWidth?: number;
  width?: number;
  x: number;
  y: number;
}): string {
  const style = renderSimpleGraphShapeStyle(node);

  if (node.shape === 'box') {
    const width = node.width ?? 36;
    const height = node.height ?? 18;
    return `<rect x="${node.x - width / 2}" y="${node.y - height / 2}" width="${width}" height="${height}" rx="2"${style}></rect>`;
  }

  return `<circle cx="${node.x}" cy="${node.y}" r="${node.radius ?? 20}"${style}></circle>`;
}

function renderSimpleGraphShapeStyle(node: {
  fillColor?: string;
  strokeColor?: string;
  strokeWidth?: number;
}): string {
  const styles: string[] = [];
  if (node.fillColor) {
    styles.push(`fill: ${escapeHtml(node.fillColor)}`);
  }
  if (node.strokeColor) {
    styles.push(`stroke: ${escapeHtml(node.strokeColor)}`);
  }
  if (node.strokeWidth !== undefined) {
    styles.push(`stroke-width: ${node.strokeWidth}`);
  }

  return styles.length > 0 ? ` style="${styles.join('; ')}"` : '';
}

function renderSimpleGraphTextStyle(node: {
  fontSize?: number;
  textColor?: string;
}): string {
  const styles: string[] = [];
  if (node.fontSize) {
    styles.push(`font-size: ${node.fontSize}px`);
  }
  if (node.textColor) {
    styles.push(`fill: ${escapeHtml(node.textColor)}`);
  }

  return styles.length > 0 ? ` style="${styles.join('; ')}"` : '';
}

function simpleGraphEdgeEndpoint(
  from: { x: number; y: number; hideNode?: boolean; radius?: number },
  to: { x: number; y: number; hideNode?: boolean; radius?: number },
): { x1: number; y1: number; x2: number; y2: number } {
  const fromRadius = from.hideNode ? 0 : (from.radius ?? 20);
  const toRadius = to.hideNode ? 0 : (to.radius ?? 20);
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length = Math.hypot(dx, dy) || 1;

  return {
    x1: from.x + (dx / length) * fromRadius,
    y1: from.y + (dy / length) * fromRadius,
    x2: to.x - (dx / length) * toRadius,
    y2: to.y - (dy / length) * toRadius,
  };
}

function simpleGraphCurvePath(
  points: { x1: number; y1: number; x2: number; y2: number },
  curve: number,
): string {
  const midX = (points.x1 + points.x2) / 2;
  const midY = (points.y1 + points.y2) / 2;
  const dx = points.x2 - points.x1;
  const dy = points.y2 - points.y1;
  const length = Math.hypot(dx, dy) || 1;
  const controlX = midX - (dy / length) * curve;
  const controlY = midY + (dx / length) * curve;

  return `M ${points.x1} ${points.y1} Q ${controlX} ${controlY} ${points.x2} ${points.y2}`;
}

function simpleGraphLoopPath(
  node: { x: number; y: number },
  curve: number,
): string {
  const side = curve < 0 ? -1 : 1;
  const startX = node.x - side * 12;
  const endX = node.x + side * 12;
  const y = node.y - 18;
  const control1X = node.x - side * 46;
  const control2X = node.x + side * 46;
  const controlY = node.y - 78;

  return `M ${startX} ${y} C ${control1X} ${controlY}, ${control2X} ${controlY}, ${endX} ${y}`;
}

function renderSimpleGraphEdgeLabel(
  label: string,
  from: { x: number; y: number },
  to: { x: number; y: number },
  curve: number,
): string {
  if (from.x === to.x && from.y === to.y) {
    return `<text class="simple-graph-edge-label" x="${from.x}" y="${from.y - 72}" text-anchor="middle">${renderMathText(label)}</text>`;
  }

  const midX = (from.x + to.x) / 2;
  const midY = (from.y + to.y) / 2;
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length = Math.hypot(dx, dy) || 1;
  const offset = curve || -18;
  const labelX = midX - (dy / length) * offset;
  const labelY = midY + (dx / length) * offset - 4;

  return `<text class="simple-graph-edge-label" x="${labelX}" y="${labelY}" text-anchor="middle">${renderMathText(label)}</text>`;
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
  const pointerRadius = innerRadius * 0.86;
  const pointerX = cx + Math.cos(pointerAngle) * pointerRadius;
  const pointerY = cy + Math.sin(pointerAngle) * pointerRadius;
  const rotationRadius = innerRadius * 0.42;
  const rotationStartAngle = pointerAngle + Math.PI * 0.12;
  const rotationEndAngle = pointerAngle + Math.PI * 0.82;
  const rotationStartX = cx + Math.cos(rotationStartAngle) * rotationRadius;
  const rotationStartY = cy + Math.sin(rotationStartAngle) * rotationRadius;
  const rotationEndX = cx + Math.cos(rotationEndAngle) * rotationRadius;
  const rotationEndY = cy + Math.sin(rotationEndAngle) * rotationRadius;

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
      <path class="clock-rotation" d="M ${rotationStartX} ${rotationStartY} A ${rotationRadius} ${rotationRadius} 0 0 1 ${rotationEndX} ${rotationEndY}" marker-end="url(#${markerId})"></path>
    </svg>
  `;
}

function renderDataTableDiagram(diagram: DataTableDiagram, className: string): string {
  const isCodeTable = diagram.cellFormat === 'code';
  const tableClass = isCodeTable ? 'data-table-code' : '';

  return `
    <div class="${className} data-table-diagram" role="img" aria-label="${escapeHtml(diagram.columns.join(', '))}">
      <table class="${tableClass}">
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

function renderDataTableCell(cell: string, isCodeTable: boolean): string {
  if (!isCodeTable) {
    return renderMathText(cell);
  }

  return `<pre><code>${escapeHtml(cell.trimEnd())}</code></pre>`;
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

function renderRagEdgeLabel(
  label: string,
  points: { x1: number; y1: number; x2: number; y2: number },
  dx: number,
  dy: number,
): string {
  const x = (points.x1 + points.x2) / 2 + dx;
  const y = (points.y1 + points.y2) / 2 + dy;
  return `<text class="rag-edge-label" x="${x}" y="${y}" text-anchor="middle">${escapeHtml(label)}</text>`;
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
      html += renderPlainRichText(value.slice(cursor));
      break;
    }

    html += renderPlainRichText(value.slice(cursor, token.start));
    html += renderMathToken(token.raw, token.displayMode);
    cursor = token.end;
  }

  return html;
}

function renderPlainRichText(value: string): string {
  let html = '';
  let cursor = 0;

  while (cursor < value.length) {
    const start = value.indexOf('==', cursor);
    if (start === -1) {
      html += escapeHtml(value.slice(cursor)).replaceAll('\n', '<br />');
      break;
    }

    const end = value.indexOf('==', start + 2);
    if (end === -1) {
      html += escapeHtml(value.slice(cursor)).replaceAll('\n', '<br />');
      break;
    }

    html += escapeHtml(value.slice(cursor, start)).replaceAll('\n', '<br />');
    html += `<mark class="text-highlight">${escapeHtml(value.slice(start + 2, end)).replaceAll('\n', '<br />')}</mark>`;
    cursor = end + 2;
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
