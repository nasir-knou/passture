import type { SourceKind } from '../types/catalog';
import type { QuestionFile } from '../types/question';
import type { PracticeOptions, QuizSessionQuestion } from './quiz-session';
import { loadQuestionFile } from './data-loader';
import { shuffled } from './shuffle';

const mockExamConfigKey = 'pt.mockExamConfig';
const mockExamSessionKey = 'pt.mockExamSession';

// ─── Config (설정 화면에서 저장) ────────────────────────────────────────

export interface MockExamSubjectConfig {
  subjectId: string;
  subjectTitle: string;
  source: {
    subjectId: string;
    subjectTitle: string;
    sourceId: string;
    sourceTitle: string;
    path: string;
    kind: SourceKind;
  };
}

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
  sessionStorage.setItem(mockExamConfigKey, JSON.stringify(config));
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
  const subjects = config.subjects
    ?.map((subject) => {
      const source = subject.source ?? subject.sources?.[0];
      if (!subject.subjectId || !subject.subjectTitle || !source) {
        return undefined;
      }

      return {
        subjectId: subject.subjectId,
        subjectTitle: subject.subjectTitle,
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

  if (!subjects?.length) {
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

export function saveMockExamSession(session: MockExamSession): void {
  sessionStorage.setItem(mockExamSessionKey, JSON.stringify(session));
}

export function loadMockExamSession(): MockExamSession | undefined {
  const raw = sessionStorage.getItem(mockExamSessionKey);
  if (!raw) return undefined;
  try {
    return JSON.parse(raw) as MockExamSession;
  } catch {
    return undefined;
  }
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
  const source = subjectConfig.source;
  const passagesById = new Map(file.passages?.map((p) => [p.id, p]));
  const allQuestions = file.questions.map((question) => ({
    key: `${source.subjectId}:${source.sourceId}:${question.id}`,
    subjectId: source.subjectId,
    subjectTitle: source.subjectTitle,
    sourceId: source.sourceId,
    sourceTitle: source.sourceTitle,
    question,
    passages: question.passageRefs?.flatMap((id) => passagesById.get(id) ?? []) ?? [],
    choices: options.choiceOrder === 'random' ? shuffled(question.choices) : question.choices,
  }));

  const questions = extractMockExamQuestions(allQuestions, file.kind);

  return options.questionOrder === 'random' ? shuffled(questions) : questions;
}

// ─── 모의시험 25문제 추출 ───────────────────────────────────────────────

/**
 * 기출은 25문항이면 그대로 사용하고, 그보다 많으면 무작위 25문항을 뽑는다.
 * 교재/워크북/강의/특강은 문제 ID의 첫 숫자 그룹 범위에 맞춰 균등 분산한다.
 */
export function extractMockExamQuestions(
  questions: QuizSessionQuestion[],
  sourceKind: SourceKind,
): QuizSessionQuestion[] {
  const TARGET = 25;

  if (questions.length <= TARGET) {
    return questions;
  }

  if (sourceKind === 'exam') {
    return shuffled(questions).slice(0, TARGET);
  }

  return extractGroupedRandom25(questions, TARGET);
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
  const leftovers: QuizSessionQuestion[] = [];
  const base = Math.floor(target / maxGroup);
  let remainder = target - base * maxGroup;

  for (let groupNumber = 1; groupNumber <= maxGroup; groupNumber += 1) {
    const group = shuffled(groups.get(groupNumber) ?? []);
    const allocation = base + (remainder > 0 ? 1 : 0);
    if (remainder > 0) {
      remainder -= 1;
    }

    const selected = group.slice(0, allocation);
    picks.push(...selected);
    leftovers.push(...group.slice(selected.length));
  }

  if (picks.length < target) {
    picks.push(...shuffled(leftovers).slice(0, target - picks.length));
  }

  return picks.slice(0, target);
}

function parseQuestionGroup(questionId: string): number {
  const match = /^[a-z]+(\d+)/i.exec(questionId);
  return match ? Number(match[1]) : 0;
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

export function calcMockExamTimes(subjectCount: number, startDate = new Date()): {
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
      const isCorrect =
        selected.length > 0 &&
        selected.length === q.question.answers.length &&
        selected.every((s) => q.question.answers.includes(s));
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
