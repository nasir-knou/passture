import type { UiWindowDiagram } from '../../types/question';
import { renderMathText } from '../rich-text';
import { escapeHtml } from '../shared';

export function renderUiWindowDiagram(diagram: UiWindowDiagram, className: string): string {
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
