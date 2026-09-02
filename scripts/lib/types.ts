export interface ExtractedChoice {
  label: string;
  content: string;
}

export interface ExtractedQuestion {
  questionNumber: number | null;
  subjectName: string | null;
  content: string;
  choices: ExtractedChoice[];
  correctLabel: string | null;
}

export interface ExtractionResult {
  sourceFile: string;
  extractedAt: string;
  questions: ExtractedQuestion[];
}
