export type SourceKind = 'exam' | 'textbook' | 'workbook' | 'lecture' | 'intensive';
export type Semester = 1 | 2;

export interface Catalog {
  version: number;
  subjects: CatalogSubject[];
}

export interface CatalogSubject {
  id: string;
  title: string;
  semester: Semester;
  sources: CatalogSource[];
}

export interface CatalogSource {
  id: string;
  title: string;
  path: string;
  kind: SourceKind;
  year?: number;
  questionCount?: number;
}
