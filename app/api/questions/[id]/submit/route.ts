import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import type { SubmitRequest, SubmitResponse } from "@/types/question";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = (await request.json()) as SubmitRequest;

  const question = await prisma.question.findUnique({
    where: { id },
    include: { choices: true },
  });

  if (!question) {
    return NextResponse.json({ error: "문제를 찾을 수 없습니다." }, { status: 404 });
  }

  const selectedChoice = question.choices.find((c) => c.id === body.selectedChoiceId);
  if (!selectedChoice) {
    return NextResponse.json({ error: "존재하지 않는 보기입니다." }, { status: 400 });
  }

  const correctChoice = question.choices.find((c) => c.isCorrect)!;
  const isCorrect = selectedChoice.isCorrect;

  // 로그인 기능이 없어 userId는 null (spec.md 5.3절 로드맵). 풀 때마다 새 기록을
  // 남긴다 — UserAnswer는 "현재 상태"가 아니라 이벤트 로그로 설계됨(spec.md 5.2절).
  await prisma.userAnswer.create({
    data: {
      userId: null,
      questionId: question.id,
      selectedChoiceId: selectedChoice.id,
      isCorrect,
    },
  });

  const response: SubmitResponse = {
    isCorrect,
    correctChoiceId: correctChoice.id,
    explanation: question.explanation,
  };

  return NextResponse.json(response);
}
