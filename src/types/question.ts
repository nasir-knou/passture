import type { SourceKind } from './catalog';

export type QuestionType = 'multiple-choice' | 'multi-answer' | 'ox';
export type PassageType = 'text' | 'code' | 'image' | 'diagram';

export interface QuestionFile {
  subjectId: string;
  sourceId: string;
  title: string;
  kind: SourceKind;
  year?: number;
  passages?: Passage[];
  questions: Question[];
}

export interface Passage {
  id: string;
  type: PassageType;
  language?: string;
  body?: string;
  image?: QuestionImage;
  diagram?: ChoiceDiagram;
}

export interface Question {
  id: string;
  type: QuestionType;
  passageRefs?: string[];
  prompt: string;
  images?: QuestionImage[];
  choices: Choice[];
  answers: string[];
  answerKey?: string;
  allowMultiple?: boolean;
  explanation: string;
  tags?: string[];
}

export interface Choice {
  id: string;
  text: string;
  image?: QuestionImage;
  diagram?: ChoiceDiagram;
}

export interface QuestionImage {
  path: string;
  alt: string;
}

export type ChoiceDiagram =
  | ResourceAllocationGraphDiagram
  | MemoryFreeListDiagram
  | DataTableDiagram
  | ClockPageReplacementDiagram;

export interface ResourceAllocationGraphDiagram {
  type: 'resource-allocation-graph';
  width: number;
  height: number;
  nodes: ResourceAllocationGraphNode[];
  edges: ResourceAllocationGraphEdge[];
}

export interface ResourceAllocationGraphNode {
  id: string;
  kind: 'process' | 'resource';
  label: string;
  x: number;
  y: number;
  units?: number;
}

export interface ResourceAllocationGraphEdge {
  from: string;
  style?: 'solid' | 'dashed';
  to: string;
}

export interface MemoryFreeListDiagram {
  type: 'memory-free-list';
  width: number;
  height: number;
  blocks: MemoryFreeListBlock[];
}

export interface MemoryFreeListBlock {
  id: string;
  kind: 'os' | 'allocated' | 'free';
  label: string;
  size?: number;
}

export interface DataTableDiagram {
  type: 'data-table';
  columns: string[];
  rows: string[][];
}

export interface ClockPageReplacementDiagram {
  type: 'clock-page-replacement';
  width: number;
  height: number;
  entries: ClockPageReplacementEntry[];
  pointerIndex: number;
}

export interface ClockPageReplacementEntry {
  page: string;
  referenceBit: 0 | 1;
}
