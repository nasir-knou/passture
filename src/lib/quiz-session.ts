import type { CatalogSource } from '../types/catalog';
import type { Choice, Passage, Question, QuestionFile } from '../types/question';
import { isCorrectAnswer } from './scorer';
import { shuffled } from './shuffle';
import { recordWrongAnswer } from './storage';

const selectedSourcesKey = 'pt.selectedSources';
const practiceScopeKey = 'pt.practiceScope';
const practiceOptionsKey = 'pt.practiceOptions';
const sessionKey = 'pt.currentSession';

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

export interface QuizSession {
  id: string;
  createdAt: string;
  sourceSignature: string;
  currentIndex: number;
  questions: QuizSessionQuestion[];
  draftAnswers: Record<string, string[]>;
  responses: Record<string, QuizResponse>;
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
  sessionStorage.setItem(selectedSourcesKey, JSON.stringify(sources));
  sessionStorage.removeItem(sessionKey);
}

export function savePracticeScope(scope: PracticeScope): void {
  sessionStorage.setItem(practiceScopeKey, scope);
  sessionStorage.removeItem(sessionKey);
}

export function savePracticeOptions(options: PracticeOptions): void {
  sessionStorage.setItem(practiceOptionsKey, JSON.stringify(options));
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
    return Array.isArray(parsed) ? parsed.filter(isStoredSelectedSource).map(normalizeSelectedSource) : [];
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

export function loadSession(): QuizSession | undefined {
  const raw = sessionStorage.getItem(sessionKey);
  return raw ? normalizeSession(JSON.parse(raw) as Partial<QuizSession>) : undefined;
}

export function saveSession(session: QuizSession): void {
  sessionStorage.setItem(sessionKey, JSON.stringify(session));
}

export function clearSession(): void {
  sessionStorage.removeItem(sessionKey);
}

export function clearPracticeState(): void {
  sessionStorage.removeItem(selectedSourcesKey);
  sessionStorage.removeItem(practiceScopeKey);
  sessionStorage.removeItem(practiceOptionsKey);
  sessionStorage.removeItem(sessionKey);
}

export function createQuizSession(
  sources: LoadedQuestionSource[],
  includeQuestion: (key: string) => boolean = () => true,
  options: PracticeOptions = defaultPracticeOptions(),
): QuizSession {
  const questions = sources.flatMap((source) => {
    const passagesById = new Map(source.file.passages?.map((passage) => [passage.id, passage]));

    return source.file.questions.flatMap<QuizSessionQuestion>((question) => {
      const key = `${source.subjectId}:${source.sourceId}:${question.id}`;
      if (!includeQuestion(key)) {
        return [];
      }

      return {
        key,
        subjectId: source.subjectId,
        subjectTitle: source.subjectTitle,
        sourceId: source.sourceId,
        sourceTitle: source.sourceTitle,
        question,
        passages: question.passageRefs?.flatMap((id) => passagesById.get(id) ?? []) ?? [],
        choices: options.choiceOrder === 'random' ? shuffled(question.choices) : question.choices,
      };
    });
  });

  return {
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    sourceSignature: sourceSignature(sources),
    currentIndex: 0,
    questions: options.questionOrder === 'random' ? shuffled(questions) : questions,
    draftAnswers: {},
    responses: {},
  };
}

export function getOrCreateSession(
  sources: LoadedQuestionSource[],
  scope: PracticeScope = 'all',
  includeQuestion: (key: string) => boolean = () => true,
  options: PracticeOptions = defaultPracticeOptions(),
): QuizSession {
  const existing = loadSession();
  const signature = `${sourceSignature(sources)}|scope:${scope}|question:${options.questionOrder}|choice:${options.choiceOrder}`;

  if (existing && existing.sourceSignature === signature && existing.questions.length > 0) {
    return existing;
  }

  const session = {
    ...createQuizSession(sources, includeQuestion, options),
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

function sourceSignature(sources: readonly SelectedSource[]): string {
  return sources
    .map((source) => `${source.subjectId}:${source.subjectTitle}:${source.sourceId}:${source.path}`)
    .join('|');
}

function defaultPracticeOptions(): PracticeOptions {
  return {
    questionOrder: 'default',
    choiceOrder: 'default',
  };
}

function normalizeSession(value: Partial<QuizSession>): QuizSession {
  return {
    id: value.id ?? '',
    createdAt: value.createdAt ?? '',
    sourceSignature: value.sourceSignature ?? '',
    currentIndex: value.currentIndex ?? 0,
    questions: value.questions ?? [],
    draftAnswers: value.draftAnswers ?? {},
    responses: value.responses ?? {},
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
