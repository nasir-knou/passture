import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import yaml from 'js-yaml';

import type { Catalog, CatalogSource, SourceKind } from '../src/types/catalog';
import type { Choice, Passage, Question, QuestionFile } from '../src/types/question';
import type { Syllabus } from '../src/types/syllabus';
import { resolveQuestionChapter, sourceCategory } from '../src/lib/chapter';

const repoRoot = process.cwd();
const outdatedDocPath = path.join('docs', 'outdated.md');

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
      validateQuestionFile(questionFile, subject.id, source, root);
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
  expectNumber(catalog.version, 'catalog.version');
  const subjects = expectArray(catalog.subjects, 'catalog.subjects');
  const subjectIds = new Set<string>();

  for (const [subjectIndex, subjectValue] of subjects.entries()) {
    const subjectPath = `catalog.subjects[${subjectIndex}]`;
    const subject = expectRecord(subjectValue, subjectPath);
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
      const sourceId = expectString(source.id, `${sourcePath}.id`);
      expectUnique(sourceIds, sourceId, `${sourcePath}.id`);
      expectString(source.title, `${sourcePath}.title`);

      const kind = expectString(source.kind, `${sourcePath}.kind`);
      expectSourceKind(kind, `${sourcePath}.kind`);

      const sourceFilePath = expectString(source.path, `${sourcePath}.path`);
      if (!sourceFilePath.endsWith('.json')) {
        throw new Error(`${sourcePath}.path must end with .json`);
      }

      if (source.year !== undefined) {
        expectNumber(source.year, `${sourcePath}.year`);
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

  if (source.year !== undefined && file.year !== source.year) {
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
  if (!['text', 'code', 'image', 'diagram'].includes(type)) {
    throw new Error(`${fieldPath}.type must be text, code, image, or diagram`);
  }

  if (passage.language !== undefined) {
    expectString(passage.language, `${fieldPath}.language`);
  }

  if (passage.body !== undefined) {
    expectString(passage.body, `${fieldPath}.body`);
  }

  if (passage.highlights !== undefined) {
    const highlights = expectArray(passage.highlights, `${fieldPath}.highlights`);
    for (const [highlightIndex, highlight] of highlights.entries()) {
      expectString(highlight, `${fieldPath}.highlights[${highlightIndex}]`);
    }
  }

  if (passage.image !== undefined) {
    validateImage(passage.image, `${fieldPath}.image`, root);
  }

  if (passage.diagram !== undefined) {
    validateChoiceDiagram(passage.diagram, `${fieldPath}.diagram`);
  }
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

  const type = expectString(question.type, `${fieldPath}.type`);
  if (!['multiple-choice', 'multi-answer', 'ox'].includes(type)) {
    throw new Error(`${fieldPath}.type must be multiple-choice, multi-answer, or ox`);
  }

  expectString(question.prompt, `${fieldPath}.prompt`);
  expectString(question.explanation, `${fieldPath}.explanation`);

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

  for (const [answerIndex, answer] of answers.entries()) {
    const answerId = expectString(answer, `${fieldPath}.answers[${answerIndex}]`);
    if (!choiceIds.has(answerId)) {
      throw new Error(`${fieldPath}.answers[${answerIndex}] does not match any choices.id`);
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
  const unknownKeys = Object.keys(choice).filter(
    (key) => !['id', 'text', 'image', 'diagram'].includes(key),
  );
  if (unknownKeys.length > 0) {
    throw new Error(
      `${fieldPath} has unknown keys (${unknownKeys.join(', ')}); quote text that contains commas`,
    );
  }
  if (typeof choice.text !== 'string') {
    throw new Error(`${fieldPath}.text must be a string`);
  }

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

function validateChoiceDiagram(value: unknown, fieldPath: string): void {
  const diagram = expectRecord(value, fieldPath);
  const type = expectString(diagram.type, `${fieldPath}.type`);

  if (
    ![
      'resource-allocation-graph',
      'simple-graph',
      'ui-window',
      'memory-free-list',
      'data-table',
      'clock-page-replacement',
    ].includes(type)
  ) {
    throw new Error(
      `${fieldPath}.type must be resource-allocation-graph, simple-graph, ui-window, memory-free-list, data-table, or clock-page-replacement`,
    );
  }

  if (type === 'simple-graph') {
    validateSimpleGraphDiagram(diagram, fieldPath);
    return;
  }

  if (type === 'ui-window') {
    validateUiWindowDiagram(diagram, fieldPath);
    return;
  }

  if (type === 'memory-free-list') {
    validateMemoryFreeListDiagram(diagram, fieldPath);
    return;
  }

  if (type === 'data-table') {
    validateDataTableDiagram(diagram, fieldPath);
    return;
  }

  if (type === 'clock-page-replacement') {
    validateClockPageReplacementDiagram(diagram, fieldPath);
    return;
  }

  expectNumber(diagram.width, `${fieldPath}.width`);
  expectNumber(diagram.height, `${fieldPath}.height`);

  const nodes = expectArray(diagram.nodes, `${fieldPath}.nodes`);
  const nodeIds = new Set<string>();

  for (const [nodeIndex, rawNode] of nodes.entries()) {
    const node = expectRecord(rawNode, `${fieldPath}.nodes[${nodeIndex}]`);
    const id = expectString(node.id, `${fieldPath}.nodes[${nodeIndex}].id`);
    expectUnique(nodeIds, id, `${fieldPath}.nodes[${nodeIndex}].id`);

    const kind = expectString(node.kind, `${fieldPath}.nodes[${nodeIndex}].kind`);
    if (!['process', 'resource'].includes(kind)) {
      throw new Error(`${fieldPath}.nodes[${nodeIndex}].kind must be process or resource`);
    }

    expectString(node.label, `${fieldPath}.nodes[${nodeIndex}].label`);
    if (node.hideLabel !== undefined && typeof node.hideLabel !== 'boolean') {
      throw new Error(`${fieldPath}.nodes[${nodeIndex}].hideLabel must be boolean`);
    }
    if (node.hideNode !== undefined && typeof node.hideNode !== 'boolean') {
      throw new Error(`${fieldPath}.nodes[${nodeIndex}].hideNode must be boolean`);
    }
    if (node.fontSize !== undefined) {
      expectNumber(node.fontSize, `${fieldPath}.nodes[${nodeIndex}].fontSize`);
    }
    if (node.labelDx !== undefined) {
      expectNumber(node.labelDx, `${fieldPath}.nodes[${nodeIndex}].labelDx`);
    }
    if (node.labelDy !== undefined) {
      expectNumber(node.labelDy, `${fieldPath}.nodes[${nodeIndex}].labelDy`);
    }
    if (node.radius !== undefined) {
      expectNumber(node.radius, `${fieldPath}.nodes[${nodeIndex}].radius`);
    }
    if (node.shape !== undefined) {
      const shape = expectString(node.shape, `${fieldPath}.nodes[${nodeIndex}].shape`);
      if (!['circle', 'box'].includes(shape)) {
        throw new Error(`${fieldPath}.nodes[${nodeIndex}].shape must be circle or box`);
      }
    }
    if (node.width !== undefined) {
      expectNumber(node.width, `${fieldPath}.nodes[${nodeIndex}].width`);
    }
    expectNumber(node.x, `${fieldPath}.nodes[${nodeIndex}].x`);
    expectNumber(node.y, `${fieldPath}.nodes[${nodeIndex}].y`);
    if (node.height !== undefined) {
      expectNumber(node.height, `${fieldPath}.nodes[${nodeIndex}].height`);
    }

    if (node.units !== undefined) {
      expectNumber(node.units, `${fieldPath}.nodes[${nodeIndex}].units`);
    }
  }

  const edges = expectArray(diagram.edges, `${fieldPath}.edges`);
  for (const [edgeIndex, rawEdge] of edges.entries()) {
    const edge = expectRecord(rawEdge, `${fieldPath}.edges[${edgeIndex}]`);
    const from = expectString(edge.from, `${fieldPath}.edges[${edgeIndex}].from`);
    const to = expectString(edge.to, `${fieldPath}.edges[${edgeIndex}].to`);

    if (edge.style !== undefined) {
      const style = expectString(edge.style, `${fieldPath}.edges[${edgeIndex}].style`);
      if (!['solid', 'dashed'].includes(style)) {
        throw new Error(`${fieldPath}.edges[${edgeIndex}].style must be solid or dashed`);
      }
    }
    if (edge.label !== undefined) {
      expectString(edge.label, `${fieldPath}.edges[${edgeIndex}].label`);
    }
    if (edge.labelDx !== undefined) {
      expectNumber(edge.labelDx, `${fieldPath}.edges[${edgeIndex}].labelDx`);
    }
    if (edge.labelDy !== undefined) {
      expectNumber(edge.labelDy, `${fieldPath}.edges[${edgeIndex}].labelDy`);
    }

    if (!nodeIds.has(from)) {
      throw new Error(`${fieldPath}.edges[${edgeIndex}].from references missing node`);
    }

    if (!nodeIds.has(to)) {
      throw new Error(`${fieldPath}.edges[${edgeIndex}].to references missing node`);
    }
  }
}

function validateSimpleGraphDiagram(diagram: Record<string, unknown>, fieldPath: string): void {
  expectNumber(diagram.width, `${fieldPath}.width`);
  expectNumber(diagram.height, `${fieldPath}.height`);

  if (diagram.directed !== undefined && typeof diagram.directed !== 'boolean') {
    throw new Error(`${fieldPath}.directed must be boolean`);
  }

  const nodes = expectArray(diagram.nodes, `${fieldPath}.nodes`);
  const nodeIds = new Set<string>();

  for (const [nodeIndex, rawNode] of nodes.entries()) {
    const node = expectRecord(rawNode, `${fieldPath}.nodes[${nodeIndex}]`);
    const id = expectString(node.id, `${fieldPath}.nodes[${nodeIndex}].id`);
    expectUnique(nodeIds, id, `${fieldPath}.nodes[${nodeIndex}].id`);
    expectString(node.label, `${fieldPath}.nodes[${nodeIndex}].label`);
    if (node.hideLabel !== undefined && typeof node.hideLabel !== 'boolean') {
      throw new Error(`${fieldPath}.nodes[${nodeIndex}].hideLabel must be boolean`);
    }
    if (node.hideNode !== undefined && typeof node.hideNode !== 'boolean') {
      throw new Error(`${fieldPath}.nodes[${nodeIndex}].hideNode must be boolean`);
    }
    if (node.labelDx !== undefined) {
      expectNumber(node.labelDx, `${fieldPath}.nodes[${nodeIndex}].labelDx`);
    }
    if (node.labelDy !== undefined) {
      expectNumber(node.labelDy, `${fieldPath}.nodes[${nodeIndex}].labelDy`);
    }
    expectNumber(node.x, `${fieldPath}.nodes[${nodeIndex}].x`);
    expectNumber(node.y, `${fieldPath}.nodes[${nodeIndex}].y`);
  }

  const edges = expectArray(diagram.edges, `${fieldPath}.edges`);
  for (const [edgeIndex, rawEdge] of edges.entries()) {
    const edge = expectRecord(rawEdge, `${fieldPath}.edges[${edgeIndex}]`);
    const from = expectString(edge.from, `${fieldPath}.edges[${edgeIndex}].from`);
    const to = expectString(edge.to, `${fieldPath}.edges[${edgeIndex}].to`);

    if (!nodeIds.has(from)) {
      throw new Error(`${fieldPath}.edges[${edgeIndex}].from references missing node`);
    }

    if (!nodeIds.has(to)) {
      throw new Error(`${fieldPath}.edges[${edgeIndex}].to references missing node`);
    }

    if (edge.label !== undefined) {
      expectString(edge.label, `${fieldPath}.edges[${edgeIndex}].label`);
    }

    if (edge.directed !== undefined && typeof edge.directed !== 'boolean') {
      throw new Error(`${fieldPath}.edges[${edgeIndex}].directed must be boolean`);
    }

    if (edge.curve !== undefined) {
      expectNumber(edge.curve, `${fieldPath}.edges[${edgeIndex}].curve`);
    }

    if (edge.style !== undefined) {
      const style = expectString(edge.style, `${fieldPath}.edges[${edgeIndex}].style`);
      if (!['solid', 'dashed'].includes(style)) {
        throw new Error(`${fieldPath}.edges[${edgeIndex}].style must be solid or dashed`);
      }
    }
  }
}

function validateUiWindowDiagram(diagram: Record<string, unknown>, fieldPath: string): void {
  expectNumber(diagram.width, `${fieldPath}.width`);
  expectNumber(diagram.height, `${fieldPath}.height`);
  expectString(diagram.title, `${fieldPath}.title`);

  const components = expectArray(diagram.components, `${fieldPath}.components`);
  if (components.length === 0) {
    throw new Error(`${fieldPath}.components must not be empty`);
  }

  for (const [componentIndex, rawComponent] of components.entries()) {
    const component = expectRecord(rawComponent, `${fieldPath}.components[${componentIndex}]`);
    const kind = expectString(component.kind, `${fieldPath}.components[${componentIndex}].kind`);
    if (!['checkbox', 'radio', 'label'].includes(kind)) {
      throw new Error(
        `${fieldPath}.components[${componentIndex}].kind must be checkbox, radio, or label`,
      );
    }

    expectString(component.label, `${fieldPath}.components[${componentIndex}].label`);
    expectNumber(component.x, `${fieldPath}.components[${componentIndex}].x`);
    expectNumber(component.y, `${fieldPath}.components[${componentIndex}].y`);

    if (component.checked !== undefined && typeof component.checked !== 'boolean') {
      throw new Error(`${fieldPath}.components[${componentIndex}].checked must be boolean`);
    }

    if (component.focused !== undefined && typeof component.focused !== 'boolean') {
      throw new Error(`${fieldPath}.components[${componentIndex}].focused must be boolean`);
    }
  }
}

function validateMemoryFreeListDiagram(diagram: Record<string, unknown>, fieldPath: string): void {
  expectNumber(diagram.width, `${fieldPath}.width`);
  expectNumber(diagram.height, `${fieldPath}.height`);

  const blocks = expectArray(diagram.blocks, `${fieldPath}.blocks`);
  const blockIds = new Set<string>();

  for (const [blockIndex, rawBlock] of blocks.entries()) {
    const block = expectRecord(rawBlock, `${fieldPath}.blocks[${blockIndex}]`);
    const id = expectString(block.id, `${fieldPath}.blocks[${blockIndex}].id`);
    expectUnique(blockIds, id, `${fieldPath}.blocks[${blockIndex}].id`);

    const kind = expectString(block.kind, `${fieldPath}.blocks[${blockIndex}].kind`);
    if (!['os', 'allocated', 'free'].includes(kind)) {
      throw new Error(`${fieldPath}.blocks[${blockIndex}].kind must be os, allocated, or free`);
    }

    expectString(block.label, `${fieldPath}.blocks[${blockIndex}].label`);

    if (block.size !== undefined) {
      expectNumber(block.size, `${fieldPath}.blocks[${blockIndex}].size`);
    }
  }
}

function validateDataTableDiagram(diagram: Record<string, unknown>, fieldPath: string): void {
  if (diagram.cellFormat !== undefined) {
    const cellFormat = expectString(diagram.cellFormat, `${fieldPath}.cellFormat`);
    if (!['text', 'code'].includes(cellFormat)) {
      throw new Error(`${fieldPath}.cellFormat must be text or code`);
    }
  }

  const columns = expectArray(diagram.columns, `${fieldPath}.columns`);
  if (columns.length === 0) {
    throw new Error(`${fieldPath}.columns must not be empty`);
  }

  for (const [columnIndex, column] of columns.entries()) {
    expectString(column, `${fieldPath}.columns[${columnIndex}]`);
  }

  const rows = expectArray(diagram.rows, `${fieldPath}.rows`);
  if (rows.length === 0) {
    throw new Error(`${fieldPath}.rows must not be empty`);
  }

  for (const [rowIndex, rawRow] of rows.entries()) {
    const row = expectArray(rawRow, `${fieldPath}.rows[${rowIndex}]`);
    if (row.length !== columns.length) {
      throw new Error(`${fieldPath}.rows[${rowIndex}] must have ${columns.length} cells`);
    }

    for (const [cellIndex, cell] of row.entries()) {
      expectString(cell, `${fieldPath}.rows[${rowIndex}][${cellIndex}]`);
    }
  }
}

function validateClockPageReplacementDiagram(
  diagram: Record<string, unknown>,
  fieldPath: string,
): void {
  expectNumber(diagram.width, `${fieldPath}.width`);
  expectNumber(diagram.height, `${fieldPath}.height`);

  const entries = expectArray(diagram.entries, `${fieldPath}.entries`);
  if (entries.length === 0) {
    throw new Error(`${fieldPath}.entries must not be empty`);
  }

  for (const [entryIndex, rawEntry] of entries.entries()) {
    const entry = expectRecord(rawEntry, `${fieldPath}.entries[${entryIndex}]`);
    expectString(entry.page, `${fieldPath}.entries[${entryIndex}].page`);

    if (entry.referenceBit !== 0 && entry.referenceBit !== 1) {
      throw new Error(`${fieldPath}.entries[${entryIndex}].referenceBit must be 0 or 1`);
    }
  }

  const pointerIndex = expectNumber(diagram.pointerIndex, `${fieldPath}.pointerIndex`);
  if (pointerIndex < 0 || pointerIndex >= entries.length || !Number.isInteger(pointerIndex)) {
    throw new Error(`${fieldPath}.pointerIndex must point to an entry index`);
  }
}

function validateImage(value: unknown, fieldPath: string, root: string): void {
  const image = expectRecord(value, fieldPath);
  const imagePath = expectString(image.path, `${fieldPath}.path`);
  expectString(image.alt, `${fieldPath}.alt`);

  const repoPath = path.join(root, imagePath);
  const publicPath = path.join(root, 'public', imagePath);
  if (!fs.existsSync(repoPath) && !fs.existsSync(publicPath)) {
    throw new Error(`${fieldPath}.path file does not exist: ${imagePath}`);
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
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
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

function expectRecord(value: unknown, fieldPath: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error(`${fieldPath} must be an object`);
  }

  return value as Record<string, unknown>;
}

function expectArray(value: unknown, fieldPath: string): unknown[] {
  if (!Array.isArray(value)) {
    throw new Error(`${fieldPath} must be an array`);
  }

  return value;
}

function expectString(value: unknown, fieldPath: string): string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`${fieldPath} must be a non-empty string`);
  }

  return value;
}

function expectNumber(value: unknown, fieldPath: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`${fieldPath} must be a number`);
  }

  return value;
}

function expectPositiveInteger(value: unknown, fieldPath: string): number {
  const number = expectNumber(value, fieldPath);
  if (!Number.isInteger(number) || number < 1) {
    throw new Error(`${fieldPath} must be a positive integer`);
  }

  return number;
}

function expectUnique(seen: Set<string>, value: string, fieldPath: string): void {
  if (seen.has(value)) {
    throw new Error(`${fieldPath} must be unique: ${value}`);
  }

  seen.add(value);
}

function expectSourceKind(value: string, fieldPath: string): asserts value is SourceKind {
  if (!['exam', 'textbook', 'workbook', 'lecture', 'intensive'].includes(value)) {
    throw new Error(`${fieldPath} must be exam, textbook, workbook, lecture, or intensive`);
  }
}

function expectSemester(value: unknown, fieldPath: string): asserts value is 1 | 2 {
  if (value !== 1 && value !== 2) {
    throw new Error(`${fieldPath} must be 1 or 2`);
  }
}

if (process.argv[1] === new URL(import.meta.url).pathname) {
  const result = buildData();
  for (const file of result.filesWritten) {
    console.log(`wrote ${file}`);
  }
}
