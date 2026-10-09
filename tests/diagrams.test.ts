// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';

import { renderClockPageReplacementDiagram } from '../src/pages/diagrams/clock-page-replacement';
import { renderDataTableDiagram } from '../src/pages/diagrams/data-table';
import { renderDiagram } from '../src/pages/diagrams';
import { renderMemoryFreeListDiagram } from '../src/pages/diagrams/memory-free-list';
import { renderResourceAllocationGraphDiagram } from '../src/pages/diagrams/resource-allocation-graph';
import { renderSimpleGraphDiagram } from '../src/pages/diagrams/simple-graph';
import { renderUiWindowDiagram } from '../src/pages/diagrams/ui-window';
import type {
  ChoiceDiagram,
  ClockPageReplacementDiagram,
  DataTableDiagram,
  MemoryFreeListDiagram,
  ResourceAllocationGraphDiagram,
  SimpleGraphDiagram,
  UiWindowDiagram,
} from '../src/types/question';

function mount(html: string): HTMLElement {
  const container = document.createElement('div');
  container.innerHTML = html;
  return container;
}

function svgOf(html: string): SVGSVGElement {
  const svg = mount(html).querySelector('svg');
  expect(svg).not.toBeNull();
  return svg as SVGSVGElement;
}

const rag: ResourceAllocationGraphDiagram = {
  type: 'resource-allocation-graph',
  width: 300,
  height: 200,
  nodes: [
    { id: 'p1', kind: 'process', label: 'P_1', x: 50, y: 100 },
    { id: 'r1', kind: 'resource', label: 'R_1', x: 200, y: 100, units: 2 },
  ],
  edges: [
    { from: 'p1', to: 'r1', label: 'req' },
    { from: 'r1', to: 'p1', style: 'dashed' },
    { from: 'p1', to: 'missing' },
  ],
};

const simpleGraph: SimpleGraphDiagram = {
  type: 'simple-graph',
  width: 200,
  height: 120,
  directed: true,
  nodes: [
    { id: 'a', label: 'A', x: 40, y: 60 },
    { id: 'b', label: '$x_1$', x: 160, y: 60, shape: 'box' },
    { id: 'c', label: 'C', x: 100, y: 20, shape: 'diamond', hideNode: true },
  ],
  edges: [
    { from: 'a', to: 'b', label: '5' },
    { from: 'b', to: 'b', curve: 1 },
    { from: 'a', to: 'c', directed: false, style: 'dashed', curve: 20 },
  ],
};

const uiWindow: UiWindowDiagram = {
  type: 'ui-window',
  width: 300,
  height: 160,
  title: 'Settings',
  components: [
    { kind: 'checkbox', label: 'Bold', x: 20, y: 60, checked: true },
    { kind: 'radio', label: 'Small', x: 20, y: 90, focused: true },
    { kind: 'label', label: 'Font', x: 20, y: 120 },
  ],
};

const memory: MemoryFreeListDiagram = {
  type: 'memory-free-list',
  width: 460,
  height: 300,
  blocks: [
    { id: 'os', kind: 'os', label: 'OS' },
    { id: 'f1', kind: 'free', label: '10K', size: 10 },
    { id: 'a1', kind: 'allocated', label: 'P1' },
    { id: 'f2', kind: 'free', label: '30K', size: 30 },
  ],
};

const clock: ClockPageReplacementDiagram = {
  type: 'clock-page-replacement',
  width: 240,
  height: 240,
  pointerIndex: 1,
  entries: [
    { page: '3', referenceBit: 1 },
    { page: '5', referenceBit: 0 },
    { page: '7', referenceBit: 1 },
  ],
};

describe('svg diagrams', () => {
  it.each([
    ['resource-allocation-graph', rag, 'P_1, R_1'],
    ['simple-graph', simpleGraph, 'A, $x_1$, C'],
    ['ui-window', uiWindow, 'Settings, Bold, Small, Font'],
    ['memory-free-list', memory, 'OS, 10K, P1, 30K'],
    ['clock-page-replacement', clock, '3, 1, 5, 0, 7, 1'],
  ] as Array<[string, ChoiceDiagram, string]>)(
    '%s renders an svg with role=img and an aria-label',
    (type, diagram, label) => {
      const svg = svgOf(renderDiagram(diagram, 'choice-diagram'));

      expect(svg.getAttribute('role')).toBe('img');
      expect(svg.getAttribute('aria-label')).toBe(label);
      expect(svg.getAttribute('viewBox')).toBe(
        `0 0 ${(diagram as { width: number }).width} ${(diagram as { height: number }).height}`,
      );
      expect(svg.classList.contains('choice-diagram')).toBe(true);
      expect(svg.classList.contains(type)).toBe(true);
    },
  );

  it('escapes labels in the aria-label attribute', () => {
    const svg = svgOf(
      renderSimpleGraphDiagram(
        { ...simpleGraph, nodes: [{ id: 'a', label: 'a"<b>', x: 1, y: 1 }], edges: [] },
        'd',
      ),
    );

    expect(svg.getAttribute('aria-label')).toBe('a"<b>');
    expect(svg.querySelector('b')).toBeNull();
  });

  it('resource allocation graph draws nodes, labelled edges and skips dangling edges', () => {
    const svg = svgOf(renderResourceAllocationGraphDiagram(rag, 'd'));

    expect(svg.querySelectorAll('.rag-process circle')).toHaveLength(1);
    expect(svg.querySelectorAll('.rag-resource rect')).toHaveLength(1);
    expect(svg.querySelector('.rag-units')?.textContent).toBe('2');
    expect(svg.querySelectorAll('line.rag-edge')).toHaveLength(2);
    expect(svg.querySelectorAll('line.rag-edge-dashed')).toHaveLength(1);
    expect(svg.querySelector('.rag-edge-label')?.textContent).toBe('req');
    expect([...svg.querySelectorAll('.rag-node text')].map((t) => t.textContent)).toContain('P₁');
    const markerId = svg.querySelector('marker')?.id;
    expect(markerId).toMatch(/^rag-arrow-/);
    expect(svg.querySelector('line.rag-edge')?.getAttribute('marker-end')).toBe(
      `url(#${markerId})`,
    );
  });

  it('simple graph renders shapes, loops, curves and directed markers', () => {
    const svg = svgOf(renderSimpleGraphDiagram(simpleGraph, 'd'));

    expect(svg.querySelectorAll('.simple-graph-node')).toHaveLength(3);
    expect(svg.querySelectorAll('circle')).toHaveLength(1);
    expect(svg.querySelectorAll('rect')).toHaveLength(1);
    expect(svg.querySelector('polygon')).toBeNull();
    expect(svg.querySelectorAll('line.simple-graph-edge[marker-end]')).toHaveLength(1);
    const paths = [...svg.querySelectorAll('path.simple-graph-edge')];
    expect(paths).toHaveLength(2);
    expect(paths[0]?.getAttribute('d')).toMatch(/^M .* C /);
    expect(paths[1]?.getAttribute('d')).toMatch(/^M .* Q /);
    expect(paths[1]?.hasAttribute('marker-end')).toBe(false);
    expect(paths[1]?.classList.contains('simple-graph-edge-dashed')).toBe(true);
    expect(svg.querySelector('.simple-graph-edge-label')?.textContent).toBe('5');
    expect(svg.innerHTML).toContain('katex');
  });

  it('ui window renders checkbox, radio, focus box and label', () => {
    const svg = svgOf(renderUiWindowDiagram(uiWindow, 'd'));

    expect(svg.querySelector('.ui-window-title')?.textContent).toBe('Settings');
    expect(svg.querySelector('.ui-window-checkbox')).not.toBeNull();
    expect(svg.querySelector('.ui-window-check')).not.toBeNull();
    expect(svg.querySelector('.ui-window-radio')).not.toBeNull();
    expect(svg.querySelector('.ui-window-radio-dot')).toBeNull();
    expect(svg.querySelectorAll('.ui-window-focus')).toHaveLength(1);
    expect(svg.querySelector('.ui-window-label')?.textContent).toBe('Font');
  });

  it('memory free list stacks blocks and links free blocks', () => {
    const svg = svgOf(renderMemoryFreeListDiagram(memory, 'd'));

    expect(svg.querySelectorAll('.memory-block')).toHaveLength(4);
    expect(svg.querySelectorAll('.memory-free')).toHaveLength(2);
    expect(svg.querySelectorAll('line.memory-free-list-arrow')).toHaveLength(1);
    expect(svg.querySelectorAll('path.memory-free-list-arrow')).toHaveLength(1);
    const ys = [...svg.querySelectorAll('.memory-block')].map((rect) =>
      Number(rect.getAttribute('y')),
    );
    expect(ys).toEqual([...ys].sort((a, b) => a - b));
  });

  it('memory free list omits the head arrow when there is no free block', () => {
    const svg = svgOf(
      renderMemoryFreeListDiagram(
        { ...memory, blocks: [{ id: 'os', kind: 'os', label: 'OS' }] },
        'd',
      ),
    );

    expect(svg.querySelector('.memory-free-list-arrow')).toBeNull();
  });

  it('clock page replacement draws one label and divider per entry plus a pointer', () => {
    const svg = svgOf(renderClockPageReplacementDiagram(clock, 'd'));

    expect([...svg.querySelectorAll('text')].map((text) => text.textContent)).toEqual([
      '3, 1',
      '5, 0',
      '7, 1',
    ]);
    expect(svg.querySelectorAll('.clock-divider')).toHaveLength(3);
    expect(svg.querySelector('.clock-pointer')?.getAttribute('marker-end')).toMatch(
      /^url\(#clock-arrow-/,
    );
  });

  it('gives different diagrams different marker ids', () => {
    const first = svgOf(renderDiagram(clock, 'd')).querySelector('marker')?.id;
    const second = svgOf(renderDiagram({ ...clock, pointerIndex: 2 }, 'd')).querySelector(
      'marker',
    )?.id;

    expect(first).not.toBe(second);
  });

  it('renders nothing for an unknown diagram type', () => {
    expect(renderDiagram({ type: 'nope' } as unknown as ChoiceDiagram, 'd')).toBe('');
  });
});

describe('data-table diagram', () => {
  const table: DataTableDiagram = {
    type: 'data-table',
    columns: ['프로세스', '도착 \\$', '$t$'],
    rows: [
      ['P1', '0', ' '],
      ['P2', '==3==', '`x`'],
    ],
  };

  it('renders a real table with a visually hidden caption and column headers', () => {
    const container = mount(renderDataTableDiagram(table, 'choice-diagram'));
    const tableElement = container.querySelector('table');

    expect(container.querySelector('[role="img"]')).toBeNull();
    expect(container.firstElementChild?.classList.contains('data-table-diagram')).toBe(true);
    expect(tableElement?.querySelector('caption')?.textContent).toBe('표: 프로세스, 도착 $, $t$');
    expect(tableElement?.querySelector('caption')?.classList.contains('sr-only')).toBe(true);
    const headers = [...container.querySelectorAll('thead th')];
    expect(headers).toHaveLength(3);
    expect(headers.every((th) => th.getAttribute('scope') === 'col')).toBe(true);
    expect(headers[2]?.innerHTML).toContain('katex');
    expect(container.querySelectorAll('tbody tr')).toHaveLength(2);
  });

  it('keeps blank cells as cells and renders rich text in text tables', () => {
    const container = mount(renderDataTableDiagram(table, 'd'));
    const firstRow = [...container.querySelectorAll('tbody tr')[0]!.querySelectorAll('td')];
    const secondRow = [...container.querySelectorAll('tbody tr')[1]!.querySelectorAll('td')];

    expect(firstRow).toHaveLength(3);
    expect(firstRow[2]?.textContent).toBe(' ');
    expect(secondRow[1]?.querySelector('mark.text-highlight')?.textContent).toBe('3');
    expect(secondRow[2]?.querySelector('code.inline-code')?.textContent).toBe('x');
    expect(container.querySelector('pre')).toBeNull();
  });

  it('renders code tables as escaped pre/code cells without rich text', () => {
    const container = mount(
      renderDataTableDiagram(
        {
          type: 'data-table',
          cellFormat: 'code',
          columns: ['코드'],
          rows: [['if (a < b) {\n  x = $y$;\n}\n'], [' '], ['==keep==']],
        },
        'd',
      ),
    );
    const cells = [...container.querySelectorAll('tbody td')];

    expect(container.querySelector('table')?.classList.contains('data-table-code')).toBe(true);
    expect(cells.every((cell) => cell.querySelector(':scope > pre > code'))).toBe(true);
    expect(cells[0]?.querySelector('code')?.textContent).toBe('if (a < b) {\n  x = $y$;\n}');
    expect(cells[0]?.innerHTML).not.toContain('katex');
    expect(cells[1]?.querySelector('code')?.textContent).toBe('');
    expect(cells[2]?.querySelector('mark')).toBeNull();
    expect(cells[2]?.textContent).toBe('==keep==');
  });

  it('falls back to a plain caption when every column is blank', () => {
    const container = mount(
      renderDataTableDiagram({ type: 'data-table', columns: [' ', ''], rows: [] }, 'd'),
    );

    expect(container.querySelector('caption')?.textContent).toBe('표');
  });
});
