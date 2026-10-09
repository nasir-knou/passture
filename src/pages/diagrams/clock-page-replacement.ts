import type { ClockPageReplacementDiagram } from '../../types/question';
import { escapeHtml } from '../shared';
import { hashDiagram, renderArrowMarker } from './shared';

export function renderClockPageReplacementDiagram(
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
        ${renderArrowMarker(markerId)}
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
