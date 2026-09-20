import { NextResponse } from "next/server";
import { calculateSubjectScores, calculateTotalScore, isOverallPassed, type QuestionAnswerRecord } from "@/lib/grading";
import { prisma } from "@/lib/prisma";
import type { SubmitExamRequest, SubmitExamResponse } from "@/types/exam";

class AlreadySubmittedError extends Error {}

export async function POST(request: Request, { params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await params;
  const body = (await request.json()) as SubmitExamRequest;

  const session = await prisma.examSession.findUnique({ where: { id: sessionId } });
  if (!session) {
    return NextResponse.json({ error: "시험 세션을 찾을 수 없습니다." }, { status: 404 });
  }
  if (session.finishedAt) {
    return NextResponse.json({ error: "이미 제출된 시험입니다." }, { status: 409 });
  }

  const questions = await prisma.question.findMany({
    where: { id: { in: session.questionIds } },
    include: { choices: true },
  });
  const questionById = new Map(questions.map((q) => [q.id, q]));

  const records: QuestionAnswerRecord[] = [];
  const userAnswerRows: {
    questionId: string;
    examSessionId: string;
    selectedChoiceId: string | null;
    isCorrect: boolean;
    userId: null;
  }[] = [];

  // 클라이언트가 보낸 answers가 아니라 session.questionIds 전체를 기준으로
  // 순회한다 — 안 푼 문제(answers에 키가 없음)는 오답으로 처리된다.
  for (const questionId of session.questionIds) {
    const question = questionById.get(questionId);
    if (!question) continue; // 방어적: 이론상 발생하지 않음

    const submittedChoiceId = body.answers[questionId];
    // 제출된 choiceId가 실제 그 문제의 보기가 아니면 안 푼 것과 동일하게 처리한다.
    const selectedChoice = question.choices.find((c) => c.id === submittedChoiceId);
    const isCorrect = selectedChoice?.isCorrect ?? false;

    records.push({ questionId, subjectId: question.subjectId, isCorrect });
    userAnswerRows.push({
      questionId,
      examSessionId: sessionId,
      selectedChoiceId: selectedChoice ? selectedChoice.id : null,
      isCorrect,
      userId: null,
    });
  }

  const subjectIds = [...new Set(questions.map((q) => q.subjectId))];
  const subjectScores = calculateSubjectScores(records, subjectIds);
  const totalScore = calculateTotalScore(subjectScores);
  const passed = isOverallPassed(subjectScores);

  try {
    await prisma.$transaction(async (tx) => {
      // finishedAt: null 조건을 where에 함께 걸어서 "아직 안 끝난 세션"만
      // 원자적으로 선점한다. 거의 동시에 두 번 제출돼도 하나만 count: 1이 되고
      // 나머지는 count: 0으로 실패해서 중복 채점을 막는다.
      const claim = await tx.examSession.updateMany({
        where: { id: sessionId, finishedAt: null },
        data: { finishedAt: new Date(), totalScore, isPassed: passed },
      });

      if (claim.count === 0) {
        throw new AlreadySubmittedError();
      }

      await tx.userAnswer.createMany({ data: userAnswerRows });
      await tx.subjectScore.createMany({
        data: subjectScores.map((s) => ({
          examSessionId: sessionId,
          subjectId: s.subjectId,
          score: s.score,
          isPassed: s.isPassed,
        })),
      });
    });
  } catch (error) {
    if (error instanceof AlreadySubmittedError) {
      return NextResponse.json({ error: "이미 제출된 시험입니다." }, { status: 409 });
    }
    throw error;
  }

  const response: SubmitExamResponse = { sessionId };
  return NextResponse.json(response);
}
