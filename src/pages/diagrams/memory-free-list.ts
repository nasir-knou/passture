import type { MemoryFreeListDiagram } from '../../types/question';
import { escapeHtml } from '../shared';
import { hashDiagram, renderArrowMarker } from './shared';

export function renderMemoryFreeListDiagram(
  diagram: MemoryFreeListDiagram,
  className: string,
): string {
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
        ${renderArrowMarker(markerId)}
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
