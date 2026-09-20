import type { QuestionDetail } from "./question";

export type ExamMode = "FULL_100" | "SUBJECT_20";

export interface CreateExamRequest {
  mode: ExamMode;
  subjectId?: string;
}

export interface CreateExamResponse {
  sessionId: string;
  mode: ExamMode;
  subjectId: string | null;
  startedAt: string;
  durationSeconds: number;
}

export interface ExamSessionDetail {
  sessionId: string;
  mode: ExamMode;
  subjectId: string | null;
  startedAt: string;
  durationSeconds: number;
  finishedAt: string | null;
  // questionIds 순서 그대로 정렬됨. 정답 정보는 포함하지 않는다.
  questions: QuestionDetail[];
}

export interface SubmitExamRequest {
  // questionId -> 선택한 choiceId. 안 푼 문제는 키 자체가 없어도 된다.
  answers: Record<string, string>;
}

export interface SubmitExamResponse {
  sessionId: string;
}
