import type { SimpleGraphDiagram, SimpleGraphNodeShape } from '../../types/question';
import { renderMathText } from '../rich-text';
import { escapeHtml } from '../shared';
import { hashDiagram, renderArrowMarker } from './shared';

export function renderSimpleGraphDiagram(diagram: SimpleGraphDiagram, className: string): string {
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
        ${renderArrowMarker(markerId)}
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
          const edgeClass =
            `simple-graph-edge ${edge.style === 'dashed' ? 'simple-graph-edge-dashed' : ''}`.trim();
          const isLoop = edge.from === edge.to;
          const edgeShape = isLoop
            ? `<path class="${edgeClass}" d="${simpleGraphLoopPath(from, edge.curve ?? 1)}"${marker}></path>`
            : edge.curve && edge.curve !== 0
              ? `<path class="${edgeClass}" d="${simpleGraphCurvePath(points, edge.curve)}"${marker}></path>`
              : `<line class="${edgeClass}" x1="${points.x1}" y1="${points.y1}" x2="${points.x2}" y2="${points.y2}"${marker}></line>`;
          const label = edge.label
            ? renderSimpleGraphEdgeLabel(edge.label, from, to, edge.curve ?? 0)
            : '';

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
                  : `<text x="${node.x + (node.labelDx ?? 0)}" y="${node.y + (node.labelDy ?? 0)}" text-anchor="${node.labelDx === undefined ? 'middle' : node.labelDx < 0 ? 'end' : 'start'}" ${node.underline ? 'dy="0.35em"' : 'dominant-baseline="central"'}${renderSimpleGraphTextStyle(node)}>${renderMathText(node.label)}</text>`
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
  shape?: SimpleGraphNodeShape;
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

  if (node.shape === 'ellipse') {
    const width = node.width ?? 60;
    const height = node.height ?? 28;
    return `<ellipse cx="${node.x}" cy="${node.y}" rx="${width / 2}" ry="${height / 2}"${style}></ellipse>`;
  }

  if (node.shape === 'diamond') {
    const halfWidth = (node.width ?? 80) / 2;
    const halfHeight = (node.height ?? 40) / 2;
    const points = [
      `${node.x},${node.y - halfHeight}`,
      `${node.x + halfWidth},${node.y}`,
      `${node.x},${node.y + halfHeight}`,
      `${node.x - halfWidth},${node.y}`,
    ].join(' ');
    return `<polygon points="${points}"${style}></polygon>`;
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
  underline?: boolean;
}): string {
  const styles: string[] = [];
  if (node.fontSize) {
    styles.push(`font-size: ${node.fontSize}px`);
  }
  if (node.textColor) {
    styles.push(`fill: ${escapeHtml(node.textColor)}`);
  }
  if (node.underline) {
    styles.push('text-decoration: underline');
  }

  return styles.length > 0 ? ` style="${styles.join('; ')}"` : '';
}

interface SimpleGraphEndpointNode {
  x: number;
  y: number;
  height?: number;
  hideNode?: boolean;
  radius?: number;
  shape?: SimpleGraphNodeShape;
  width?: number;
}

function simpleGraphEdgeEndpoint(
  from: SimpleGraphEndpointNode,
  to: SimpleGraphEndpointNode,
): { x1: number; y1: number; x2: number; y2: number } {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length = Math.hypot(dx, dy) || 1;
  const fromRadius = simpleGraphBoundaryDistance(from, dx / length, dy / length);
  const toRadius = simpleGraphBoundaryDistance(to, dx / length, dy / length);

  return {
    x1: from.x + (dx / length) * fromRadius,
    y1: from.y + (dy / length) * fromRadius,
    x2: to.x - (dx / length) * toRadius,
    y2: to.y - (dy / length) * toRadius,
  };
}

// Distance from the node centre to its outline along the unit direction (ux, uy).
function simpleGraphBoundaryDistance(
  node: SimpleGraphEndpointNode,
  ux: number,
  uy: number,
): number {
  if (node.hideNode) {
    return 0;
  }

  if (node.shape === 'ellipse' || node.shape === 'diamond') {
    const halfWidth = (node.width ?? (node.shape === 'ellipse' ? 60 : 80)) / 2;
    const halfHeight = (node.height ?? (node.shape === 'ellipse' ? 28 : 40)) / 2;
    return node.shape === 'ellipse'
      ? 1 / Math.hypot(ux / halfWidth, uy / halfHeight)
      : 1 / (Math.abs(ux) / halfWidth + Math.abs(uy) / halfHeight);
  }

  return node.radius ?? 20;
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

function simpleGraphLoopPath(node: { x: number; y: number }, curve: number): string {
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
