import type { SourceKind } from '../types/catalog';
import type { Question } from '../types/question';
import type { Syllabus } from '../types/syllabus';

export type SourceCategory = 'lecture' | 'material' | 'exam';

export const sourceCategories: readonly SourceCategory[] = ['lecture', 'material', 'exam'];

export function sourceCategory(kind: SourceKind): SourceCategory {
  switch (kind) {
    case 'exam':
      return 'exam';
    case 'textbook':
    case 'workbook':
      return 'material';
    case 'lecture':
    case 'intensive':
      return 'lecture';
  }
}

export function sourceCategoryLabel(category: SourceCategory): string {
  switch (category) {
    case 'lecture':
      return '강의';
    case 'material':
      return '교재';
    case 'exam':
      return '기출';
  }
}

/** 교재·워크북·강의 문제 ID의 첫 숫자 그룹. 예: b03-07 → 3, l11-04 → 11 */
export function parseQuestionGroup(questionId: string): number {
  const match = /^[a-z]+(\d+)/i.exec(questionId);
  return match ? Number(match[1]) : 0;
}

/**
 * 문제의 주 교재 장 번호를 구한다. outdated 문제이거나 장을 정할 수 없으면 undefined.
 * - 명시한 `chapter`가 있으면 우선한다.
 * - 교재·워크북은 ID 그룹이 곧 장 번호다.
 * - 강의는 ID 그룹(강 번호)을 syllabus.lectures로 장에 연결하고, 첫 장을 주 장으로 쓴다.
 * - 기출과 특강은 번호가 교재 장·강과 무관하므로 `chapter`를 직접 적어야 한다.
 */
export function resolveQuestionChapter(
  question: Pick<Question, 'id' | 'chapter' | 'outdated'>,
  kind: SourceKind,
  syllabus: Pick<Syllabus, 'lectures'>,
): number | undefined {
  if (question.outdated) {
    return undefined;
  }

  if (question.chapter !== undefined) {
    return question.chapter;
  }

  const group = parseQuestionGroup(question.id);

  switch (kind) {
    case 'textbook':
    case 'workbook':
      return group || undefined;
    case 'lecture':
      return syllabus.lectures.find((lecture) => lecture.no === group)?.chapters[0];
    case 'intensive':
    case 'exam':
      return undefined;
  }
}

export function chapterLabel(chapter: number): string {
  return `${chapter}장`;
}
