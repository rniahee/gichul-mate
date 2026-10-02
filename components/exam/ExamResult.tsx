"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { ExamNotFinishedError, fetchExamResult } from "@/lib/exam-api";
import { ExamResultChart } from "./ExamResultChart";
import { ExamWrongAnswerList } from "./ExamWrongAnswerList";

interface ExamResultProps {
  sessionId: string;
}

export function ExamResult({ sessionId }: ExamResultProps) {
  const router = useRouter();

  const { data, error, isLoading, refetch } = useQuery({
    queryKey: ["examResult", sessionId],
    queryFn: () => fetchExamResult(sessionId),
    // 끝난 시험의 결과는 더 이상 바뀌지 않는다.
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    // ExamNotFinishedError는 실패가 아니라 "아직 이 화면을 볼 시점이 아님"이라는
    // 신호라 재시도할 필요가 없다 — 재시도해도 같은 이유로 또 실패한다.
    retry: (failureCount, err) => !(err instanceof ExamNotFinishedError) && failureCount < 3,
  });

  // 아직 끝나지 않은 세션으로 직접 들어온 경우(북마크, 뒤로가기 등)는 응시
  // 화면으로 보낸다. ExamSession.tsx의 반대 방향 리다이렉트와 대칭된다.
  useEffect(() => {
    if (error instanceof ExamNotFinishedError) {
      router.replace(`/exam/${sessionId}`);
    }
  }, [error, sessionId, router]);

  if (isLoading) {
    return <p className="mx-auto max-w-2xl px-4 py-8 text-ink/60">불러오는 중입니다...</p>;
  }

  if (error instanceof ExamNotFinishedError) {
    return <p className="mx-auto max-w-2xl px-4 py-8 text-ink/60">진행 중인 시험으로 이동합니다...</p>;
  }

  if (error || !data) {
    return (
      <div className="mx-auto max-w-2xl space-y-3 px-4 py-8">
        <p className="text-incorrect">결과를 불러오지 못했습니다.</p>
        <button
          type="button"
          onClick={() => refetch()}
          className="font-semibold text-focus underline underline-offset-2"
        >
          다시 시도
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="text-xl font-semibold">결과 리포트</h1>
      <p className={"mt-2 text-lg font-semibold " + (data.isPassed ? "text-correct" : "text-incorrect")}>
        {data.isPassed ? "합격 ✓" : "불합격 ✗"} · 총점 {data.totalScore}점
      </p>

      <section className="mt-8">
        <h2 className="text-base font-semibold">과목별 점수</h2>
        <div className="mt-4">
          <ExamResultChart subjectScores={data.subjectScores} />
        </div>
      </section>

      <section className="mt-10">
        <h2 className="text-base font-semibold">오답 목록 ({data.wrongAnswers.length}문제)</h2>
        <div className="mt-4">
          <ExamWrongAnswerList wrongAnswers={data.wrongAnswers} />
        </div>
      </section>
    </div>
  );
}
