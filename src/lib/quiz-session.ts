import type { CatalogSource } from '../types/catalog';
import type { Choice, Passage, Question, QuestionFile } from '../types/question';
import { loadQuestionFile } from './data-loader';
import { safeSetItem } from './safe-storage';
import { isCorrectAnswer } from './scorer';
import {
  createSessionQuestion,
  hydrateQuestionRef,
  indexQuestionFile,
  isStoredQuestionRef,
  isStringArray,
  isStringArrayRecord,
  orderedChoices,
  questionKey,
  toQuestionRef,
  type QuestionFileIndex,
  type StoredQuestionRef,
} from './session-question';
import { shuffled } from './shuffle';
import { recordWrongAnswer } from './storage';

const selectedSourcesKey = 'pt.selectedSources';
const practiceScopeKey = 'pt.practiceScope';
const practiceOptionsKey = 'pt.practiceOptions';
export const sessionKey = 'pt.currentSession';
const sessionFormatVersion = 2;
export const chapterSelectionKey = 'pt.chapterSelection';

export type PracticeScope = 'all' | 'bookmarked' | 'wrong';
export type OrderMode = 'default' | 'random';

export interface PracticeOptions {
  questionOrder: OrderMode;
  choiceOrder: OrderMode;
}

export interface SelectedSource {
  subjectId: string;
  subjectTitle: string;
  sourceId: string;
  sourceTitle: string;
  path: string;
}

type StoredSelectedSource = Omit<SelectedSource, 'subjectTitle'> &
  Partial<Pick<SelectedSource, 'subjectTitle'>>;

export interface LoadedQuestionSource extends SelectedSource {
  file: QuestionFile;
}

/** 챕터별 풀이 세션을 만들 때 쓰는 추가 옵션 */
export interface SessionGrouping {
  /** 세션 재사용 판단용 시그니처에 덧붙일 값 (선택한 장·문제 종류) */
  signature: string;
  chapterOf: (key: string) => number | undefined;
  /** 문제 순서가 기본일 때 적용할 정렬 */
  compare: (left: QuizSessionQuestion, right: QuizSessionQuestion) => number;
}

export interface QuizSession {
  id: string;
  createdAt: string;
  sourceSignature: string;
  currentIndex: number;
  /** 세션 문제가 나온 출처. 저장된 세션을 다시 채울 때 문제 파일 경로로 쓴다. */
  sources: SelectedSource[];
  questions: QuizSessionQuestion[];
  draftAnswers: Record<string, string[]>;
  responses: Record<string, QuizResponse>;
}

/**
 * sessionStorage에 저장하는 세션 형식. 문제·지문 본문은 저장하지 않고
 * 출처 인덱스와 문제 ID, 선지 순서, 장 번호만 남긴 뒤 불러올 때 문제 파일로 다시 채운다.
 */
interface StoredQuizSession {
  version: typeof sessionFormatVersion;
  id: string;
  createdAt: string;
  sourceSignature: string;
  currentIndex: number;
  sources: SelectedSource[];
  questions: StoredQuizQuestionRef[];
  draftAnswers: Record<string, string[]>;
  responses: Record<string, QuizResponse>;
}

interface StoredQuizQuestionRef extends StoredQuestionRef {
  source: number;
  chapter?: number;
}

export interface QuizSessionQuestion {
  key: string;
  subjectId: string;
  subjectTitle: string;
  sourceId: string;
  sourceTitle: string;
  question: Question;
  passages: Passage[];
  choices: Choice[];
  chapter?: number;
}

export interface QuizResponse {
  selected: string[];
  correct: boolean;
  checkedAt: string;
}

export interface QuizScore {
  total: number;
  answered: number;
  correct: number;
  percent: number;
}

export function saveSelectedSources(sources: SelectedSource[]): void {
  safeSetItem(sessionStorage, selectedSourcesKey, JSON.stringify(sources), '선택한 출처');
  sessionStorage.removeItem(chapterSelectionKey);
  sessionStorage.removeItem(sessionKey);
}

export function savePracticeScope(scope: PracticeScope): void {
  safeSetItem(sessionStorage, practiceScopeKey, scope, '풀이 범위');
  sessionStorage.removeItem(sessionKey);
}

export function savePracticeOptions(options: PracticeOptions): void {
  safeSetItem(sessionStorage, practiceOptionsKey, JSON.stringify(options), '풀이 옵션');
  sessionStorage.removeItem(sessionKey);
}

export function loadPracticeScope(): PracticeScope {
  const scope = sessionStorage.getItem(practiceScopeKey);
  return scope === 'bookmarked' || scope === 'wrong' ? scope : 'all';
}

export function loadPracticeOptions(): PracticeOptions {
  const raw = sessionStorage.getItem(practiceOptionsKey);
  if (!raw) {
    return defaultPracticeOptions();
  }

  try {
    const parsed = JSON.parse(raw) as Partial<PracticeOptions>;
    return {
      questionOrder: parsed.questionOrder === 'random' ? 'random' : 'default',
      choiceOrder: parsed.choiceOrder === 'random' ? 'random' : 'default',
    };
  } catch {
    return defaultPracticeOptions();
  }
}

export function loadSelectedSources(): SelectedSource[] {
  const raw = sessionStorage.getItem(selectedSourcesKey);
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed)
      ? parsed.filter(isStoredSelectedSource).map(normalizeSelectedSource)
      : [];
  } catch {
    sessionStorage.removeItem(selectedSourcesKey);
    sessionStorage.removeItem(sessionKey);
    return [];
  }
}

export function defaultSelectedSources(
  subjectId: string,
  subjectTitle: string,
  sources: CatalogSource[],
): SelectedSource[] {
  const firstSource = sources[0];
  if (!firstSource) {
    return [];
  }

  return [
    {
      subjectId,
      subjectTitle,
      sourceId: firstSource.id,
      sourceTitle: firstSource.title,
      path: firstSource.path,
    },
  ];
}

/**
 * 저장된 세션을 불러와 문제 파일로 다시 채운다. 저장 형식이 맞지 않거나(이전 버전 포함)
 * 문제가 모두 사라졌으면 저장된 세션을 지우고 undefined를 돌려준다.
 * 문제 파일을 불러오지 못하면 세션은 그대로 두고 오류를 던진다.
 */
export async function loadSession(): Promise<QuizSession | undefined> {
  const stored = loadStoredSession();
  if (!stored) {
    return undefined;
  }

  const paths = [...new Set(stored.sources.map((source) => source.path))];
  const files = await Promise.all(paths.map((path) => loadQuestionFile(path)));
  const session = hydrateSession(
    stored,
    new Map(paths.map((path, index) => [path, files[index]!])),
  );

  if (!session) {
    clearSession();
  }

  return session;
}

/** 세션을 저장한다. 저장소가 가득 찼거나 쓸 수 없으면 사용자에게 알리고 false를 돌려준다. */
export function saveSession(session: QuizSession): boolean {
  return safeSetItem(
    sessionStorage,
    sessionKey,
    JSON.stringify(toStoredSession(session)),
    '풀이 진행 상황',
  );
}

export function clearSession(): void {
  sessionStorage.removeItem(sessionKey);
}

export function clearPracticeState(): void {
  sessionStorage.removeItem(selectedSourcesKey);
  sessionStorage.removeItem(practiceScopeKey);
  sessionStorage.removeItem(practiceOptionsKey);
  sessionStorage.removeItem(chapterSelectionKey);
  sessionStorage.removeItem(sessionKey);
}

export function createQuizSession(
  sources: LoadedQuestionSource[],
  includeQuestion: (key: string) => boolean = () => true,
  options: PracticeOptions = defaultPracticeOptions(),
  grouping?: SessionGrouping,
): QuizSession {
  const questions = sources.flatMap((source) => {
    const { passages } = indexQuestionFile(source.file);

    return source.file.questions.flatMap<QuizSessionQuestion>((question) => {
      const key = questionKey(source.subjectId, source.sourceId, question.id);
      if (!includeQuestion(key)) {
        return [];
      }

      const sessionQuestion = createSessionQuestion(
        source,
        question,
        passages,
        orderedChoices(question, options.choiceOrder === 'random'),
      );
      return grouping ? { ...sessionQuestion, chapter: grouping.chapterOf(key) } : sessionQuestion;
    });
  });

  return {
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    sourceSignature: sourceSignature(sources),
    currentIndex: 0,
    sources: sources.map(toSelectedSource),
    questions:
      options.questionOrder === 'random'
        ? shuffled(questions)
        : grouping
          ? [...questions].sort(grouping.compare)
          : questions,
    draftAnswers: {},
    responses: {},
  };
}

export function getOrCreateSession(
  sources: LoadedQuestionSource[],
  scope: PracticeScope = 'all',
  includeQuestion: (key: string) => boolean = () => true,
  options: PracticeOptions = defaultPracticeOptions(),
  grouping?: SessionGrouping,
): QuizSession {
  const stored = loadStoredSession();
  const groupingSignature = grouping ? `|${grouping.signature}` : '';
  const signature = `${sourceSignature(sources)}|scope:${scope}|question:${options.questionOrder}|choice:${options.choiceOrder}${groupingSignature}`;

  if (stored && stored.sourceSignature === signature && stored.questions.length > 0) {
    // 시그니처에 문제 파일 내용 해시가 들어 있으므로 넘겨받은 파일로 그대로 다시 채울 수 있다.
    const existing = hydrateSession(
      stored,
      new Map(sources.map((source) => [source.path, source.file])),
    );
    if (existing) {
      return existing;
    }
  }

  const session = {
    ...createQuizSession(sources, includeQuestion, options, grouping),
    sourceSignature: signature,
  };
  saveSession(session);
  return session;
}

export function answerCurrentQuestion(session: QuizSession, selected: string[]): QuizSession {
  const current = session.questions[session.currentIndex];
  if (!current) {
    return session;
  }

  return answerQuestion(session, current.key, selected);
}

export function saveDraftAnswer(
  session: QuizSession,
  questionKey: string,
  selected: string[],
): QuizSession {
  const nextDraftAnswers = { ...session.draftAnswers };

  if (selected.length === 0) {
    delete nextDraftAnswers[questionKey];
  } else {
    nextDraftAnswers[questionKey] = selected;
  }

  const nextSession = {
    ...session,
    draftAnswers: nextDraftAnswers,
  };

  saveSession(nextSession);
  return nextSession;
}

export function answerQuestion(
  session: QuizSession,
  questionKey: string,
  selected: string[],
): QuizSession {
  const current = session.questions.find((question) => question.key === questionKey);
  if (!current) {
    return session;
  }

  const correct = isCorrectAnswer(selected, current.question.answers);
  const previousResponse = session.responses[current.key];

  if (!correct && previousResponse === undefined) {
    recordWrongAnswer(current.key);
  }

  const nextSession = {
    ...session,
    draftAnswers: {
      ...session.draftAnswers,
      [current.key]: selected,
    },
    responses: {
      ...session.responses,
      [current.key]: {
        selected,
        correct,
        checkedAt: new Date().toISOString(),
      },
    },
  };

  saveSession(nextSession);
  return nextSession;
}

export function answerAllDraftQuestions(session: QuizSession): QuizSession {
  return session.questions.reduce((nextSession, question) => {
    if (nextSession.responses[question.key]) {
      return nextSession;
    }

    const selected = nextSession.draftAnswers[question.key] ?? [];
    return selected.length > 0 ? answerQuestion(nextSession, question.key, selected) : nextSession;
  }, session);
}

export function moveQuestion(session: QuizSession, nextIndex: number): QuizSession {
  const boundedIndex = Math.min(Math.max(nextIndex, 0), session.questions.length - 1);
  const nextSession = { ...session, currentIndex: boundedIndex };
  saveSession(nextSession);
  return nextSession;
}

export function scoreSession(session: QuizSession): QuizScore {
  const total = session.questions.length;
  const responses = Object.values(session.responses);
  const correct = responses.filter((response) => response.correct).length;

  return {
    total,
    answered: responses.length,
    correct,
    percent: total === 0 ? 0 : Math.round((correct / total) * 100),
  };
}

function sourceSignature(
  sources: readonly (SelectedSource & Partial<Pick<LoadedQuestionSource, 'file'>>)[],
): string {
  return sources
    .map((source) => {
      const contentSignature = source.file ? `:${hashString(JSON.stringify(source.file))}` : '';
      return `${source.subjectId}:${source.subjectTitle}:${source.sourceId}:${source.path}${contentSignature}`;
    })
    .join('|');
}

function hashString(value: string): string {
  let hash = 5381;

  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 33) ^ value.charCodeAt(index);
  }

  return (hash >>> 0).toString(36);
}

function defaultPracticeOptions(): PracticeOptions {
  return {
    questionOrder: 'default',
    choiceOrder: 'default',
  };
}

/** 저장된 세션 원본을 읽고 형식을 검사한다. 깨졌거나 이전 형식이면 지우고 undefined. */
function loadStoredSession(): StoredQuizSession | undefined {
  const raw = sessionStorage.getItem(sessionKey);
  if (!raw) {
    return undefined;
  }

  try {
    const stored = normalizeStoredSession(JSON.parse(raw) as unknown);
    if (stored) {
      return stored;
    }
  } catch {
    // 아래에서 지운다.
  }

  clearSession();
  return undefined;
}

function normalizeStoredSession(value: unknown): StoredQuizSession | undefined {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return undefined;
  }

  const session = value as Partial<Record<keyof StoredQuizSession, unknown>>;
  // 문제 본문을 통째로 저장하던 이전 형식(version 없음)은 버리고 새로 시작한다.
  if (
    session.version !== sessionFormatVersion ||
    typeof session.id !== 'string' ||
    typeof session.sourceSignature !== 'string' ||
    !Array.isArray(session.sources) ||
    !session.sources.every(isSessionSource) ||
    !Array.isArray(session.questions) ||
    !isStringArrayRecord(session.draftAnswers ?? {}) ||
    !isResponseRecord(session.responses ?? {})
  ) {
    return undefined;
  }

  const sources = session.sources;
  const questions = session.questions;
  if (!questions.every((ref) => isStoredQuizQuestionRef(ref, sources.length))) {
    return undefined;
  }

  return {
    version: sessionFormatVersion,
    id: session.id,
    createdAt: typeof session.createdAt === 'string' ? session.createdAt : '',
    sourceSignature: session.sourceSignature,
    currentIndex:
      typeof session.currentIndex === 'number' && Number.isInteger(session.currentIndex)
        ? session.currentIndex
        : 0,
    sources,
    questions,
    draftAnswers: (session.draftAnswers ?? {}) as Record<string, string[]>,
    responses: (session.responses ?? {}) as Record<string, QuizResponse>,
  };
}

function toStoredSession(session: QuizSession): StoredQuizSession {
  const sourceIndex = new Map(
    session.sources.map((source, index) => [`${source.subjectId}:${source.sourceId}`, index]),
  );

  return {
    version: sessionFormatVersion,
    id: session.id,
    createdAt: session.createdAt,
    sourceSignature: session.sourceSignature,
    currentIndex: session.currentIndex,
    sources: session.sources,
    questions: session.questions.flatMap<StoredQuizQuestionRef>((question) => {
      const source = sourceIndex.get(`${question.subjectId}:${question.sourceId}`);
      if (source === undefined) {
        return [];
      }

      return {
        source,
        ...toQuestionRef(question),
        ...(question.chapter === undefined ? {} : { chapter: question.chapter }),
      };
    }),
    draftAnswers: session.draftAnswers,
    responses: session.responses,
  };
}

/** 저장된 참조를 문제 파일로 채운다. 남은 문제가 하나도 없으면 undefined. */
function hydrateSession(
  stored: StoredQuizSession,
  filesByPath: ReadonlyMap<string, QuestionFile>,
): QuizSession | undefined {
  const indexes = new Map<string, QuestionFileIndex>();
  const indexFor = (path: string) => {
    const file = filesByPath.get(path);
    if (!file) {
      return undefined;
    }

    let index = indexes.get(path);
    if (!index) {
      index = indexQuestionFile(file);
      indexes.set(path, index);
    }
    return index;
  };

  const questions = stored.questions.flatMap<QuizSessionQuestion>((ref) => {
    const source = stored.sources[ref.source];
    const index = source ? indexFor(source.path) : undefined;
    const question = source && index ? hydrateQuestionRef(source, index, ref) : undefined;
    if (!question) {
      return [];
    }

    return ref.chapter === undefined ? question : { ...question, chapter: ref.chapter };
  });

  if (questions.length === 0) {
    return undefined;
  }

  return {
    id: stored.id,
    createdAt: stored.createdAt,
    sourceSignature: stored.sourceSignature,
    currentIndex: Math.min(Math.max(stored.currentIndex, 0), questions.length - 1),
    sources: stored.sources,
    questions,
    draftAnswers: stored.draftAnswers,
    responses: stored.responses,
  };
}

function isStoredQuizQuestionRef(value: unknown, sourceCount: number): boolean {
  if (!isStoredQuestionRef(value)) {
    return false;
  }

  const ref = value as Partial<Record<keyof StoredQuizQuestionRef, unknown>>;
  return (
    typeof ref.source === 'number' &&
    Number.isInteger(ref.source) &&
    ref.source >= 0 &&
    ref.source < sourceCount &&
    (ref.chapter === undefined || typeof ref.chapter === 'number')
  );
}

function isResponseRecord(value: unknown): value is Record<string, QuizResponse> {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    Object.values(value).every((response) => {
      if (typeof response !== 'object' || response === null) {
        return false;
      }

      const candidate = response as Partial<Record<keyof QuizResponse, unknown>>;
      return (
        isStringArray(candidate.selected) &&
        typeof candidate.correct === 'boolean' &&
        typeof candidate.checkedAt === 'string'
      );
    })
  );
}

function isSessionSource(value: unknown): value is SelectedSource {
  return isStoredSelectedSource(value) && typeof value.subjectTitle === 'string';
}

function toSelectedSource(source: LoadedQuestionSource): SelectedSource {
  return {
    subjectId: source.subjectId,
    subjectTitle: source.subjectTitle,
    sourceId: source.sourceId,
    sourceTitle: source.sourceTitle,
    path: source.path,
  };
}

function normalizeSelectedSource(source: StoredSelectedSource): SelectedSource {
  return {
    ...source,
    subjectTitle: source.subjectTitle ?? source.subjectId,
  };
}

function isStoredSelectedSource(value: unknown): value is StoredSelectedSource {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }

  const source = value as Partial<Record<keyof SelectedSource, unknown>>;
  return (
    typeof source.subjectId === 'string' &&
    source.subjectId.length > 0 &&
    (source.subjectTitle === undefined ||
      (typeof source.subjectTitle === 'string' && source.subjectTitle.length > 0)) &&
    typeof source.sourceId === 'string' &&
    source.sourceId.length > 0 &&
    typeof source.sourceTitle === 'string' &&
    source.sourceTitle.length > 0 &&
    typeof source.path === 'string' &&
    source.path.endsWith('.json')
  );
}
