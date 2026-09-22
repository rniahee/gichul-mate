import { NextResponse } from "next/server";
import { FULL_EXAM_DURATION_SECONDS, SUBJECT_EXAM_DURATION_SECONDS } from "@/lib/exam-constants";
import { prisma } from "@/lib/prisma";
import type { ExamMode, ExamSessionDetail } from "@/types/exam";
import type { QuestionDetail } from "@/types/question";

export async function GET(_request: Request, { params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await params;

  const session = await prisma.examSession.findUnique({ where: { id: sessionId } });
  if (!session) {
    return NextResponse.json({ error: "시험 세션을 찾을 수 없습니다." }, { status: 404 });
  }

  const questions = await prisma.question.findMany({
    where: { id: { in: session.questionIds } },
    include: {
      subject: { select: { name: true } },
      // isCorrect는 의도적으로 제외 — 진행 중인 시험이라 정답이 노출되면 안 됨.
      choices: { select: { id: true, label: true, content: true }, orderBy: { label: "asc" } },
    },
  });

  // findMany({ where: { id: { in } } })는 입력 배열 순서를 보장하지 않으므로,
  // questionIds에 저장된 순서대로 다시 정렬한다 (네비게이터 번호 안정성).
  const byId = new Map(questions.map((q) => [q.id, q]));
  const orderedQuestions: QuestionDetail[] = session.questionIds.map((id) => {
    const q = byId.get(id);
    if (!q) throw new Error(`세션에 배정된 문제를 찾을 수 없습니다: ${id}`);
    return {
      id: q.id,
      content: q.content,
      subjectName: q.subject.name,
      year: q.year,
      round: q.round,
      choices: q.choices,
    };
  });

  const durationSeconds = session.mode === "FULL_100" ? FULL_EXAM_DURATION_SECONDS : SUBJECT_EXAM_DURATION_SECONDS;

  const response: ExamSessionDetail = {
    sessionId: session.id,
    mode: session.mode as ExamMode,
    subjectId: session.subjectId,
    startedAt: session.startedAt.toISOString(),
    durationSeconds,
    finishedAt: session.finishedAt ? session.finishedAt.toISOString() : null,
    serverNow: new Date().toISOString(),
    questions: orderedQuestions,
  };

  return NextResponse.json(response);
}
