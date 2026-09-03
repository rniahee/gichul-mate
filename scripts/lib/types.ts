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
  // 완료된 페이지 청크("첫페이지-끝페이지") 목록. 재실행 시 이 목록에 있는
  // 청크는 API를 다시 호출하지 않고 건너뛴다 (쿼터 소진으로 중단된 뒤
  // 이어서 처리할 때 사용).
  completedChunks: string[];
  questions: ExtractedQuestion[];
}
