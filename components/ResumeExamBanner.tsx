"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { findResumableExamSession } from "@/lib/exam-api";
import { formatRemaining } from "@/lib/exam-timer";

export function ResumeExamBanner() {
  const { data } = useQuery({
    queryKey: ["examResumeCandidate"],
    queryFn: () => findResumableExamSession(),
  });

  if (!data) return null;

  const modeLabel = data.mode === "FULL_100" ? "전체 100문항" : `과목별 20문항 · ${data.subjectName ?? ""}`;

  return (
    <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border border-focus/40 bg-focus/5 px-4 py-3 text-sm">
      <p>
        진행 중인 시험이 있습니다 · {modeLabel} · 남은 {formatRemaining(data.remainingMs)}
      </p>
      <Link href={`/exam/${data.sessionId}`} className="font-semibold text-focus underline underline-offset-2">
        이어서 풀기
      </Link>
    </div>
  );
}
