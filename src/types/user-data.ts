export interface UserDataExport {
  app: 'passture';
  version: number;
  exportedAt: string;
  bookmarks: string[];
  wrongAnswers: Record<string, WrongAnswerRecord>;
}

export interface WrongAnswerRecord {
  wrongCount: number;
  lastWrongAt: string;
}
