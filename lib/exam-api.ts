import type { ExamMode, ExamSessionDetail, SubmitExamRequest } from "@/types/exam";
import { computeClockOffset, computeEndsAt, computeRemainingMs } from "./exam-timer";
import { listExamDraftSessions } from "./exam-storage";
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

export interface ResumableExam {
  sessionId: string;
  mode: ExamMode;
  // FULL_100이면 특정 과목에 속하지 않으므로 null.
  subjectName: string | null;
  // 조회 시점 스냅샷이다 — 실시간으로 줄어들지 않는다(배너는 정보 제공용이고,
  // 실제 카운트다운은 /exam/[sessionId]에 들어가야 시작된다).
  remainingMs: number;
}

// localStorage에 남아있는 시험 임시 답안 중, 아직 제출되지 않고 시간도 안 끝난
// 가장 최근(savedAt 기준) 세션 하나를 찾는다. 후보가 여러 개여도 하나만 반환한다
// — 동시에 여러 미제출 시험이 쌓이는 경우는 드물고, pruneStaleExamDrafts가 24시간
// 넘은 건 이미 정리하므로 지금은 범위를 좁게 간다.
export async function findResumableExamSession(now: () => number = Date.now): Promise<ResumableExam | null> {
  const candidates = listExamDraftSessions().sort((a, b) => b.savedAt - a.savedAt);
  if (candidates.length === 0) return null;

  // 후보 하나가 404/네트워크 에러로 실패해도(예: 세션이 DB에서 지워짐) 나머지
  // 후보 조회에 영향이 없게 allSettled로 서로 격리한다.
  const results = await Promise.allSettled(
    candidates.map(async (candidate) => ({ candidate, data: await fetchExamSession(candidate.sessionId) })),
  );

  // candidates와 같은 순서(= savedAt 내림차순)로 결과가 나오므로, 조건에 맞는
  // 첫 번째가 곧 "제출/만료되지 않은 것 중 가장 최근에 저장된 것"이다.
  for (const result of results) {
    if (result.status !== "fulfilled") continue;

    const { data } = result.value;
    if (data.finishedAt !== null) continue;

    const offsetMs = computeClockOffset(new Date(data.serverNow).getTime(), now());
    const endsAt = computeEndsAt(data.startedAt, data.durationSeconds);
    const remainingMs = computeRemainingMs(endsAt, now(), offsetMs);
    if (remainingMs <= 0) continue;

    return {
      sessionId: data.sessionId,
      mode: data.mode,
      subjectName: data.mode === "SUBJECT_20" ? (data.questions[0]?.subjectName ?? null) : null,
      remainingMs,
    };
  }

  return null;
}
