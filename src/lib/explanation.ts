export interface ParsedExplanation {
  choiceReasons: Map<string, string>;
  coreLines: string[];
  noteLines: string[];
  otherLines: string[];
}

export interface ChoiceExplanationLine {
  id: string;
  reason: string;
}

// id에는 ':'를 넣지 않는다. 이유가 ':'로 시작하면(예: "선택지 1: :는 ex 명령") id가 "1:"로 잘못 잡힌다.
const CHOICE_LINE_PATTERN = /^선택지\s+([^\s(:]+)\s*(?:\((?:정답|오답)\))?\s*:\s*(.+)$/;

export function isNoteLine(line: string): boolean {
  return line.trim().startsWith('※');
}

/** `선택지 N: 이유` / `선택지 N (정답): 이유` 줄을 id와 이유로 나눈다. 해당 형식이 아니면 undefined. */
export function parseChoiceExplanationLine(line: string): ChoiceExplanationLine | undefined {
  const match = line.trim().match(CHOICE_LINE_PATTERN);
  return match ? { id: match[1], reason: match[2] } : undefined;
}

export function parseChoiceExplanation(explanation: string): ParsedExplanation {
  const choiceReasons = new Map<string, string>();
  const coreLines: string[] = [];
  const noteLines: string[] = [];
  const otherLines: string[] = [];
  let section: 'other' | 'core' = 'other';

  for (const rawLine of explanation.split('\n')) {
    const line = rawLine.trim();

    if (line.length === 0) {
      continue;
    }

    if (isNoteLine(line)) {
      noteLines.push(line);
      continue;
    }

    const choiceLine = parseChoiceExplanationLine(line);
    if (choiceLine) {
      choiceReasons.set(choiceLine.id, choiceLine.reason);
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
    noteLines,
    otherLines,
  };
}
