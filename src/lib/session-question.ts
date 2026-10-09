import type { Choice, Passage, Question, QuestionFile } from '../types/question';
import type { QuizSessionQuestion } from './quiz-session';
import { shuffled } from './shuffle';

/** 세션 문제가 속한 출처 정보 (경로는 저장된 세션을 다시 불러올 때 쓴다) */
export interface SessionQuestionSource {
  subjectId: string;
  subjectTitle: string;
  sourceId: string;
  sourceTitle: string;
}

/** sessionStorage에 저장하는 문제 참조. 문제 본문 대신 ID와 선지 순서만 남긴다. */
export interface StoredQuestionRef {
  id: string;
  /** 선지 순서가 원본과 다를 때만 저장한다. */
  choices?: string[];
}

export interface QuestionFileIndex {
  questions: Map<string, Question>;
  passages: Map<string, Passage>;
}

export function questionKey(subjectId: string, sourceId: string, questionId: string): string {
  return `${subjectId}:${sourceId}:${questionId}`;
}

export function indexQuestionFile(file: QuestionFile): QuestionFileIndex {
  return {
    questions: new Map(file.questions.map((question) => [question.id, question])),
    passages: new Map(file.passages?.map((passage) => [passage.id, passage])),
  };
}

export function createSessionQuestion(
  source: SessionQuestionSource,
  question: Question,
  passagesById: ReadonlyMap<string, Passage>,
  choices: Choice[],
): QuizSessionQuestion {
  return {
    key: questionKey(source.subjectId, source.sourceId, question.id),
    subjectId: source.subjectId,
    subjectTitle: source.subjectTitle,
    sourceId: source.sourceId,
    sourceTitle: source.sourceTitle,
    question,
    passages: question.passageRefs?.flatMap((id) => passagesById.get(id) ?? []) ?? [],
    choices,
  };
}

export function orderedChoices(question: Question, random: boolean): Choice[] {
  return random ? shuffled(question.choices) : question.choices;
}

export function toQuestionRef(question: QuizSessionQuestion): StoredQuestionRef {
  const original = question.question.choices.map((choice) => choice.id);
  const current = question.choices.map((choice) => choice.id);
  const reordered = current.some((id, index) => id !== original[index]);
  return reordered ? { id: question.question.id, choices: current } : { id: question.question.id };
}

/** 저장된 참조를 불러온 문제 파일로 다시 채운다. 문제가 사라졌으면 undefined. */
export function hydrateQuestionRef(
  source: SessionQuestionSource,
  index: QuestionFileIndex,
  ref: StoredQuestionRef,
): QuizSessionQuestion | undefined {
  const question = index.questions.get(ref.id);
  if (!question) {
    return undefined;
  }

  return createSessionQuestion(source, question, index.passages, restoreChoiceOrder(question, ref));
}

export function isStoredQuestionRef(value: unknown): value is StoredQuestionRef {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }

  const ref = value as Partial<Record<keyof StoredQuestionRef, unknown>>;
  return (
    typeof ref.id === 'string' &&
    ref.id.length > 0 &&
    (ref.choices === undefined || isStringArray(ref.choices))
  );
}

export function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

export function isStringArrayRecord(value: unknown): value is Record<string, string[]> {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    Object.values(value).every(isStringArray)
  );
}

function restoreChoiceOrder(question: Question, ref: StoredQuestionRef): Choice[] {
  if (!ref.choices) {
    return question.choices;
  }

  const byId = new Map(question.choices.map((choice) => [choice.id, choice]));
  const restored = ref.choices.flatMap((id) => byId.get(id) ?? []);

  // 데이터가 바뀌어 선지 구성이 달라졌으면 원본 순서로 되돌린다.
  return restored.length === question.choices.length && new Set(ref.choices).size === byId.size
    ? restored
    : question.choices;
}
