import type { CatalogSource, CatalogSubject } from '../types/catalog';
import type { Syllabus } from '../types/syllabus';
import {
  resolveQuestionChapter,
  sourceCategories,
  sourceCategory,
  type SourceCategory,
} from './chapter';
import { loadQuestionFile, loadSyllabus } from './data-loader';
import {
  chapterSelectionKey,
  type LoadedQuestionSource,
  type QuizSessionQuestion,
  type SessionGrouping,
} from './quiz-session';

export interface ChapterSelection {
  subjectId: string;
  chapters: number[];
  categories: SourceCategory[];
}

export interface ChapterIndexSource extends LoadedQuestionSource {
  kind: CatalogSource['kind'];
  category: SourceCategory;
  order: number;
}

export interface ChapterIndex {
  subject: CatalogSubject;
  syllabus: Syllabus;
  sources: ChapterIndexSource[];
  /** 문제 키 → 주 장 번호. outdated 문제는 포함하지 않는다. */
  chapterByKey: Map<string, number>;
  /** 문제 키 → 문제 종류 */
  categoryByKey: Map<string, SourceCategory>;
  /** 장 번호 → 문제 종류별 문제 수 */
  counts: Map<number, Record<SourceCategory, number>>;
  outdatedCount: number;
}

export function saveChapterSelection(selection: ChapterSelection): void {
  sessionStorage.setItem(chapterSelectionKey, JSON.stringify(selection));
  sessionStorage.removeItem('pt.currentSession');
}

export function clearChapterSelection(): void {
  sessionStorage.removeItem(chapterSelectionKey);
}

export function loadChapterSelection(): ChapterSelection | undefined {
  const raw = sessionStorage.getItem(chapterSelectionKey);
  if (!raw) {
    return undefined;
  }

  try {
    return normalizeChapterSelection(JSON.parse(raw) as unknown);
  } catch {
    sessionStorage.removeItem(chapterSelectionKey);
    return undefined;
  }
}

export async function loadChapterIndex(subject: CatalogSubject): Promise<ChapterIndex> {
  if (!subject.syllabus) {
    throw new Error(`${subject.id} 과목에는 챕터 정보가 없습니다.`);
  }

  const [syllabus, sources] = await Promise.all([
    loadSyllabus(subject.syllabus),
    Promise.all(
      subject.sources.map<Promise<ChapterIndexSource>>(async (source, order) => ({
        subjectId: subject.id,
        subjectTitle: subject.title,
        sourceId: source.id,
        sourceTitle: source.title,
        path: source.path,
        kind: source.kind,
        category: sourceCategory(source.kind),
        order,
        file: await loadQuestionFile(source.path),
      })),
    ),
  ]);

  return buildChapterIndex(subject, syllabus, sources);
}

export function buildChapterIndex(
  subject: CatalogSubject,
  syllabus: Syllabus,
  sources: ChapterIndexSource[],
): ChapterIndex {
  const chapterByKey = new Map<string, number>();
  const categoryByKey = new Map<string, SourceCategory>();
  const counts = new Map<number, Record<SourceCategory, number>>(
    syllabus.chapters.map((chapter) => [chapter.no, emptyCategoryCounts()]),
  );
  let outdatedCount = 0;

  for (const source of sources) {
    for (const question of source.file.questions) {
      const chapter = resolveQuestionChapter(question, source.kind, syllabus);
      if (chapter === undefined) {
        if (question.outdated) {
          outdatedCount += 1;
        }
        continue;
      }

      const key = `${source.subjectId}:${source.sourceId}:${question.id}`;
      chapterByKey.set(key, chapter);
      categoryByKey.set(key, source.category);
      const chapterCounts = counts.get(chapter);
      if (chapterCounts) {
        chapterCounts[source.category] += 1;
      }
    }
  }

  return { subject, syllabus, sources, chapterByKey, categoryByKey, counts, outdatedCount };
}

/** 선택한 장·문제 종류(와 북마크/오답 범위)에 해당하는 문제 수. 세션의 include 필터와 같은 기준이다. */
export function countSelectedQuestions(
  index: ChapterIndex,
  selection: ChapterSelection,
  allowedKeys?: ReadonlySet<string>,
): number {
  const chapters = new Set(selection.chapters);
  const categories = new Set(selection.categories);
  let count = 0;

  for (const [key, chapter] of index.chapterByKey) {
    const category = index.categoryByKey.get(key);
    if (
      chapters.has(chapter) &&
      category !== undefined &&
      categories.has(category) &&
      (!allowedKeys || allowedKeys.has(key))
    ) {
      count += 1;
    }
  }

  return count;
}

export interface ChapterSessionInput {
  sources: LoadedQuestionSource[];
  include: (key: string) => boolean;
  grouping: SessionGrouping;
}

/** 선택한 장·문제 종류에 맞는 출처와 필터, 기본 정렬(장 → 강의·교재·기출 → 출처 순서)을 만든다. */
export function createChapterSessionInput(
  index: ChapterIndex,
  selection: ChapterSelection,
): ChapterSessionInput {
  const chapters = new Set(selection.chapters);
  const sources = index.sources.filter((source) => selection.categories.includes(source.category));
  const sourceRank = new Map(
    sources.map((source) => [
      `${source.subjectId}:${source.sourceId}`,
      sourceCategories.indexOf(source.category) * 1000 + source.order,
    ]),
  );
  const chapterOf = (key: string) => index.chapterByKey.get(key);
  const rankOf = (question: QuizSessionQuestion) =>
    sourceRank.get(`${question.subjectId}:${question.sourceId}`) ?? 0;

  return {
    sources,
    include: (key) => {
      const chapter = chapterOf(key);
      return chapter !== undefined && chapters.has(chapter);
    },
    grouping: {
      // 강 → 장 대응이 바뀌면 같은 선택이라도 세션을 새로 만든다.
      signature: `lectures:${index.syllabus.lectures
        .map((lecture) => `${lecture.no}>${lecture.chapters[0] ?? ''}`)
        .join(
          ',',
        )}|chapters:${[...chapters].sort((a, b) => a - b).join(',')}|categories:${sourceCategories
        .filter((category) => selection.categories.includes(category))
        .join(',')}`,
      chapterOf,
      // Array.prototype.sort는 안정 정렬이라 같은 출처 안에서는 문제 파일 순서가 유지된다.
      compare: (left, right) =>
        (left.chapter ?? 0) - (right.chapter ?? 0) || rankOf(left) - rankOf(right),
    },
  };
}

function emptyCategoryCounts(): Record<SourceCategory, number> {
  return { lecture: 0, material: 0, exam: 0 };
}

function normalizeChapterSelection(value: unknown): ChapterSelection | undefined {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return undefined;
  }

  const selection = value as Partial<Record<keyof ChapterSelection, unknown>>;
  if (typeof selection.subjectId !== 'string' || selection.subjectId.length === 0) {
    return undefined;
  }

  const chapters = Array.isArray(selection.chapters)
    ? [
        ...new Set(
          selection.chapters.filter(
            (chapter): chapter is number => Number.isInteger(chapter) && (chapter as number) > 0,
          ),
        ),
      ]
    : [];
  const categories = Array.isArray(selection.categories)
    ? sourceCategories.filter((category) => (selection.categories as unknown[]).includes(category))
    : [];

  if (chapters.length === 0 || categories.length === 0) {
    return undefined;
  }

  return { subjectId: selection.subjectId, chapters, categories };
}
