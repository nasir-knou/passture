import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import yaml from 'js-yaml';

import type { Catalog, CatalogSource, SourceKind } from '../src/types/catalog';
import type { Choice, Passage, Question, QuestionFile } from '../src/types/question';
import type { Syllabus } from '../src/types/syllabus';
import { resolveQuestionChapter, sourceCategory } from '../src/lib/chapter';
import { parseChoiceExplanation } from '../src/lib/explanation';
import { validateChoiceDiagram } from './validate/diagrams';
import {
  expectArray,
  expectKnownKeys,
  expectNumber,
  expectPositiveInteger,
  expectRecord,
  expectSemester,
  expectSourceKind,
  expectString,
  expectUnique,
} from './validate/expect';
import { validateImage } from './validate/image';
import { validateEmphasis, validateMath, validateRichText } from './validate/rich-text';

const repoRoot = process.cwd();
const outdatedDocPath = path.join('docs', 'outdated.md');
const QUESTION_KEYS = [
  'id',
  'type',
  'passageRefs',
  'prompt',
  'images',
  'choices',
  'answers',
  'answerKey',
  'explanation',
  'tags',
  'chapter',
  'outdated',
];
const QUESTION_FILE_KEYS = [
  'subjectId',
  'sourceId',
  'title',
  'kind',
  'year',
  'passages',
  'questions',
];
const CATALOG_KEYS = ['version', 'subjects'];
const CATALOG_SUBJECT_KEYS = ['id', 'title', 'semester', 'syllabus', 'sources'];
// questionCount는 빌드가 문제 수를 세어 채우므로 YAML에는 쓰지 않는다.
const CATALOG_SOURCE_KEYS = ['id', 'title', 'path', 'kind', 'year'];
const CHOICE_KEYS = ['id', 'text', 'image', 'diagram'];
// 지문 유형마다 렌더러가 읽는 필드만 허용한다. 다른 유형의 필드는 화면에서 조용히 무시되거나 우선순위를 뒤집는다.
const PASSAGE_KEYS: Record<Passage['type'], readonly string[]> = {
  text: ['id', 'type', 'body'],
  code: ['id', 'type', 'language', 'body', 'highlights'],
  image: ['id', 'type', 'image'],
  diagram: ['id', 'type', 'diagram'],
};

type BuildResult = {
  catalog: Catalog;
  filesWritten: string[];
};

export function buildData(root = repoRoot): BuildResult {
  const catalogPath = path.join(root, 'data', 'catalog.yaml');
  const publicDataDir = path.join(root, 'public', 'data');
  const catalog = readYamlFile<Catalog>(catalogPath, root);

  validateCatalog(catalog);
  resetDirectory(publicDataDir);

  const filesWritten: string[] = [];
  const outdatedKeys: string[] = [];

  for (const subject of catalog.subjects) {
    let syllabus: Syllabus | undefined;

    if (subject.syllabus !== undefined) {
      const syllabusPath = path.join(root, 'data', subject.syllabus.replace(/\.json$/, '.yaml'));
      const loadedSyllabus = readYamlFile<Syllabus>(syllabusPath, root);
      validateSyllabus(loadedSyllabus, subject.id);
      syllabus = loadedSyllabus;

      const syllabusOutputPath = path.join(publicDataDir, subject.syllabus);
      writeJson(syllabusOutputPath, syllabus);
      filesWritten.push(path.relative(root, syllabusOutputPath));
    }

    for (const source of subject.sources) {
      const questionPath = path.join(root, 'data', source.path.replace(/\.json$/, '.yaml'));
      const questionFile = readYamlFile<QuestionFile>(questionPath, root);
      try {
        validateQuestionFile(questionFile, subject.id, source, root);
      } catch (error) {
        // 필드 경로만으로는 어느 파일인지 알 수 없으므로 원본 YAML 경로를 붙인다.
        const message = error instanceof Error ? error.message : String(error);
        throw new Error(`${path.relative(root, questionPath)}: ${message}`, { cause: error });
      }
      outdatedKeys.push(...validateQuestionChapters(questionFile, source, syllabus));
      source.questionCount = questionFile.questions.length;

      const outputPath = path.join(publicDataDir, source.path);
      writeJson(outputPath, questionFile);
      filesWritten.push(path.relative(root, outputPath));
    }
  }

  validateOutdatedDocument(outdatedKeys, root);

  const catalogOutputPath = path.join(publicDataDir, 'catalog.json');
  writeJson(catalogOutputPath, catalog);
  filesWritten.push(path.relative(root, catalogOutputPath));

  return { catalog, filesWritten };
}

export function validateCatalog(value: unknown): asserts value is Catalog {
  const catalog = expectRecord(value, 'catalog');
  expectKnownKeys(catalog, CATALOG_KEYS, 'catalog');
  expectNumber(catalog.version, 'catalog.version');
  const subjects = expectArray(catalog.subjects, 'catalog.subjects');
  const subjectIds = new Set<string>();
  // 출력 JSON 경로가 겹치면 나중 출처가 앞의 파일을 덮어쓴다.
  const sourcePaths = new Set<string>();

  for (const [subjectIndex, subjectValue] of subjects.entries()) {
    const subjectPath = `catalog.subjects[${subjectIndex}]`;
    const subject = expectRecord(subjectValue, subjectPath);
    expectKnownKeys(subject, CATALOG_SUBJECT_KEYS, subjectPath);
    const subjectId = expectString(subject.id, `${subjectPath}.id`);
    expectUnique(subjectIds, subjectId, `${subjectPath}.id`);
    expectString(subject.title, `${subjectPath}.title`);
    expectSemester(subject.semester, `${subjectPath}.semester`);

    if (subject.syllabus !== undefined) {
      const syllabusPath = expectString(subject.syllabus, `${subjectPath}.syllabus`);
      if (!syllabusPath.endsWith('.json')) {
        throw new Error(`${subjectPath}.syllabus must end with .json`);
      }
    }

    const sources = expectArray(subject.sources, `${subjectPath}.sources`);
    const sourceIds = new Set<string>();

    for (const [sourceIndex, sourceValue] of sources.entries()) {
      const sourcePath = `${subjectPath}.sources[${sourceIndex}]`;
      const source = expectRecord(sourceValue, sourcePath);
      expectKnownKeys(source, CATALOG_SOURCE_KEYS, sourcePath);
      const sourceId = expectString(source.id, `${sourcePath}.id`);
      expectUnique(sourceIds, sourceId, `${sourcePath}.id`);
      expectString(source.title, `${sourcePath}.title`);

      const kind = expectString(source.kind, `${sourcePath}.kind`);
      expectSourceKind(kind, `${sourcePath}.kind`);

      const sourceFilePath = expectString(source.path, `${sourcePath}.path`);
      if (!sourceFilePath.endsWith('.json')) {
        throw new Error(`${sourcePath}.path must end with .json`);
      }
      const subjectDir = `subjects/${subjectId}/`;
      if (
        !sourceFilePath.startsWith(subjectDir) ||
        sourceFilePath.split('/').some((segment) => segment === '..' || segment === '')
      ) {
        throw new Error(`${sourcePath}.path must be under ${subjectDir}: ${sourceFilePath}`);
      }
      expectUnique(sourcePaths, sourceFilePath, `${sourcePath}.path`);

      if (source.year !== undefined) {
        expectPositiveInteger(source.year, `${sourcePath}.year`);
      } else if (kind === 'exam') {
        // 기출 문제 ID(e{yy}-{nn})의 연도 검사와 화면의 연도 표시가 year에 기댄다.
        throw new Error(`${sourcePath}.year is required for exam sources`);
      }
    }
  }
}

export function validateQuestionFile(
  value: unknown,
  expectedSubjectId: string,
  source: CatalogSource,
  root = repoRoot,
): asserts value is QuestionFile {
  const file = expectRecord(value, `question file ${source.id}`);
  expectKnownKeys(file, QUESTION_FILE_KEYS, 'questionFile');
  const subjectId = expectString(file.subjectId, 'questionFile.subjectId');
  const sourceId = expectString(file.sourceId, 'questionFile.sourceId');
  const kind = expectString(file.kind, 'questionFile.kind');

  if (subjectId !== expectedSubjectId) {
    throw new Error(`questionFile.subjectId must be ${expectedSubjectId}, got ${subjectId}`);
  }

  if (sourceId !== source.id) {
    throw new Error(`questionFile.sourceId must be ${source.id}, got ${sourceId}`);
  }

  if (kind !== source.kind) {
    throw new Error(`questionFile.kind must be ${source.kind}, got ${kind}`);
  }

  expectSourceKind(kind, 'questionFile.kind');
  expectString(file.title, 'questionFile.title');

  if (source.year === undefined) {
    if (file.year !== undefined) {
      throw new Error(
        `questionFile.year must be absent because the catalog source has no year, got ${String(file.year)}`,
      );
    }
  } else if (file.year !== source.year) {
    throw new Error(`questionFile.year must be ${source.year}, got ${String(file.year)}`);
  }

  const passages = normalizePassages(file.passages);
  const passageIds = new Set<string>();

  for (const [index, passage] of passages.entries()) {
    validatePassage(passage, `questionFile.passages[${index}]`, root);
    expectUnique(passageIds, passage.id, `questionFile.passages[${index}].id`);
  }

  const questions = expectArray(file.questions, 'questionFile.questions') as Question[];
  const questionIds = new Set<string>();

  for (const [index, question] of questions.entries()) {
    validateQuestion(question, `questionFile.questions[${index}]`, kind, source, passageIds, root);
    expectUnique(questionIds, question.id, `questionFile.questions[${index}].id`);
  }

  // 어떤 문제도 가리키지 않는 지문은 화면에 나오지 않는다. 데이터 정리용 경고만 남긴다.
  const referenced = new Set(questions.flatMap((question) => question.passageRefs ?? []));
  for (const passage of passages) {
    if (!referenced.has(passage.id)) {
      console.warn(
        `WARNING: ${subjectId}:${sourceId}:${passage.id} passage is not referenced by any question`,
      );
    }
  }
}

function validatePassage(
  value: unknown,
  fieldPath: string,
  root: string,
): asserts value is Passage {
  const passage = expectRecord(value, fieldPath);
  const id = expectString(passage.id, `${fieldPath}.id`);
  if (!id.startsWith('g')) {
    throw new Error(`${fieldPath}.id must start with g`);
  }

  const type = expectString(passage.type, `${fieldPath}.type`);
  if (!Object.hasOwn(PASSAGE_KEYS, type)) {
    throw new Error(`${fieldPath}.type must be text, code, image, or diagram`);
  }

  const allowedKeys = PASSAGE_KEYS[type as Passage['type']];
  const strayKeys = Object.keys(passage).filter((key) => !allowedKeys.includes(key));
  if (strayKeys.length > 0) {
    throw new Error(
      `${fieldPath} has keys not allowed for ${type} passages (${strayKeys.join(', ')})`,
    );
  }

  if (type === 'text') {
    const body = expectString(passage.body, `${fieldPath}.body`);
    validateRichText(body, `${fieldPath}.body`);
    return;
  }

  if (type === 'code') {
    const body = expectString(passage.body, `${fieldPath}.body`);

    if (passage.language !== undefined) {
      expectString(passage.language, `${fieldPath}.language`);
    }

    if (passage.highlights !== undefined) {
      const highlights = expectArray(passage.highlights, `${fieldPath}.highlights`);
      for (const [highlightIndex, rawHighlight] of highlights.entries()) {
        const highlightPath = `${fieldPath}.highlights[${highlightIndex}]`;
        // 강조 문자열은 리치 텍스트로 그리지 않으므로 수식 검사를 하지 않는다(셸 `$1` 같은 글자가 그대로 들어간다).
        const highlight = expectString(rawHighlight, highlightPath);
        // 본문에 없는 강조 문자열은 화면에서 아무것도 표시하지 않는다.
        if (!body.includes(highlight)) {
          throw new Error(`${highlightPath} does not occur in the passage body: ${highlight}`);
        }
      }
    }
    return;
  }

  if (type === 'image') {
    if (passage.image === undefined) {
      throw new Error(`${fieldPath}.image is required for image passages`);
    }
    validateImage(passage.image, `${fieldPath}.image`, root);
    return;
  }

  if (passage.diagram === undefined) {
    throw new Error(`${fieldPath}.diagram is required for diagram passages`);
  }
  validateChoiceDiagram(passage.diagram, `${fieldPath}.diagram`);
}

function validateQuestion(
  value: unknown,
  fieldPath: string,
  kind: SourceKind,
  source: CatalogSource,
  passageIds: Set<string>,
  root: string,
): asserts value is Question {
  const question = expectRecord(value, fieldPath);
  const id = expectString(question.id, `${fieldPath}.id`);
  validateQuestionId(id, kind, source, `${fieldPath}.id`);

  // passageRefs를 passages로 잘못 쓰면 지문이 조용히 사라지므로 모르는 키는 실패시킨다.
  expectKnownKeys(question, QUESTION_KEYS, fieldPath);

  const type = expectString(question.type, `${fieldPath}.type`);
  if (!['multiple-choice', 'multi-answer', 'ox'].includes(type)) {
    throw new Error(`${fieldPath}.type must be multiple-choice, multi-answer, or ox`);
  }

  validateRichText(expectString(question.prompt, `${fieldPath}.prompt`), `${fieldPath}.prompt`);
  const explanation = expectString(question.explanation, `${fieldPath}.explanation`);
  // 해설은 선택지별 줄 단위로 렌더링되므로 수식은 줄마다 검사한다. `==` 검사는 줄 번호를 직접 센다.
  for (const [lineIndex, line] of explanation.split('\n').entries()) {
    validateMath(line, `${fieldPath}.explanation line ${lineIndex + 1}`);
  }
  validateEmphasis(explanation, `${fieldPath}.explanation`);

  const choices = expectArray(question.choices, `${fieldPath}.choices`) as Choice[];
  const choiceIds = new Set<string>();

  for (const [choiceIndex, choice] of choices.entries()) {
    validateChoice(choice, `${fieldPath}.choices[${choiceIndex}]`, root);
    expectUnique(choiceIds, choice.id, `${fieldPath}.choices[${choiceIndex}].id`);
  }

  const answers = expectArray(question.answers, `${fieldPath}.answers`);
  if (answers.length === 0) {
    throw new Error(`${fieldPath}.answers must not be empty`);
  }

  const answerIds = new Set<string>();
  for (const [answerIndex, answer] of answers.entries()) {
    const answerId = expectString(answer, `${fieldPath}.answers[${answerIndex}]`);
    if (!choiceIds.has(answerId)) {
      throw new Error(`${fieldPath}.answers[${answerIndex}] does not match any choices.id`);
    }
    if (answerIds.has(answerId)) {
      throw new Error(`${fieldPath}.answers[${answerIndex}] duplicates answer ${answerId}`);
    }
    answerIds.add(answerId);
  }

  // 채점은 선택 개수와 정답 개수가 같아야 맞으므로 유형별 정답 개수를 강제한다.
  if (type === 'multiple-choice' && answers.length !== 1) {
    throw new Error(`${fieldPath}.answers must have exactly 1 answer for multiple-choice`);
  }
  if (type === 'multi-answer' && answers.length < 2) {
    throw new Error(`${fieldPath}.answers must have at least 2 answers for multi-answer`);
  }
  if (type === 'ox') {
    if (choices.length !== 2) {
      throw new Error(`${fieldPath}.choices must have exactly 2 choices for ox`);
    }
    if (answers.length !== 1) {
      throw new Error(`${fieldPath}.answers must have exactly 1 answer for ox`);
    }
  }

  // 화면과 같은 파서로 읽어, 없는 선택지를 가리키는 해설 줄이 조용히 버려지지 않게 한다.
  for (const choiceId of parseChoiceExplanation(explanation).choiceReasons.keys()) {
    if (!choiceIds.has(choiceId)) {
      throw new Error(
        `${fieldPath}.explanation references missing choice "${choiceId}" in a 선택지 line`,
      );
    }
  }

  if (question.passageRefs !== undefined) {
    const passageRefs = expectArray(question.passageRefs, `${fieldPath}.passageRefs`);
    for (const [refIndex, ref] of passageRefs.entries()) {
      const passageRef = expectString(ref, `${fieldPath}.passageRefs[${refIndex}]`);
      if (!passageIds.has(passageRef)) {
        throw new Error(`${fieldPath}.passageRefs[${refIndex}] references missing passage`);
      }
    }
  }

  if (question.images !== undefined) {
    const images = expectArray(question.images, `${fieldPath}.images`);
    for (const [imageIndex, image] of images.entries()) {
      validateImage(image, `${fieldPath}.images[${imageIndex}]`, root);
    }
  }

  if (question.tags !== undefined) {
    const tags = expectArray(question.tags, `${fieldPath}.tags`);
    for (const [tagIndex, tag] of tags.entries()) {
      expectString(tag, `${fieldPath}.tags[${tagIndex}]`);
    }
  }

  if (question.answerKey !== undefined) {
    // 정답 표기는 리치 텍스트로 그리지 않으므로 문자열인지만 확인한다.
    expectString(question.answerKey, `${fieldPath}.answerKey`);
  }

  if (question.chapter !== undefined) {
    const chapter = expectNumber(question.chapter, `${fieldPath}.chapter`);
    if (!Number.isInteger(chapter) || chapter < 1) {
      throw new Error(`${fieldPath}.chapter must be a positive integer`);
    }
  }

  if (question.outdated !== undefined && question.outdated !== true) {
    throw new Error(`${fieldPath}.outdated must be true when present`);
  }

  if (question.chapter !== undefined && question.outdated !== undefined) {
    throw new Error(`${fieldPath} must not have both chapter and outdated`);
  }
}

export function validateSyllabus(
  value: unknown,
  expectedSubjectId: string,
): asserts value is Syllabus {
  const syllabus = expectRecord(value, 'syllabus');
  const subjectId = expectString(syllabus.subjectId, 'syllabus.subjectId');
  if (subjectId !== expectedSubjectId) {
    throw new Error(`syllabus.subjectId must be ${expectedSubjectId}, got ${subjectId}`);
  }
  expectString(syllabus.title, 'syllabus.title');

  const chapters = expectArray(syllabus.chapters, 'syllabus.chapters');
  if (chapters.length === 0) {
    throw new Error('syllabus.chapters must not be empty');
  }

  const chapterNumbers = new Set<number>();
  for (const [index, rawChapter] of chapters.entries()) {
    const fieldPath = `syllabus.chapters[${index}]`;
    const chapter = expectRecord(rawChapter, fieldPath);
    const no = expectPositiveInteger(chapter.no, `${fieldPath}.no`);
    if (chapterNumbers.has(no)) {
      throw new Error(`${fieldPath}.no must be unique: ${no}`);
    }
    chapterNumbers.add(no);
    expectString(chapter.title, `${fieldPath}.title`);

    if (chapter.sections !== undefined) {
      const sections = expectArray(chapter.sections, `${fieldPath}.sections`);
      for (const [sectionIndex, rawSection] of sections.entries()) {
        const section = expectRecord(rawSection, `${fieldPath}.sections[${sectionIndex}]`);
        expectString(section.no, `${fieldPath}.sections[${sectionIndex}].no`);
        expectString(section.title, `${fieldPath}.sections[${sectionIndex}].title`);
      }
    }
  }

  if (syllabus.parts !== undefined) {
    const parts = expectArray(syllabus.parts, 'syllabus.parts');
    const partNumbers = new Set<number>();
    const partChapters = new Set<number>();
    for (const [index, rawPart] of parts.entries()) {
      const fieldPath = `syllabus.parts[${index}]`;
      const part = expectRecord(rawPart, fieldPath);
      const no = expectPositiveInteger(part.no, `${fieldPath}.no`);
      if (partNumbers.has(no)) {
        throw new Error(`${fieldPath}.no must be unique: ${no}`);
      }
      partNumbers.add(no);
      expectString(part.title, `${fieldPath}.title`);
      expectChapterRefs(part.chapters, `${fieldPath}.chapters`, chapterNumbers);
      for (const chapter of part.chapters as number[]) {
        if (partChapters.has(chapter)) {
          throw new Error(`${fieldPath}.chapters: chapter ${chapter} belongs to another part`);
        }
        partChapters.add(chapter);
      }
    }

    // 부 구분이 있으면 모든 장이 정확히 한 부에 속해야 선택 화면에 빠짐없이 나온다.
    const missing = [...chapterNumbers].filter((chapter) => !partChapters.has(chapter));
    if (missing.length > 0) {
      throw new Error(`syllabus.parts must include every chapter; missing ${missing.join(', ')}`);
    }
  }

  const lectures = expectArray(syllabus.lectures, 'syllabus.lectures');
  const lectureNumbers = new Set<number>();
  for (const [index, rawLecture] of lectures.entries()) {
    const fieldPath = `syllabus.lectures[${index}]`;
    const lecture = expectRecord(rawLecture, fieldPath);
    const no = expectPositiveInteger(lecture.no, `${fieldPath}.no`);
    if (lectureNumbers.has(no)) {
      throw new Error(`${fieldPath}.no must be unique: ${no}`);
    }
    lectureNumbers.add(no);
    expectString(lecture.title, `${fieldPath}.title`);
    expectChapterRefs(lecture.chapters, `${fieldPath}.chapters`, chapterNumbers);
  }
}

/**
 * syllabus가 있는 과목은 모든 문제가 교재 장 하나에 배정되거나 outdated여야 한다.
 * outdated 문제의 키 목록을 돌려준다.
 */
export function validateQuestionChapters(
  file: QuestionFile,
  source: CatalogSource,
  syllabus: Syllabus | undefined,
): string[] {
  const outdatedKeys: string[] = [];

  for (const [index, question] of file.questions.entries()) {
    const fieldPath = `${file.subjectId}:${source.id}:${question.id}`;

    if (!syllabus) {
      if (question.chapter !== undefined || question.outdated !== undefined) {
        throw new Error(`${fieldPath} uses chapter/outdated but the subject has no syllabus`);
      }
      continue;
    }

    if (question.outdated) {
      if (sourceCategory(source.kind) !== 'exam') {
        throw new Error(`${fieldPath} outdated: true is only allowed on exam questions`);
      }
      outdatedKeys.push(fieldPath);
      continue;
    }

    const chapter = resolveQuestionChapter(question, source.kind, syllabus);
    if (chapter === undefined) {
      const hint =
        source.kind === 'lecture'
          ? 'lecture number is missing from syllabus.lectures'
          : 'add chapter or outdated: true';
      throw new Error(`questionFile.questions[${index}] ${fieldPath} has no chapter (${hint})`);
    }

    if (!syllabus.chapters.some((item) => item.no === chapter)) {
      throw new Error(`${fieldPath} chapter ${chapter} is not in syllabus.chapters`);
    }
  }

  return outdatedKeys;
}

/** outdated: true 문제와 docs/outdated.md에 적힌 문제 키가 정확히 일치해야 한다. */
export function validateOutdatedDocument(outdatedKeys: readonly string[], root = repoRoot): void {
  const docPath = path.join(root, outdatedDocPath);
  const documented = new Set<string>();

  if (fs.existsSync(docPath)) {
    // 목록 항목(`- \`{subjectId}:{sourceId}:{questionId}\` — ...`)의 첫 백틱 키만 읽는다.
    const text = fs.readFileSync(docPath, 'utf8');
    for (const match of text.matchAll(/^\s*[-*]\s+`([a-z0-9-]+:[a-z0-9-]+:[a-z0-9-]+)`/gim)) {
      documented.add(match[1]!);
    }
  }

  const expected = new Set(outdatedKeys);
  const undocumented = [...expected].filter((key) => !documented.has(key));
  const stale = [...documented].filter((key) => !expected.has(key));

  if (undocumented.length > 0) {
    throw new Error(`${outdatedDocPath} is missing outdated questions: ${undocumented.join(', ')}`);
  }

  if (stale.length > 0) {
    throw new Error(`${outdatedDocPath} lists questions not marked outdated: ${stale.join(', ')}`);
  }
}

function expectChapterRefs(value: unknown, fieldPath: string, chapterNumbers: Set<number>): void {
  const refs = expectArray(value, fieldPath);
  if (refs.length === 0) {
    throw new Error(`${fieldPath} must not be empty`);
  }

  for (const [index, ref] of refs.entries()) {
    const chapter = expectPositiveInteger(ref, `${fieldPath}[${index}]`);
    if (!chapterNumbers.has(chapter)) {
      throw new Error(`${fieldPath}[${index}] references missing chapter ${chapter}`);
    }
  }
}

function validateChoice(value: unknown, fieldPath: string, root: string): asserts value is Choice {
  const choice = expectRecord(value, fieldPath);
  expectString(choice.id, `${fieldPath}.id`);

  // YAML flow mapping에서 따옴표 없는 text에 쉼표가 있으면 값이 잘리고 나머지가 키가 된다.
  expectKnownKeys(choice, CHOICE_KEYS, fieldPath, '; quote text that contains commas');
  if (typeof choice.text !== 'string') {
    throw new Error(`${fieldPath}.text must be a string`);
  }

  validateRichText(choice.text, `${fieldPath}.text`);

  if (choice.text.length === 0 && choice.image === undefined && choice.diagram === undefined) {
    throw new Error(`${fieldPath}.text must be non-empty when image or diagram is missing`);
  }

  if (choice.image !== undefined) {
    validateImage(choice.image, `${fieldPath}.image`, root);
  }

  if (choice.diagram !== undefined) {
    validateChoiceDiagram(choice.diagram, `${fieldPath}.diagram`);
  }
}

function validateQuestionId(
  id: string,
  kind: SourceKind,
  source: CatalogSource,
  fieldPath: string,
): void {
  if (kind === 'exam') {
    const yearSuffix =
      source.year === undefined ? String.raw`\d{2}` : String(source.year).slice(-2);
    const pattern = new RegExp(`^e${yearSuffix}-\\d{2}$`);
    if (!pattern.test(id)) {
      throw new Error(`${fieldPath} must match e{yy}-{nn} for exam sources`);
    }
    return;
  }

  if (kind === 'textbook' && !/^t\d{2}-\d{2}$/.test(id)) {
    throw new Error(`${fieldPath} must match t{chapter}-{nn} for textbook sources`);
  }

  if (kind === 'workbook' && !/^b\d{2}-\d{2}$/.test(id)) {
    throw new Error(`${fieldPath} must match b{chapter}-{nn} for workbook sources`);
  }

  if (kind === 'lecture' && !/^l\d{2}-\d{2}$/.test(id)) {
    throw new Error(`${fieldPath} must match l{lecture}-{nn} for lecture sources`);
  }

  if (kind === 'intensive' && !/^i\d{2}-\d{2}$/.test(id)) {
    throw new Error(`${fieldPath} must match i{unit}-{nn} for intensive sources`);
  }
}

function readYamlFile<T>(filePath: string, root: string): T {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Missing YAML file: ${path.relative(root, filePath)}`);
  }

  return yaml.load(fs.readFileSync(filePath, 'utf8')) as T;
}

function writeJson(filePath: string, value: unknown): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(value));
}

function resetDirectory(dirPath: string): void {
  fs.rmSync(dirPath, { recursive: true, force: true });
  fs.mkdirSync(dirPath, { recursive: true });
}

function normalizePassages(value: unknown): Passage[] {
  if (value === undefined) {
    return [];
  }

  return expectArray(value, 'questionFile.passages') as Passage[];
}

// 경로에 공백·한글이 있으면 URL pathname은 퍼센트 인코딩되므로 파일 경로로 바꿔 비교한다.
const isCli =
  process.argv[1] !== undefined &&
  path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));

if (isCli) {
  const result = buildData();
  for (const file of result.filesWritten) {
    console.log(`wrote ${file}`);
  }
}
