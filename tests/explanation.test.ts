import { describe, expect, it } from 'vitest';

import {
  isNoteLine,
  parseChoiceExplanation,
  parseChoiceExplanationLine,
} from '../src/lib/explanation';

describe('parseChoiceExplanationLine', () => {
  it.each([
    ['선택지 1: 이유', { id: '1', reason: '이유' }],
    ['선택지 2 (정답): 맞는 설명', { id: '2', reason: '맞는 설명' }],
    ['선택지 3(오답) : 틀린 설명', { id: '3', reason: '틀린 설명' }],
    ['  선택지 O: 참  ', { id: 'O', reason: '참' }],
    ['선택지 1: :는 ex 명령', { id: '1', reason: ':는 ex 명령' }],
    ['선택지 4: a: b: c', { id: '4', reason: 'a: b: c' }],
  ])('parses %j', (line, expected) => {
    expect(parseChoiceExplanationLine(line)).toEqual(expected);
  });

  it.each([
    '선택지1: 공백 없음',
    '선택지 1 이유만',
    '선택지 1:',
    '선택지 1:   ',
    '선택지 (정답): id 없음',
    '보기 1: 다른 접두어',
    '※ 선택지 1: 주석',
  ])('rejects %j', (line) => {
    expect(parseChoiceExplanationLine(line)).toBeUndefined();
  });
});

describe('isNoteLine', () => {
  it('detects ※ notes after leading whitespace only', () => {
    expect(isNoteLine('  ※ 원본 오류')).toBe(true);
    expect(isNoteLine('설명 ※ 중간')).toBe(false);
  });
});

describe('parseChoiceExplanation', () => {
  it('splits choice reasons, core lines, notes and other lines', () => {
    const parsed = parseChoiceExplanation(
      [
        '도입 설명',
        '',
        '선택지 1 (정답): 맞다',
        '※ 인쇄 정답은 2번',
        '핵심 개념:',
        '  첫 줄  ',
        '선택지 2: 핵심 뒤의 선택지 줄도 이유로 간다',
        '※ 핵심 뒤 주석',
        '둘째 줄',
      ].join('\n'),
    );

    expect(Object.fromEntries(parsed.choiceReasons)).toEqual({
      '1': '맞다',
      '2': '핵심 뒤의 선택지 줄도 이유로 간다',
    });
    expect(parsed.otherLines).toEqual(['도입 설명']);
    expect(parsed.coreLines).toEqual(['첫 줄', '둘째 줄']);
    expect(parsed.noteLines).toEqual(['※ 인쇄 정답은 2번', '※ 핵심 뒤 주석']);
  });

  it('accepts the core header without a colon and keeps the last reason for duplicate ids', () => {
    const parsed = parseChoiceExplanation('선택지 1: 처음\n핵심 개념\n개념\n선택지 1: 나중');

    expect(parsed.choiceReasons.get('1')).toBe('나중');
    expect(parsed.coreLines).toEqual(['개념']);
    expect(parsed.otherLines).toEqual([]);
  });

  it('does not treat a core header with extra text as a section switch', () => {
    const parsed = parseChoiceExplanation('핵심 개념: 스케줄링\n다음 줄');

    expect(parsed.coreLines).toEqual([]);
    expect(parsed.otherLines).toEqual(['핵심 개념: 스케줄링', '다음 줄']);
  });

  it('returns empty collections for blank input', () => {
    const parsed = parseChoiceExplanation('\n  \n');

    expect(parsed.choiceReasons.size).toBe(0);
    expect(parsed.coreLines).toEqual([]);
    expect(parsed.noteLines).toEqual([]);
    expect(parsed.otherLines).toEqual([]);
  });
});
