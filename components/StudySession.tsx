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
    return <p>불러오는 중입니다...</p>;
  }

  if (isError || !questionIds) {
    return (
      <div>
        <p>문제 목록을 불러오지 못했습니다.</p>
        <button type="button" onClick={() => refetch()}>
          다시 시도
        </button>
      </div>
    );
  }

  if (questionIds.length === 0) {
    return <p>이 과목에는 아직 문제가 없습니다.</p>;
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
      <div>
        <h2>학습을 완료했습니다!</h2>
        <p>
          {totalAnswered}문제 중 {correctCount}개 정답 ({percent}%)
        </p>
        <Link href="/questions">문제 은행으로</Link>
        <button type="button" onClick={handleRestart}>
          처음부터 다시 풀기
        </button>
      </div>
    );
  }

  const currentQuestionId = questionIds[currentIndex];

  return (
    <div>
      <ProgressBar current={currentIndex + 1} total={questionIds.length} />

      <QuestionView key={currentQuestionId} questionId={currentQuestionId} onAnswered={handleAnswered} />

      {isCurrentAnswered && (
        <button type="button" onClick={handleNext}>
          다음 문제
        </button>
      )}
    </div>
  );
}
