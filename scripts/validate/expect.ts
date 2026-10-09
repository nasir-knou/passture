import type { SourceKind } from '../../src/types/catalog';

/** YAML 검증에서 공통으로 쓰는 타입 단언 헬퍼. 실패하면 필드 경로를 담은 Error를 던진다. */

export function expectRecord(value: unknown, fieldPath: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error(`${fieldPath} must be an object`);
  }

  return value as Record<string, unknown>;
}

export function expectArray(value: unknown, fieldPath: string): unknown[] {
  if (!Array.isArray(value)) {
    throw new Error(`${fieldPath} must be an array`);
  }

  return value;
}

export function expectString(value: unknown, fieldPath: string): string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`${fieldPath} must be a non-empty string`);
  }

  return value;
}

export function expectNumber(value: unknown, fieldPath: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`${fieldPath} must be a number`);
  }

  return value;
}

export function expectPositiveNumber(value: unknown, fieldPath: string): number {
  const number = expectNumber(value, fieldPath);
  if (number <= 0) {
    throw new Error(`${fieldPath} must be a positive number`);
  }

  return number;
}

export function expectNonNegativeNumber(value: unknown, fieldPath: string): number {
  const number = expectNumber(value, fieldPath);
  if (number < 0) {
    throw new Error(`${fieldPath} must be a non-negative number`);
  }

  return number;
}

export function expectPositiveInteger(value: unknown, fieldPath: string): number {
  const number = expectNumber(value, fieldPath);
  if (!Number.isInteger(number) || number < 1) {
    throw new Error(`${fieldPath} must be a positive integer`);
  }

  return number;
}

export function expectBoolean(value: unknown, fieldPath: string): boolean {
  if (typeof value !== 'boolean') {
    throw new Error(`${fieldPath} must be boolean`);
  }

  return value;
}

/** 허용 값 목록 중 하나인 문자열인지 확인한다. */
export function expectOneOf<T extends string>(
  value: unknown,
  allowed: readonly T[],
  fieldPath: string,
): T {
  const text = expectString(value, fieldPath);
  if (!(allowed as readonly string[]).includes(text)) {
    throw new Error(`${fieldPath} must be one of ${allowed.join(', ')}; got ${text}`);
  }

  return text as T;
}

// 16진 색(#rgb, #rrggbb) 또는 CSS 색 이름(red, steelblue 등)만 허용한다. 렌더러가 style 속성에 그대로 넣는다.
const COLOR_PATTERN = /^(#[0-9a-f]{3}|#[0-9a-f]{6}|[a-z]+)$/i;

export function expectColor(value: unknown, fieldPath: string): string {
  const color = expectString(value, fieldPath);
  if (!COLOR_PATTERN.test(color)) {
    throw new Error(`${fieldPath} must be a hex color (#rgb or #rrggbb) or a CSS color name`);
  }

  return color;
}

/** 렌더러가 읽지 않는 키는 조용히 무시되므로, 허용 목록에 없는 키가 있으면 실패시킨다. */
export function expectKnownKeys(
  record: Record<string, unknown>,
  allowed: readonly string[],
  fieldPath: string,
  hint = '',
): void {
  const unknownKeys = Object.keys(record).filter((key) => !allowed.includes(key));
  if (unknownKeys.length > 0) {
    throw new Error(`${fieldPath} has unknown keys (${unknownKeys.join(', ')})${hint}`);
  }
}

export function expectUnique(seen: Set<string>, value: string, fieldPath: string): void {
  if (seen.has(value)) {
    throw new Error(`${fieldPath} must be unique: ${value}`);
  }

  seen.add(value);
}

export const SOURCE_KINDS: readonly SourceKind[] = [
  'exam',
  'textbook',
  'workbook',
  'lecture',
  'intensive',
];

export function expectSourceKind(value: string, fieldPath: string): asserts value is SourceKind {
  if (!(SOURCE_KINDS as readonly string[]).includes(value)) {
    throw new Error(`${fieldPath} must be exam, textbook, workbook, lecture, or intensive`);
  }
}

export function expectSemester(value: unknown, fieldPath: string): asserts value is 1 | 2 {
  if (value !== 1 && value !== 2) {
    throw new Error(`${fieldPath} must be 1 or 2`);
  }
}
