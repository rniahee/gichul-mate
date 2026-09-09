import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import type { SubjectDto } from "@/types/question";

export async function GET() {
  const subjects = await prisma.subject.findMany({
    where: { examType: "WRITTEN" },
    orderBy: { order: "asc" },
    select: { id: true, name: true, order: true },
  });

  return NextResponse.json(subjects satisfies SubjectDto[]);
}
