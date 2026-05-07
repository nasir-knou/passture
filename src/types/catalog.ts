export type SourceKind = 'exam' | 'textbook' | 'workbook' | 'lecture' | 'intensive';

export interface Catalog {
  version: number;
  subjects: CatalogSubject[];
}

export interface CatalogSubject {
  id: string;
  title: string;
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
