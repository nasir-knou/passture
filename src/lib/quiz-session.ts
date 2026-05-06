import type { CatalogSource } from '../types/catalog';
import type { Choice, Passage, Question, QuestionFile } from '../types/question';
import { isCorrectAnswer } from './scorer';
import { shuffled } from './shuffle';

const selectedSourcesKey = 'pt.selectedSources';
const sessionKey = 'pt.currentSession';

export interface SelectedSource {
  subjectId: string;
  sourceId: string;
  sourceTitle: string;
  path: string;
}

export interface LoadedQuestionSource extends SelectedSource {
  file: QuestionFile;
}

export interface QuizSession {
  id: string;
  createdAt: string;
  sourceSignature: string;
  currentIndex: number;
  questions: QuizSessionQuestion[];
  responses: Record<string, QuizResponse>;
}

export interface QuizSessionQuestion {
  key: string;
  subjectId: string;
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

export function loadSelectedSources(): SelectedSource[] {
  const raw = sessionStorage.getItem(selectedSourcesKey);
  if (!raw) {
    return [];
  }

  const parsed = JSON.parse(raw) as SelectedSource[];
  return Array.isArray(parsed) ? parsed : [];
}

export function defaultSelectedSources(
  subjectId: string,
  sources: CatalogSource[],
): SelectedSource[] {
  const firstSource = sources[0];
  if (!firstSource) {
    return [];
  }

  return [
    {
      subjectId,
      sourceId: firstSource.id,
      sourceTitle: firstSource.title,
      path: firstSource.path,
    },
  ];
}

export function loadSession(): QuizSession | undefined {
  const raw = sessionStorage.getItem(sessionKey);
  return raw ? (JSON.parse(raw) as QuizSession) : undefined;
}

export function saveSession(session: QuizSession): void {
  sessionStorage.setItem(sessionKey, JSON.stringify(session));
}

export function clearSession(): void {
  sessionStorage.removeItem(sessionKey);
}

export function createQuizSession(sources: LoadedQuestionSource[]): QuizSession {
  const questions = sources.flatMap((source) => {
    const passagesById = new Map(source.file.passages?.map((passage) => [passage.id, passage]));

    return source.file.questions.map<QuizSessionQuestion>((question) => ({
      key: `${source.subjectId}:${source.sourceId}:${question.id}`,
      subjectId: source.subjectId,
      sourceId: source.sourceId,
      sourceTitle: source.sourceTitle,
      question,
      passages: question.passageRefs?.flatMap((id) => passagesById.get(id) ?? []) ?? [],
      choices: shuffled(question.choices),
    }));
  });

  return {
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    sourceSignature: sourceSignature(sources),
    currentIndex: 0,
    questions: shuffled(questions),
    responses: {},
  };
}

export function getOrCreateSession(sources: LoadedQuestionSource[]): QuizSession {
  const existing = loadSession();
  const signature = sourceSignature(sources);

  if (existing && existing.sourceSignature === signature && existing.questions.length > 0) {
    return existing;
  }

  const session = createQuizSession(sources);
  saveSession(session);
  return session;
}

export function answerCurrentQuestion(session: QuizSession, selected: string[]): QuizSession {
  const current = session.questions[session.currentIndex];
  if (!current) {
    return session;
  }

  const nextSession = {
    ...session,
    responses: {
      ...session.responses,
      [current.key]: {
        selected,
        correct: isCorrectAnswer(selected, current.question.answers),
        checkedAt: new Date().toISOString(),
      },
    },
  };

  saveSession(nextSession);
  return nextSession;
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
  return sources.map((source) => `${source.subjectId}:${source.sourceId}:${source.path}`).join('|');
}
