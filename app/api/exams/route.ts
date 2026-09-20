import { NextResponse } from "next/server";
import { FULL_EXAM_DURATION_SECONDS, QUESTIONS_PER_SUBJECT, SUBJECT_EXAM_DURATION_SECONDS } from "@/lib/exam-constants";
import { prisma } from "@/lib/prisma";
import { pickRandom } from "@/lib/random";
import type { CreateExamRequest, CreateExamResponse, ExamMode } from "@/types/exam";

const VALID_MODES: ExamMode[] = ["FULL_100", "SUBJECT_20"];

export async function POST(request: Request) {
  const body = (await request.json()) as CreateExamRequest;

  if (!VALID_MODES.includes(body.mode)) {
    return NextResponse.json({ error: "mode는 FULL_100 또는 SUBJECT_20이어야 합니다." }, { status: 400 });
  }
  if (body.mode === "SUBJECT_20" && !body.subjectId) {
    return NextResponse.json({ error: "SUBJECT_20 모드는 subjectId가 필요합니다." }, { status: 400 });
  }

  let questionIds: string[];

  if (body.mode === "FULL_100") {
    // 전체 문제 풀에서 100개를 그냥 무작위로 뽑지 않고, 과목마다 20개씩
    // 뽑아서 합친다 — spec.md의 5과목×20문항 구성을 보장하기 위함.
    const subjects = await prisma.subject.findMany({
      where: { examType: "WRITTEN" },
      orderBy: { order: "asc" },
      select: { id: true },
    });

    questionIds = [];
    for (const subject of subjects) {
      const candidates = await prisma.question.findMany({
        where: { examType: "WRITTEN", subjectId: subject.id },
        select: { id: true },
      });
      if (candidates.length < QUESTIONS_PER_SUBJECT) {
        throw new Error(`과목(${subject.id})에 문제가 부족합니다 (보유 ${candidates.length}개)`);
      }
      questionIds.push(...pickRandom(candidates.map((c) => c.id), QUESTIONS_PER_SUBJECT));
    }
  } else {
    const candidates = await prisma.question.findMany({
      where: { examType: "WRITTEN", subjectId: body.subjectId },
      select: { id: true },
    });
    if (candidates.length < QUESTIONS_PER_SUBJECT) {
      throw new Error(`과목(${body.subjectId})에 문제가 부족합니다 (보유 ${candidates.length}개)`);
    }
    questionIds = pickRandom(
      candidates.map((c) => c.id),
      QUESTIONS_PER_SUBJECT,
    );
  }

  const durationSeconds = body.mode === "FULL_100" ? FULL_EXAM_DURATION_SECONDS : SUBJECT_EXAM_DURATION_SECONDS;

  const session = await prisma.examSession.create({
    data: {
      examType: "WRITTEN",
      mode: body.mode,
      // FULL_100은 항상 null — 특정 과목에 속하지 않는 시험이라서.
      subjectId: body.mode === "SUBJECT_20" ? (body.subjectId ?? null) : null,
      questionIds,
    },
  });

  const response: CreateExamResponse = {
    sessionId: session.id,
    mode: body.mode,
    subjectId: session.subjectId,
    startedAt: session.startedAt.toISOString(),
    durationSeconds,
  };

  return NextResponse.json(response);
}
