export interface SubjectDto {
  id: string;
  name: string;
  order: number;
}

// 문제 조회 응답에 쓰는 보기 — 정답 여부(isCorrect)는 포함하지 않는다.
// 제출 전에 정답이 노출되면 안 되기 때문(spec.md 7.4절).
export interface ChoiceDto {
  id: string;
  label: string;
  content: string;
}

export interface QuestionListItem {
  id: string;
  content: string;
  subjectName: string;
  year: number | null;
  round: number | null;
}

export interface QuestionListResponse {
  items: QuestionListItem[];
  total: number;
  page: number;
  pageSize: number;
}

export interface QuestionDetail {
  id: string;
  content: string;
  subjectName: string;
  year: number | null;
  round: number | null;
  choices: ChoiceDto[];
}

export interface SubmitRequest {
  selectedChoiceId: string;
}

export interface SubmitResponse {
  isCorrect: boolean;
  correctChoiceId: string;
  // 아직 해설이 없는 문제가 대부분이라(spec.md 5단계에서 채워질 예정) null일 수 있다.
  explanation: string | null;
}
