import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// 필터와 무관하게 DB에 존재하는 전체 연도 목록을 내려준다. /api/questions에
// 얹으면 필터링된 결과 기준으로 목록이 줄어드는 부작용이 생기므로 분리했다.
export async function GET() {
  const rows = await prisma.question.findMany({
    where: { examType: "WRITTEN", year: { not: null } },
    distinct: ["year"],
    select: { year: true },
    orderBy: { year: "desc" },
  });

  const years = rows.map((r) => r.year as number);

  return NextResponse.json(years);
}
