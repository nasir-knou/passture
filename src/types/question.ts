import type { SourceKind } from './catalog';

export type QuestionType = 'multiple-choice' | 'multi-answer' | 'ox';
export type PassageType = 'text' | 'code' | 'image';

export interface QuestionFile {
  subjectId: string;
  sourceId: string;
  title: string;
  kind: SourceKind;
  year?: number;
  passages?: Passage[];
  questions: Question[];
}

export interface Passage {
  id: string;
  type: PassageType;
  language?: string;
  body?: string;
  image?: QuestionImage;
}

export interface Question {
  id: string;
  type: QuestionType;
  passageRefs?: string[];
  prompt: string;
  images?: QuestionImage[];
  choices: Choice[];
  answers: string[];
  answerKey?: string;
  allowMultiple?: boolean;
  explanation: string;
  tags?: string[];
}

export interface Choice {
  id: string;
  text: string;
  image?: QuestionImage;
}

export interface QuestionImage {
  path: string;
  alt: string;
}
