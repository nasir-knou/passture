import {
  expectArray,
  expectBoolean,
  expectColor,
  expectKnownKeys,
  expectNonNegativeNumber,
  expectNumber,
  expectOneOf,
  expectPositiveNumber,
  expectRecord,
  expectString,
  expectUnique,
} from './expect';
import { validateRichText } from './rich-text';

/**
 * 도식 타입별 허용 키. src/types/question.ts의 인터페이스와 src/pages/rendering.ts가 실제로 읽는 필드를 따른다.
 * 렌더러가 읽지 않는 키(예: 자원 할당 그래프 노드의 shape)는 조용히 무시되므로 받지 않는다.
 */
const RAG_KEYS = ['type', 'width', 'height', 'nodes', 'edges'];
const RAG_NODE_KEYS = ['id', 'kind', 'label', 'x', 'y', 'units'];
const RAG_EDGE_KEYS = ['from', 'to', 'style', 'label', 'labelDx', 'labelDy'];

const SIMPLE_GRAPH_KEYS = ['type', 'width', 'height', 'directed', 'nodes', 'edges'];
const SIMPLE_GRAPH_NODE_KEYS = [
  'id',
  'label',
  'x',
  'y',
  'fillColor',
  'strokeColor',
  'strokeWidth',
  'textColor',
  'fontSize',
  'hideLabel',
  'hideNode',
  'labelDx',
  'labelDy',
  'radius',
  'shape',
  'width',
  'height',
  'tone',
  'underline',
];
const SIMPLE_GRAPH_EDGE_KEYS = ['from', 'to', 'label', 'directed', 'curve', 'style'];

const UI_WINDOW_KEYS = ['type', 'width', 'height', 'title', 'components'];
const UI_WINDOW_COMPONENT_KEYS = ['kind', 'label', 'x', 'y', 'checked', 'focused'];

const MEMORY_FREE_LIST_KEYS = ['type', 'width', 'height', 'blocks'];
const MEMORY_BLOCK_KEYS = ['id', 'kind', 'label', 'size'];

const DATA_TABLE_KEYS = ['type', 'cellFormat', 'columns', 'rows'];

const CLOCK_KEYS = ['type', 'width', 'height', 'entries', 'pointerIndex'];
const CLOCK_ENTRY_KEYS = ['page', 'referenceBit'];

const EDGE_STYLES = ['solid', 'dashed'] as const;
const SIMPLE_GRAPH_SHAPES = ['circle', 'box', 'diamond', 'ellipse'] as const;
const SIMPLE_GRAPH_TONES = ['filled'] as const;

export function validateChoiceDiagram(value: unknown, fieldPath: string): void {
  const diagram = expectRecord(value, fieldPath);
  const type = expectString(diagram.type, `${fieldPath}.type`);

  switch (type) {
    case 'resource-allocation-graph':
      validateResourceAllocationGraphDiagram(diagram, fieldPath);
      return;
    case 'simple-graph':
      validateSimpleGraphDiagram(diagram, fieldPath);
      return;
    case 'ui-window':
      validateUiWindowDiagram(diagram, fieldPath);
      return;
    case 'memory-free-list':
      validateMemoryFreeListDiagram(diagram, fieldPath);
      return;
    case 'data-table':
      validateDataTableDiagram(diagram, fieldPath);
      return;
    case 'clock-page-replacement':
      validateClockPageReplacementDiagram(diagram, fieldPath);
      return;
    default:
      throw new Error(
        `${fieldPath}.type must be resource-allocation-graph, simple-graph, ui-window, memory-free-list, data-table, or clock-page-replacement`,
      );
  }
}

function validateDiagramSize(diagram: Record<string, unknown>, fieldPath: string): void {
  expectPositiveNumber(diagram.width, `${fieldPath}.width`);
  expectPositiveNumber(diagram.height, `${fieldPath}.height`);
}

function validateResourceAllocationGraphDiagram(
  diagram: Record<string, unknown>,
  fieldPath: string,
): void {
  expectKnownKeys(diagram, RAG_KEYS, fieldPath);
  validateDiagramSize(diagram, fieldPath);

  const nodes = expectArray(diagram.nodes, `${fieldPath}.nodes`);
  const nodeIds = new Set<string>();

  for (const [nodeIndex, rawNode] of nodes.entries()) {
    const nodePath = `${fieldPath}.nodes[${nodeIndex}]`;
    const node = expectRecord(rawNode, nodePath);
    // 자원 할당 그래프 노드는 원·사각형 크기가 고정이라 simple-graph의 모양·스타일 키를 읽지 않는다.
    expectKnownKeys(node, RAG_NODE_KEYS, nodePath);
    const id = expectString(node.id, `${nodePath}.id`);
    expectUnique(nodeIds, id, `${nodePath}.id`);
    expectOneOf(node.kind, ['process', 'resource'], `${nodePath}.kind`);
    // 라벨은 수식 렌더링 없이 escape되어 SVG 텍스트로 나간다.
    expectString(node.label, `${nodePath}.label`);
    expectNumber(node.x, `${nodePath}.x`);
    expectNumber(node.y, `${nodePath}.y`);

    if (node.units !== undefined) {
      expectPositiveNumber(node.units, `${nodePath}.units`);
    }
  }

  const edges = expectArray(diagram.edges, `${fieldPath}.edges`);
  for (const [edgeIndex, rawEdge] of edges.entries()) {
    const edgePath = `${fieldPath}.edges[${edgeIndex}]`;
    const edge = expectRecord(rawEdge, edgePath);
    expectKnownKeys(edge, RAG_EDGE_KEYS, edgePath);
    const from = expectString(edge.from, `${edgePath}.from`);
    const to = expectString(edge.to, `${edgePath}.to`);

    if (edge.style !== undefined) {
      expectOneOf(edge.style, EDGE_STYLES, `${edgePath}.style`);
    }
    if (edge.label !== undefined) {
      expectString(edge.label, `${edgePath}.label`);
    }
    if (edge.labelDx !== undefined) {
      expectNumber(edge.labelDx, `${edgePath}.labelDx`);
    }
    if (edge.labelDy !== undefined) {
      expectNumber(edge.labelDy, `${edgePath}.labelDy`);
    }

    if (!nodeIds.has(from)) {
      throw new Error(`${edgePath}.from references missing node`);
    }
    if (!nodeIds.has(to)) {
      throw new Error(`${edgePath}.to references missing node`);
    }
  }
}

function validateSimpleGraphDiagram(diagram: Record<string, unknown>, fieldPath: string): void {
  expectKnownKeys(diagram, SIMPLE_GRAPH_KEYS, fieldPath);
  validateDiagramSize(diagram, fieldPath);

  if (diagram.directed !== undefined) {
    expectBoolean(diagram.directed, `${fieldPath}.directed`);
  }

  const nodes = expectArray(diagram.nodes, `${fieldPath}.nodes`);
  const nodeIds = new Set<string>();

  for (const [nodeIndex, rawNode] of nodes.entries()) {
    const nodePath = `${fieldPath}.nodes[${nodeIndex}]`;
    const node = expectRecord(rawNode, nodePath);
    expectKnownKeys(node, SIMPLE_GRAPH_NODE_KEYS, nodePath);
    const id = expectString(node.id, `${nodePath}.id`);
    expectUnique(nodeIds, id, `${nodePath}.id`);
    // 노드 라벨은 renderMathText로 그려진다.
    validateRichText(expectString(node.label, `${nodePath}.label`), `${nodePath}.label`);
    expectNumber(node.x, `${nodePath}.x`);
    expectNumber(node.y, `${nodePath}.y`);

    for (const key of ['hideLabel', 'hideNode', 'underline']) {
      if (node[key] !== undefined) {
        expectBoolean(node[key], `${nodePath}.${key}`);
      }
    }
    for (const key of ['labelDx', 'labelDy']) {
      if (node[key] !== undefined) {
        expectNumber(node[key], `${nodePath}.${key}`);
      }
    }
    // radius 0은 점 없이 라벨만 그리는 노드에 쓴다.
    if (node.radius !== undefined) {
      expectNonNegativeNumber(node.radius, `${nodePath}.radius`);
    }
    for (const key of ['fontSize', 'width', 'height', 'strokeWidth']) {
      if (node[key] !== undefined) {
        expectPositiveNumber(node[key], `${nodePath}.${key}`);
      }
    }
    for (const key of ['fillColor', 'strokeColor', 'textColor']) {
      if (node[key] !== undefined) {
        expectColor(node[key], `${nodePath}.${key}`);
      }
    }
    if (node.shape !== undefined) {
      expectOneOf(node.shape, SIMPLE_GRAPH_SHAPES, `${nodePath}.shape`);
    }
    if (node.tone !== undefined) {
      expectOneOf(node.tone, SIMPLE_GRAPH_TONES, `${nodePath}.tone`);
    }
  }

  const edges = expectArray(diagram.edges, `${fieldPath}.edges`);
  for (const [edgeIndex, rawEdge] of edges.entries()) {
    const edgePath = `${fieldPath}.edges[${edgeIndex}]`;
    const edge = expectRecord(rawEdge, edgePath);
    expectKnownKeys(edge, SIMPLE_GRAPH_EDGE_KEYS, edgePath);
    const from = expectString(edge.from, `${edgePath}.from`);
    const to = expectString(edge.to, `${edgePath}.to`);

    if (!nodeIds.has(from)) {
      throw new Error(`${edgePath}.from references missing node`);
    }
    if (!nodeIds.has(to)) {
      throw new Error(`${edgePath}.to references missing node`);
    }

    if (edge.label !== undefined) {
      // 간선 라벨도 renderMathText로 그려진다.
      validateRichText(expectString(edge.label, `${edgePath}.label`), `${edgePath}.label`);
    }
    if (edge.directed !== undefined) {
      expectBoolean(edge.directed, `${edgePath}.directed`);
    }
    if (edge.curve !== undefined) {
      expectNumber(edge.curve, `${edgePath}.curve`);
    }
    if (edge.style !== undefined) {
      expectOneOf(edge.style, EDGE_STYLES, `${edgePath}.style`);
    }
  }
}

function validateUiWindowDiagram(diagram: Record<string, unknown>, fieldPath: string): void {
  expectKnownKeys(diagram, UI_WINDOW_KEYS, fieldPath);
  validateDiagramSize(diagram, fieldPath);
  validateRichText(expectString(diagram.title, `${fieldPath}.title`), `${fieldPath}.title`);

  const components = expectArray(diagram.components, `${fieldPath}.components`);
  if (components.length === 0) {
    throw new Error(`${fieldPath}.components must not be empty`);
  }

  for (const [componentIndex, rawComponent] of components.entries()) {
    const componentPath = `${fieldPath}.components[${componentIndex}]`;
    const component = expectRecord(rawComponent, componentPath);
    expectKnownKeys(component, UI_WINDOW_COMPONENT_KEYS, componentPath);
    expectOneOf(component.kind, ['checkbox', 'radio', 'label'], `${componentPath}.kind`);
    validateRichText(
      expectString(component.label, `${componentPath}.label`),
      `${componentPath}.label`,
    );
    expectNumber(component.x, `${componentPath}.x`);
    expectNumber(component.y, `${componentPath}.y`);

    if (component.checked !== undefined) {
      expectBoolean(component.checked, `${componentPath}.checked`);
    }
    if (component.focused !== undefined) {
      expectBoolean(component.focused, `${componentPath}.focused`);
    }
  }
}

function validateMemoryFreeListDiagram(diagram: Record<string, unknown>, fieldPath: string): void {
  expectKnownKeys(diagram, MEMORY_FREE_LIST_KEYS, fieldPath);
  validateDiagramSize(diagram, fieldPath);

  const blocks = expectArray(diagram.blocks, `${fieldPath}.blocks`);
  const blockIds = new Set<string>();

  for (const [blockIndex, rawBlock] of blocks.entries()) {
    const blockPath = `${fieldPath}.blocks[${blockIndex}]`;
    const block = expectRecord(rawBlock, blockPath);
    expectKnownKeys(block, MEMORY_BLOCK_KEYS, blockPath);
    const id = expectString(block.id, `${blockPath}.id`);
    expectUnique(blockIds, id, `${blockPath}.id`);
    expectOneOf(block.kind, ['os', 'allocated', 'free'], `${blockPath}.kind`);
    expectString(block.label, `${blockPath}.label`);

    if (block.size !== undefined) {
      expectPositiveNumber(block.size, `${blockPath}.size`);
    }
  }
}

function validateDataTableDiagram(diagram: Record<string, unknown>, fieldPath: string): void {
  expectKnownKeys(diagram, DATA_TABLE_KEYS, fieldPath);

  if (diagram.cellFormat !== undefined) {
    expectOneOf(diagram.cellFormat, ['text', 'code'], `${fieldPath}.cellFormat`);
  }

  const columns = expectArray(diagram.columns, `${fieldPath}.columns`);
  if (columns.length === 0) {
    throw new Error(`${fieldPath}.columns must not be empty`);
  }

  for (const [columnIndex, column] of columns.entries()) {
    // 머리글은 cellFormat과 관계없이 항상 리치 텍스트로 그려진다.
    const columnPath = `${fieldPath}.columns[${columnIndex}]`;
    validateRichText(expectString(column, columnPath), columnPath);
  }

  const rows = expectArray(diagram.rows, `${fieldPath}.rows`);
  if (rows.length === 0) {
    throw new Error(`${fieldPath}.rows must not be empty`);
  }

  for (const [rowIndex, rawRow] of rows.entries()) {
    const row = expectArray(rawRow, `${fieldPath}.rows[${rowIndex}]`);
    if (row.length !== columns.length) {
      throw new Error(`${fieldPath}.rows[${rowIndex}] must have ${columns.length} cells`);
    }

    for (const [cellIndex, cell] of row.entries()) {
      const cellPath = `${fieldPath}.rows[${rowIndex}][${cellIndex}]`;
      const text = expectString(cell, cellPath);
      if (diagram.cellFormat !== 'code') {
        validateRichText(text, cellPath);
      }
    }
  }
}

function validateClockPageReplacementDiagram(
  diagram: Record<string, unknown>,
  fieldPath: string,
): void {
  expectKnownKeys(diagram, CLOCK_KEYS, fieldPath);
  validateDiagramSize(diagram, fieldPath);

  const entries = expectArray(diagram.entries, `${fieldPath}.entries`);
  if (entries.length === 0) {
    throw new Error(`${fieldPath}.entries must not be empty`);
  }

  for (const [entryIndex, rawEntry] of entries.entries()) {
    const entryPath = `${fieldPath}.entries[${entryIndex}]`;
    const entry = expectRecord(rawEntry, entryPath);
    expectKnownKeys(entry, CLOCK_ENTRY_KEYS, entryPath);
    expectString(entry.page, `${entryPath}.page`);

    if (entry.referenceBit !== 0 && entry.referenceBit !== 1) {
      throw new Error(`${entryPath}.referenceBit must be 0 or 1`);
    }
  }

  const pointerIndex = expectNumber(diagram.pointerIndex, `${fieldPath}.pointerIndex`);
  if (pointerIndex < 0 || pointerIndex >= entries.length || !Number.isInteger(pointerIndex)) {
    throw new Error(`${fieldPath}.pointerIndex must point to an entry index`);
  }
}
