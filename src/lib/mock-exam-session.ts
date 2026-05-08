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
  sources: Array<{
    subjectId: string;
    subjectTitle: string;
    sourceId: string;
    sourceTitle: string;
    path: string;
  }>;
  extractMode: 'all' | 'random-25';
}

export interface MockExamConfig {
  subjects: MockExamSubjectConfig[]; // 1~3개
  totalMinutes: number;              // 과목 수 x 25
  startTime: string;                 // "13:30"
  endTime: string;                   // 계산값
  questionOrder?: PracticeOptions['questionOrder'];
  choiceOrder?: PracticeOptions['choiceOrder'];
}

export function saveMockExamConfig(config: MockExamConfig): void {
  sessionStorage.setItem(mockExamConfigKey, JSON.stringify(config));
  sessionStorage.removeItem(mockExamSessionKey);
}

export function loadMockExamConfig(): MockExamConfig | undefined {
  const raw = sessionStorage.getItem(mockExamConfigKey);
  if (!raw) return undefined;
  try {
    return JSON.parse(raw) as MockExamConfig;
  } catch {
    return undefined;
  }
}

export function clearMockExamConfig(): void {
  sessionStorage.removeItem(mockExamConfigKey);
  sessionStorage.removeItem(mockExamSessionKey);
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
  const options: PracticeOptions = {
    questionOrder: config.questionOrder === 'random' ? 'random' : 'default',
    choiceOrder: config.choiceOrder === 'random' ? 'random' : 'default',
  };

  const subjects: MockExamSubjectSession[] = await Promise.all(
    config.subjects.map(async (subjectConfig) => {
      const files = await Promise.all(
        subjectConfig.sources.map((s) => loadQuestionFile(s.path)),
      );
      const questions = buildQuestions(subjectConfig, files, options);
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
    config,
    subjects,
    activeSubjectIndex: 0,
    startedAt: new Date().toISOString(),
    bookmarks: [],
    status: 'in-progress',
  };

  saveMockExamSession(session);
  return session;
}

function buildQuestions(
  subjectConfig: MockExamSubjectConfig,
  files: QuestionFile[],
  options: PracticeOptions,
): QuizSessionQuestion[] {
  const allQuestions: QuizSessionQuestion[] = files.flatMap((file, fileIndex) => {
    const source = subjectConfig.sources[fileIndex];
    if (!source) return [];
    const passagesById = new Map(file.passages?.map((p) => [p.id, p]));

    return file.questions.map((question) => ({
      key: `${source.subjectId}:${source.sourceId}:${question.id}`,
      subjectId: source.subjectId,
      subjectTitle: source.subjectTitle,
      sourceId: source.sourceId,
      sourceTitle: source.sourceTitle,
      question,
      passages: question.passageRefs?.flatMap((id) => passagesById.get(id) ?? []) ?? [],
      choices: options.choiceOrder === 'random' ? shuffled(question.choices) : question.choices,
    }));
  });

  const questions = subjectConfig.extractMode === 'all'
    ? allQuestions
    : extractRandom25(allQuestions);

  return options.questionOrder === 'random' ? shuffled(questions) : questions;
}

// ─── 무작위 25문제 균일 추출 ─────────────────────────────────────────────

/**
 * 문제 ID (예: e17-01, b02-03, l03-05)에서 강 번호를 파싱하여
 * 강별로 균일하게 분포되도록 총 25문제를 추출한다.
 *
 * 알고리즘:
 * 1. 모든 문제를 강 번호별로 그룹핑
 * 2. 총 25문제를 강 수로 나눠 기본 할당량 결정 (floor)
 * 3. 나머지는 문제가 많은 강부터 1개씩 추가 할당
 * 4. 각 강 내에서 할당량만큼 무작위 추출
 * 5. 강 순서대로 정렬하여 최종 목록 생성
 */
export function extractRandom25(questions: QuizSessionQuestion[]): QuizSessionQuestion[] {
  const TARGET = 25;

  if (questions.length <= TARGET) {
    return shuffled(questions);
  }

  // 강 번호 추출: 문제 id에서 첫 번째 숫자 그룹 사용
  const groupKey = (q: QuizSessionQuestion): string => {
    const match = /^[a-z]+(\d+)/i.exec(q.question.id);
    return match?.[1] ?? '0';
  };

  // 강별 그룹핑 (순서 유지)
  const groups = new Map<string, QuizSessionQuestion[]>();
  for (const q of questions) {
    const key = groupKey(q);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(q);
  }

  const groupEntries = [...groups.entries()];
  const groupCount = groupEntries.length;
  const base = Math.floor(TARGET / groupCount);
  let remainder = TARGET - base * groupCount;

  // 문제가 많은 강부터 나머지 할당 (내림차순 정렬)
  const sorted = [...groupEntries].sort(([, a], [, b]) => b.length - a.length);

  const picks: QuizSessionQuestion[] = [];
  for (const [key, group] of sorted) {
    const allocation = base + (remainder > 0 ? 1 : 0);
    if (remainder > 0) remainder -= 1;
    const selected = shuffled(group).slice(0, Math.min(allocation, group.length));
    picks.push(...selected);
    groups.set(key, selected);
  }

  // 강 순서대로 최종 정렬
  return groupEntries.flatMap(([key]) => groups.get(key) ?? []);
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
      i === subjectIndex
        ? { ...s, answers: { ...s.answers, [questionKey]: selected } }
        : s,
    ),
  };

  // 빈 배열이면 키 삭제
  if (selected.length === 0) {
    const answers = { ...subject.answers };
    delete answers[questionKey];
    updated.subjects = updated.subjects.map((s, i) =>
      i === subjectIndex ? { ...s, answers } : s,
    );
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

export function calcMockExamTimes(subjectCount: number): {
  totalMinutes: number;
  startTime: string;
  endTime: string;
} {
  const totalMinutes = subjectCount * 25;
  const startHour = 13;
  const startMinute = 30;
  const endTotalMinute = startHour * 60 + startMinute + totalMinutes;
  const endHour = Math.floor(endTotalMinute / 60);
  const endMinute = endTotalMinute % 60;

  const pad = (n: number) => String(n).padStart(2, '0');
  return {
    totalMinutes,
    startTime: `${pad(startHour)}:${pad(startMinute)}`,
    endTime: `${pad(endHour)}:${pad(endMinute)}`,
  };
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
  return subjectSession.questions.filter(
    (q) => (subjectSession.answers[q.key]?.length ?? 0) > 0,
  ).length;
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
