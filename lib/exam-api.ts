import type { ExamSessionDetail, SubmitExamRequest } from "@/types/exam";
import { fetchWithTimeout } from "./fetch-with-timeout";

export async function fetchExamSession(sessionId: string): Promise<ExamSessionDetail> {
  const res = await fetchWithTimeout(`/api/exams/${sessionId}`);
  if (!res.ok) throw new Error("시험 정보를 불러오지 못했습니다.");
  return res.json();
}

export interface SubmitExamResult {
  // 서버가 이미 제출된 세션에 409를 주는 건 에러가 아니라 "이미 끝난 시험"이라는
  // 뜻이라, 호출부가 성공과 동일하게(제출 완료 처리) 다룰 수 있도록 구분해 알려준다.
  alreadySubmitted: boolean;
}

export async function submitExam(sessionId: string, answers: SubmitExamRequest["answers"]): Promise<SubmitExamResult> {
  const body: SubmitExamRequest = { answers };
  const res = await fetchWithTimeout(`/api/exams/${sessionId}/submit`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (res.status === 409) {
    return { alreadySubmitted: true };
  }
  if (!res.ok) {
    throw new Error("제출에 실패했습니다.");
  }
  return { alreadySubmitted: false };
}
