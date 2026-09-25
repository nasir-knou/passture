export interface Syllabus {
  subjectId: string;
  title: string;
  textbook?: SyllabusTextbook;
  parts?: SyllabusPart[];
  chapters: SyllabusChapter[];
  lectures: SyllabusLecture[];
}

export interface SyllabusTextbook {
  authors: string[];
  publisher: string;
  publishedAt: string;
}

export interface SyllabusPart {
  no: number;
  title: string;
  chapters: number[];
}

export interface SyllabusChapter {
  no: number;
  title: string;
  sections?: SyllabusSection[];
}

export interface SyllabusSection {
  no: string;
  title: string;
}

export interface SyllabusLecture {
  no: number;
  title: string;
  chapters: number[];
  sections?: string[];
  note?: string;
}
