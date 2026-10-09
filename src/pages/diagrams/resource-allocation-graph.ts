import type {
  ResourceAllocationGraphDiagram,
  ResourceAllocationGraphNode,
} from '../../types/question';
import { escapeHtml } from '../shared';
import { hashDiagram, renderArrowMarker } from './shared';

export function renderResourceAllocationGraphDiagram(
  diagram: ResourceAllocationGraphDiagram,
  className: string,
): string {
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
        ${renderArrowMarker(markerId)}
      </defs>
      ${diagram.edges
        .map((edge) => {
          const from = nodes.get(edge.from);
          const to = nodes.get(edge.to);

          if (!from || !to) {
            return '';
          }

          const points = edgeEndpoint(from, to);
          const label = edge.label
            ? renderRagEdgeLabel(edge.label, points, edge.labelDx ?? 0, edge.labelDy ?? 0)
            : '';
          return `<line class="rag-edge ${edge.style === 'dashed' ? 'rag-edge-dashed' : ''}" x1="${points.x1}" y1="${points.y1}" x2="${points.x2}" y2="${points.y2}" marker-end="url(#${markerId})" />${label}`;
        })
        .join('')}
      ${diagram.nodes.map((node) => renderRagNode(node)).join('')}
    </svg>
  `;
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
