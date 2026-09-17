"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ProgressBar } from "@/components/ProgressBar";
import { QuestionView } from "@/components/QuestionView";
import type { QuestionListResponse } from "@/types/question";

interface StudySessionProps {
  subjectId: string;
}

// 과목당 최대 문제 수(현재 최대 160)보다 넉넉하게 잡아서 한 페이지로 전체를 받는다.
const MAX_QUESTIONS_PER_SUBJECT = 200;

async function fetchQuestionIds(subjectId: string): Promise<string[]> {
  const res = await fetch(`/api/questions?subjectId=${subjectId}&pageSize=${MAX_QUESTIONS_PER_SUBJECT}`);
  if (!res.ok) throw new Error("문제 목록을 불러오지 못했습니다.");
  const data: QuestionListResponse = await res.json();
  return data.items.map((item) => item.id);
}

export function StudySession({ subjectId }: StudySessionProps) {
  const {
    data: questionIds,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ["studyQuestionIds", subjectId],
    queryFn: () => fetchQuestionIds(subjectId),
  });

  const [currentIndex, setCurrentIndex] = useState(0);
  const [isCurrentAnswered, setIsCurrentAnswered] = useState(false);
  const [correctCount, setCorrectCount] = useState(0);
  const [totalAnswered, setTotalAnswered] = useState(0);

  if (isLoading) {
    return <p className="mx-auto max-w-2xl px-4 py-8 text-ink/60">불러오는 중입니다...</p>;
  }

  if (isError || !questionIds) {
    return (
      <div className="mx-auto max-w-2xl space-y-3 px-4 py-8">
        <p className="text-incorrect">문제 목록을 불러오지 못했습니다.</p>
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

  if (questionIds.length === 0) {
    return <p className="mx-auto max-w-2xl px-4 py-8 text-ink/60">이 과목에는 아직 문제가 없습니다.</p>;
  }

  const handleAnswered = (isCorrect: boolean) => {
    setIsCurrentAnswered(true);
    setTotalAnswered((n) => n + 1);
    if (isCorrect) setCorrectCount((n) => n + 1);
  };

  const handleNext = () => {
    setCurrentIndex((i) => i + 1);
    setIsCurrentAnswered(false);
  };

  const handleRestart = () => {
    setCurrentIndex(0);
    setIsCurrentAnswered(false);
    setCorrectCount(0);
    setTotalAnswered(0);
  };

  const isFinished = currentIndex >= questionIds.length;

  if (isFinished) {
    const percent = totalAnswered > 0 ? Math.round((correctCount / totalAnswered) * 100) : 0;
    return (
      <div className="mx-auto max-w-2xl px-4 py-8">
        <h2 className="text-lg font-semibold">학습을 완료했습니다</h2>
        <p className="mt-2 text-ink/70">
          {totalAnswered}문제 중 {correctCount}개 정답 ({percent}%)
        </p>
        <div className="mt-6 flex items-center gap-4">
          <Link href="/questions" className="font-semibold text-focus underline underline-offset-2">
            문제 은행으로
          </Link>
          <button
            type="button"
            onClick={handleRestart}
            className="rounded border border-rule px-4 py-2 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
          >
            처음부터 다시 풀기
          </button>
        </div>
      </div>
    );
  }

  const currentQuestionId = questionIds[currentIndex];

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <ProgressBar current={currentIndex + 1} total={questionIds.length} />

      <div className="mt-6">
        <QuestionView key={currentQuestionId} questionId={currentQuestionId} onAnswered={handleAnswered} />
      </div>

      {isCurrentAnswered && (
        <div className="mt-6">
          <button
            type="button"
            onClick={handleNext}
            className="w-full rounded-md bg-focus px-5 py-2 font-semibold text-paper focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-paper sm:w-auto"
          >
            다음 문제
          </button>
        </div>
      )}
    </div>
  );
}
