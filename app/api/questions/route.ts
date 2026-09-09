import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import type { QuestionListResponse } from "@/types/question";

const DEFAULT_PAGE_SIZE = 20;

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const subjectId = searchParams.get("subjectId") ?? undefined;
  const yearParam = searchParams.get("year");
  const year = yearParam ? Number(yearParam) : undefined;
  const keyword = searchParams.get("keyword") ?? undefined;
  const page = Math.max(1, Number(searchParams.get("page") ?? "1"));
  const pageSize = Math.max(1, Number(searchParams.get("pageSize") ?? String(DEFAULT_PAGE_SIZE)));

  const where = {
    examType: "WRITTEN" as const,
    ...(subjectId ? { subjectId } : {}),
    ...(year ? { year } : {}),
    ...(keyword ? { content: { contains: keyword, mode: "insensitive" as const } } : {}),
  };

  const [items, total] = await Promise.all([
    prisma.question.findMany({
      where,
      include: { subject: { select: { name: true } } },
      orderBy: [{ year: "desc" }, { round: "desc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.question.count({ where }),
  ]);

  const response: QuestionListResponse = {
    items: items.map((q) => ({
      id: q.id,
      content: q.content,
      subjectName: q.subject.name,
      year: q.year,
      round: q.round,
    })),
    total,
    page,
    pageSize,
  };

  return NextResponse.json(response);
}
