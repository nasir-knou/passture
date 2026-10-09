import type { SourceKind } from '../types/catalog';
import type { QuestionFile } from '../types/question';
import type { PracticeOptions, QuizSessionQuestion } from './quiz-session';
import { parseQuestionGroup } from './chapter';
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
  toQuestionRef,
  type StoredQuestionRef,
} from './session-question';
import { shuffled } from './shuffle';

const mockExamConfigKey = 'pt.mockExamConfig';
export const mockExamSessionKey = 'pt.mockExamSession';
const mockExamSessionFormatVersion = 2;

// ─── Config (설정 화면에서 저장) ────────────────────────────────────────

export interface MockExamSubjectConfig {
  subjectId: string;
  subjectTitle: string;
  questionMode: MockExamQuestionMode;
  source: {
    subjectId: string;
    subjectTitle: string;
    sourceId: string;
    sourceTitle: string;
    path: string;
    kind: SourceKind;
  };
}

export type MockExamQuestionMode = 'sample25' | 'all';

export interface MockExamConfig {
  subjects: MockExamSubjectConfig[]; // 1~3개
  totalMinutes: number; // 과목 수 x 25
  startTime: string; // HH:mm
  endTime: string; // 계산값
  questionOrder?: PracticeOptions['questionOrder'];
  choiceOrder?: PracticeOptions['choiceOrder'];
}

type StoredMockExamSubjectConfig = Partial<MockExamSubjectConfig> & {
  sources?: MockExamSubjectConfig['source'][];
};

type StoredMockExamConfig = Partial<Omit<MockExamConfig, 'subjects'>> & {
  subjects?: StoredMockExamSubjectConfig[];
};

export function saveMockExamConfig(config: MockExamConfig): void {
  safeSetItem(sessionStorage, mockExamConfigKey, JSON.stringify(config), '모의 시험 설정');
  sessionStorage.removeItem(mockExamSessionKey);
}

export function loadMockExamConfig(): MockExamConfig | undefined {
  const raw = sessionStorage.getItem(mockExamConfigKey);
  if (!raw) return undefined;
  try {
    return normalizeMockExamConfig(JSON.parse(raw) as StoredMockExamConfig);
  } catch {
    return undefined;
  }
}

export function clearMockExamConfig(): void {
  sessionStorage.removeItem(mockExamConfigKey);
  sessionStorage.removeItem(mockExamSessionKey);
}

function normalizeMockExamConfig(config: StoredMockExamConfig): MockExamConfig | undefined {
  if (typeof config !== 'object' || config === null || !Array.isArray(config.subjects)) {
    return undefined;
  }

  const subjects = config.subjects
    .map((subject) => {
      const source = subject?.source ?? subject?.sources?.[0];
      if (
        !subject?.subjectId ||
        !subject.subjectTitle ||
        !source ||
        typeof source.path !== 'string' ||
        typeof source.sourceId !== 'string'
      ) {
        return undefined;
      }

      return {
        subjectId: subject.subjectId,
        subjectTitle: subject.subjectTitle,
        questionMode: normalizeQuestionMode(subject.questionMode),
        source: {
          subjectId: source.subjectId,
          subjectTitle: source.subjectTitle,
          sourceId: source.sourceId,
          sourceTitle: source.sourceTitle,
          path: source.path,
          kind: source.kind,
        },
      };
    })
    .filter((subject): subject is MockExamSubjectConfig => subject !== undefined);

  if (!subjects.length) {
    return undefined;
  }

  const times = calcMockExamTimes(subjects.length);
  return {
    subjects,
    totalMinutes:
      typeof config.totalMinutes === 'number' ? config.totalMinutes : times.totalMinutes,
    startTime: typeof config.startTime === 'string' ? config.startTime : times.startTime,
    endTime: typeof config.endTime === 'string' ? config.endTime : times.endTime,
    questionOrder: config.questionOrder === 'random' ? 'random' : 'default',
    choiceOrder: config.choiceOrder === 'random' ? 'random' : 'default',
  };
}

function normalizeQuestionMode(mode: unknown): MockExamQuestionMode {
  return mode === 'all' ? 'all' : 'sample25';
}

// ─── Session (시험 중 상태) ──────────────────────────────────────────────

export interface MockExamSubjectSession {
  subjectId: string;
  subjectTitle: string;
  questions: QuizSessionQuestion[];
  answers: Record<string, string[]>; // questionKey → 선택한 답 ID 목록
}

export interface MockExamSession {
  id: string;
  config: MockExamConfig;
  subjects: MockExamSubjectSession[];
  activeSubjectIndex: number;
  startedAt: string; // ISO 문자열
  bookmarks: string[]; // questionKey 목록 (Set은 JSON 직렬화 불가)
  status: 'in-progress' | 'finished';
}

/**
 * sessionStorage에 저장하는 모의시험 세션 형식. 문제 본문 대신 문제 ID와 선지 순서만 남기고,
 * 과목별 문제 파일은 config.subjects[i].source.path로 다시 불러와 채운다.
 */
interface StoredMockExamSession extends Omit<MockExamSession, 'subjects'> {
  version: typeof mockExamSessionFormatVersion;
  subjects: StoredMockExamSubjectSession[];
}

interface StoredMockExamSubjectSession extends Omit<MockExamSubjectSession, 'questions'> {
  questions: StoredQuestionRef[];
}

/** 세션을 저장한다. 저장소가 가득 찼거나 쓸 수 없으면 사용자에게 알리고 false를 돌려준다. */
export function saveMockExamSession(session: MockExamSession): boolean {
  const stored: StoredMockExamSession = {
    ...session,
    version: mockExamSessionFormatVersion,
    subjects: session.subjects.map((subject) => ({
      ...subject,
      questions: subject.questions.map(toQuestionRef),
    })),
  };

  return safeSetItem(
    sessionStorage,
    mockExamSessionKey,
    JSON.stringify(stored),
    '모의 시험 진행 상황',
  );
}

/**
 * 저장된 세션을 불러와 문제 파일로 다시 채운다. 저장 형식이 맞지 않거나(이전 버전 포함)
 * 문제가 모두 사라졌으면 저장된 세션을 지우고 undefined를 돌려준다.
 * 문제 파일을 불러오지 못하면 세션은 그대로 두고 오류를 던진다.
 */
export async function loadMockExamSession(): Promise<MockExamSession | undefined> {
  const stored = loadStoredMockExamSession();
  if (!stored) return undefined;

  const files = await Promise.all(
    stored.config.subjects.map((subject) => loadQuestionFile(subject.source.path)),
  );
  const session = hydrateMockExamSession(stored, files);

  if (!session) {
    clearMockExamSession();
  }

  return session;
}

/** 문제 파일 없이 저장된 세션의 진행 상태만 읽는다. */
export function loadMockExamSessionStatus(): MockExamSession['status'] | undefined {
  return loadStoredMockExamSession()?.status;
}

function loadStoredMockExamSession(): StoredMockExamSession | undefined {
  const raw = sessionStorage.getItem(mockExamSessionKey);
  if (!raw) return undefined;

  try {
    const stored = normalizeStoredMockExamSession(JSON.parse(raw) as unknown);
    if (stored) return stored;
  } catch {
    // 아래에서 지운다.
  }

  clearMockExamSession();
  return undefined;
}

function normalizeStoredMockExamSession(value: unknown): StoredMockExamSession | undefined {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return undefined;
  }

  const session = value as Partial<Record<keyof StoredMockExamSession, unknown>>;
  // 문제 본문을 통째로 저장하던 이전 형식(version 없음)은 버리고 새로 시작한다.
  if (
    session.version !== mockExamSessionFormatVersion ||
    typeof session.id !== 'string' ||
    typeof session.startedAt !== 'string' ||
    Number.isNaN(new Date(session.startedAt).getTime()) ||
    (session.status !== 'in-progress' && session.status !== 'finished') ||
    !isStringArray(session.bookmarks ?? []) ||
    !Array.isArray(session.subjects)
  ) {
    return undefined;
  }

  const config = normalizeMockExamConfig(session.config as StoredMockExamConfig);
  if (!config || config.subjects.length !== session.subjects.length) {
    return undefined;
  }

  const subjects = session.subjects.map(normalizeStoredSubject);
  if (subjects.some((subject) => subject === undefined)) {
    return undefined;
  }

  const activeSubjectIndex =
    typeof session.activeSubjectIndex === 'number' && Number.isInteger(session.activeSubjectIndex)
      ? Math.min(Math.max(session.activeSubjectIndex, 0), subjects.length - 1)
      : 0;

  return {
    version: mockExamSessionFormatVersion,
    id: session.id,
    config,
    subjects: subjects as StoredMockExamSubjectSession[],
    activeSubjectIndex,
    startedAt: session.startedAt,
    bookmarks: (session.bookmarks ?? []) as string[],
    status: session.status,
  };
}

function normalizeStoredSubject(value: unknown): StoredMockExamSubjectSession | undefined {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return undefined;
  }

  const subject = value as Partial<Record<keyof StoredMockExamSubjectSession, unknown>>;
  if (
    typeof subject.subjectId !== 'string' ||
    typeof subject.subjectTitle !== 'string' ||
    !Array.isArray(subject.questions) ||
    !subject.questions.every(isStoredQuestionRef) ||
    !isStringArrayRecord(subject.answers ?? {})
  ) {
    return undefined;
  }

  return {
    subjectId: subject.subjectId,
    subjectTitle: subject.subjectTitle,
    questions: subject.questions,
    answers: (subject.answers ?? {}) as Record<string, string[]>,
  };
}

function hydrateMockExamSession(
  stored: StoredMockExamSession,
  files: readonly QuestionFile[],
): MockExamSession | undefined {
  const subjects = stored.subjects.map((subject, subjectIndex) => {
    const source = stored.config.subjects[subjectIndex]!.source;
    const index = indexQuestionFile(files[subjectIndex]!);
    return {
      ...subject,
      questions: subject.questions.flatMap((ref) => hydrateQuestionRef(source, index, ref) ?? []),
    };
  });

  if (subjects.every((subject) => subject.questions.length === 0)) {
    return undefined;
  }

  const { version: _version, ...session } = stored;
  return { ...session, subjects };
}

export function clearMockExamSession(): void {
  sessionStorage.removeItem(mockExamSessionKey);
}

// ─── 세션 생성 ───────────────────────────────────────────────────────────

export async function createMockExamSession(config: MockExamConfig): Promise<MockExamSession> {
  const startedAt = new Date();
  const times = calcMockExamTimes(config.subjects.length, startedAt);
  const sessionConfig: MockExamConfig = {
    ...config,
    totalMinutes: times.totalMinutes,
    startTime: times.startTime,
    endTime: times.endTime,
  };
  const options: PracticeOptions = {
    questionOrder: sessionConfig.questionOrder === 'random' ? 'random' : 'default',
    choiceOrder: sessionConfig.choiceOrder === 'random' ? 'random' : 'default',
  };

  const subjects: MockExamSubjectSession[] = await Promise.all(
    sessionConfig.subjects.map(async (subjectConfig) => {
      const file = await loadQuestionFile(subjectConfig.source.path);
      const questions = buildQuestions(subjectConfig, file, options);
      return {
        subjectId: subjectConfig.subjectId,
        subjectTitle: subjectConfig.subjectTitle,
        questions,
        answers: {},
      };
    }),
  );

  const session: MockExamSession = {
    id: crypto.randomUUID(),
    config: sessionConfig,
    subjects,
    activeSubjectIndex: 0,
    startedAt: startedAt.toISOString(),
    bookmarks: [],
    status: 'in-progress',
  };

  saveMockExamSession(session);
  return session;
}

function buildQuestions(
  subjectConfig: MockExamSubjectConfig,
  file: QuestionFile,
  options: PracticeOptions,
): QuizSessionQuestion[] {
  const { passages } = indexQuestionFile(file);
  const allQuestions = file.questions.map((question) =>
    createSessionQuestion(
      subjectConfig.source,
      question,
      passages,
      orderedChoices(question, options.choiceOrder === 'random'),
    ),
  );

  const questions =
    subjectConfig.questionMode === 'all'
      ? allQuestions
      : extractMockExamQuestions(allQuestions, file.kind);

  return options.questionOrder === 'random' ? shuffled(questions) : questions;
}

// ─── 모의시험 25문제 추출 ───────────────────────────────────────────────

/**
 * 기출은 25문항이면 그대로 사용하고, 그보다 많으면 무작위 25문항을 뽑는다.
 * 교재/워크북/강의/특강은 문제 ID의 첫 숫자 그룹 범위에 맞춰 균등 분산한다.
 * 뽑은 문제는 원래 문제 파일 순서대로 돌려준다 (무작위 순서는 호출하는 쪽에서 섞는다).
 */
export function extractMockExamQuestions(
  questions: QuizSessionQuestion[],
  sourceKind: SourceKind,
): QuizSessionQuestion[] {
  const TARGET = 25;

  if (questions.length <= TARGET) {
    return questions;
  }

  const picks =
    sourceKind === 'exam'
      ? shuffled(questions).slice(0, TARGET)
      : extractGroupedRandom25(questions, TARGET);
  const originalIndex = new Map(questions.map((question, index) => [question, index]));

  return picks.sort((left, right) => originalIndex.get(left)! - originalIndex.get(right)!);
}

function extractGroupedRandom25(
  questions: QuizSessionQuestion[],
  target: number,
): QuizSessionQuestion[] {
  const groups = new Map<number, QuizSessionQuestion[]>();
  for (const q of questions) {
    const key = parseQuestionGroup(q.question.id);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(q);
  }

  const maxGroup = Math.max(...groups.keys());
  if (!Number.isFinite(maxGroup) || maxGroup <= 0) {
    return shuffled(questions).slice(0, target);
  }

  const picks: QuizSessionQuestion[] = [];
  const base = Math.floor(target / maxGroup);
  const groupNumbers = Array.from({ length: maxGroup }, (_, index) => index + 1);
  // 나머지 문항은 앞쪽 그룹이 아니라 무작위로 고른 그룹에 하나씩 더 배정한다.
  const extraGroups = new Set(shuffled(groupNumbers).slice(0, target - base * maxGroup));
  // 1~maxGroup 범위 밖(그룹 번호 0 등)의 문제는 처음부터 부족분 후보로 둔다.
  const leftovers: QuizSessionQuestion[] = [...groups.entries()]
    .filter(([groupNumber]) => groupNumber < 1 || groupNumber > maxGroup)
    .flatMap(([, group]) => group);

  for (const groupNumber of groupNumbers) {
    const group = shuffled(groups.get(groupNumber) ?? []);
    const allocation = base + (extraGroups.has(groupNumber) ? 1 : 0);
    const selected = group.slice(0, allocation);
    picks.push(...selected);
    leftovers.push(...group.slice(selected.length));
  }

  if (picks.length < target) {
    picks.push(...shuffled(leftovers).slice(0, target - picks.length));
  }

  return picks.slice(0, target);
}

// ─── 세션 업데이트 헬퍼 ──────────────────────────────────────────────────

export function setAnswer(
  session: MockExamSession,
  questionKey: string,
  selected: string[],
): MockExamSession {
  const subjectIndex = session.subjects.findIndex((s) =>
    s.questions.some((q) => q.key === questionKey),
  );
  if (subjectIndex === -1) return session;

  const subject = session.subjects[subjectIndex]!;
  const updated: MockExamSession = {
    ...session,
    subjects: session.subjects.map((s, i) =>
      i === subjectIndex ? { ...s, answers: { ...s.answers, [questionKey]: selected } } : s,
    ),
  };

  // 빈 배열이면 키 삭제
  if (selected.length === 0) {
    const answers = { ...subject.answers };
    delete answers[questionKey];
    updated.subjects = updated.subjects.map((s, i) => (i === subjectIndex ? { ...s, answers } : s));
  }

  saveMockExamSession(updated);
  return updated;
}

export function toggleBookmark(session: MockExamSession, questionKey: string): MockExamSession {
  const bookmarks = session.bookmarks.includes(questionKey)
    ? session.bookmarks.filter((k) => k !== questionKey)
    : [...session.bookmarks, questionKey];

  const updated = { ...session, bookmarks };
  saveMockExamSession(updated);
  return updated;
}

export function setActiveSubject(session: MockExamSession, index: number): MockExamSession {
  const updated = {
    ...session,
    activeSubjectIndex: Math.min(Math.max(index, 0), session.subjects.length - 1),
  };
  saveMockExamSession(updated);
  return updated;
}

export function finishSession(session: MockExamSession): MockExamSession {
  const updated: MockExamSession = { ...session, status: 'finished' };
  saveMockExamSession(updated);
  return updated;
}

// ─── 시간 계산 ───────────────────────────────────────────────────────────

export function calcMockExamTimes(
  subjectCount: number,
  startDate = new Date(),
): {
  totalMinutes: number;
  startTime: string;
  endTime: string;
} {
  const totalMinutes = subjectCount * 25;
  const startTime = new Date(startDate);
  const endTime = new Date(startTime.getTime() + totalMinutes * 60_000);

  return {
    totalMinutes,
    startTime: formatClockTime(startTime),
    endTime: formatClockTime(endTime),
  };
}

function formatClockTime(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function getRemainingSeconds(session: MockExamSession): number {
  const elapsed = (Date.now() - new Date(session.startedAt).getTime()) / 1000;
  const total = session.config.totalMinutes * 60;
  return Math.max(0, Math.floor(total - elapsed));
}

export function formatCountdown(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(m)}:${pad(s)}`;
}

// ─── 정답 체크 ───────────────────────────────────────────────────────────

export function getAnsweredCount(subjectSession: MockExamSubjectSession): number {
  return subjectSession.questions.filter((q) => (subjectSession.answers[q.key]?.length ?? 0) > 0)
    .length;
}

export function gradeSession(session: MockExamSession): MockExamGradeResult[] {
  return session.subjects.map((subject) => {
    let correct = 0;
    const results = subject.questions.map((q) => {
      const selected = subject.answers[q.key] ?? [];
      const isCorrect = selected.length > 0 && isCorrectAnswer(selected, q.question.answers);
      if (isCorrect) correct += 1;
      return { key: q.key, selected, isCorrect };
    });

    return {
      subjectId: subject.subjectId,
      subjectTitle: subject.subjectTitle,
      total: subject.questions.length,
      answered: Object.values(subject.answers).filter((a) => a.length > 0).length,
      correct,
      results,
    };
  });
}

export interface MockExamGradeResult {
  subjectId: string;
  subjectTitle: string;
  total: number;
  answered: number;
  correct: number;
  results: Array<{ key: string; selected: string[]; isCorrect: boolean }>;
}
