import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import type { QuestionDetail } from "@/types/question";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const question = await prisma.question.findUnique({
    where: { id },
    include: {
      subject: { select: { name: true } },
      // isCorrect는 의도적으로 select에서 제외한다 — 제출 전에 정답이
      // 노출되면 안 되기 때문(spec.md 7.4절, 1단계 계획 (B)).
      choices: {
        select: { id: true, label: true, content: true },
        orderBy: { label: "asc" },
      },
    },
  });

  if (!question) {
    return NextResponse.json({ error: "문제를 찾을 수 없습니다." }, { status: 404 });
  }

  const detail: QuestionDetail = {
    id: question.id,
    content: question.content,
    subjectName: question.subject.name,
    year: question.year,
    round: question.round,
    choices: question.choices,
  };

  return NextResponse.json(detail);
}
