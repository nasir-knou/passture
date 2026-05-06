import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import yaml from 'js-yaml';

import type { Catalog, CatalogSource, SourceKind } from '../src/types/catalog';
import type { Choice, Passage, Question, QuestionFile } from '../src/types/question';

const repoRoot = process.cwd();

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

  for (const subject of catalog.subjects) {
    for (const source of subject.sources) {
      const questionPath = path.join(root, 'data', source.path.replace(/\.json$/, '.yaml'));
      const questionFile = readYamlFile<QuestionFile>(questionPath, root);
      validateQuestionFile(questionFile, subject.id, source, root);

      const outputPath = path.join(publicDataDir, source.path);
      writeJson(outputPath, questionFile);
      filesWritten.push(path.relative(root, outputPath));
    }
  }

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
  if (!['text', 'code', 'image'].includes(type)) {
    throw new Error(`${fieldPath}.type must be text, code, or image`);
  }

  if (passage.language !== undefined) {
    expectString(passage.language, `${fieldPath}.language`);
  }

  if (passage.body !== undefined) {
    expectString(passage.body, `${fieldPath}.body`);
  }

  if (passage.image !== undefined) {
    validateImage(passage.image, `${fieldPath}.image`, root);
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
    validateChoice(choice, `${fieldPath}.choices[${choiceIndex}]`);
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

  if (question.allowMultiple !== undefined && typeof question.allowMultiple !== 'boolean') {
    throw new Error(`${fieldPath}.allowMultiple must be boolean`);
  }
}

function validateChoice(value: unknown, fieldPath: string): asserts value is Choice {
  const choice = expectRecord(value, fieldPath);
  expectString(choice.id, `${fieldPath}.id`);
  expectString(choice.text, `${fieldPath}.text`);
}

function validateImage(value: unknown, fieldPath: string, root: string): void {
  const image = expectRecord(value, fieldPath);
  const imagePath = expectString(image.path, `${fieldPath}.path`);
  expectString(image.alt, `${fieldPath}.alt`);

  if (!fs.existsSync(path.join(root, imagePath))) {
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

  if (kind === 'workbook' && !/^b\d{2}-\d{2}$/.test(id)) {
    throw new Error(`${fieldPath} must match b{chapter}-{nn} for workbook sources`);
  }

  if (kind === 'lecture' && !/^l\d{2}-\d{2}$/.test(id)) {
    throw new Error(`${fieldPath} must match l{lecture}-{nn} for lecture sources`);
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

function expectUnique(seen: Set<string>, value: string, fieldPath: string): void {
  if (seen.has(value)) {
    throw new Error(`${fieldPath} must be unique: ${value}`);
  }

  seen.add(value);
}

function expectSourceKind(value: string, fieldPath: string): asserts value is SourceKind {
  if (!['exam', 'workbook', 'lecture'].includes(value)) {
    throw new Error(`${fieldPath} must be exam, workbook, or lecture`);
  }
}

if (process.argv[1] === new URL(import.meta.url).pathname) {
  const result = buildData();
  for (const file of result.filesWritten) {
    console.log(`wrote ${file}`);
  }
}
