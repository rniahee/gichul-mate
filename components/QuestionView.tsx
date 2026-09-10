"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import type { QuestionDetail, SubmitRequest, SubmitResponse } from "@/types/question";

interface QuestionViewProps {
  questionId: string;
}

async function fetchQuestion(questionId: string): Promise<QuestionDetail> {
  const res = await fetch(`/api/questions/${questionId}`);
  if (!res.ok) throw new Error("문제를 불러오지 못했습니다.");
  return res.json();
}

async function submitAnswer(questionId: string, body: SubmitRequest): Promise<SubmitResponse> {
  const res = await fetch(`/api/questions/${questionId}/submit`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error("제출에 실패했습니다.");
  return res.json();
}

export function QuestionView({ questionId }: QuestionViewProps) {
  const [selectedChoiceId, setSelectedChoiceId] = useState<string | null>(null);

  const {
    data: question,
    isLoading,
    isError: isQuestionError,
    refetch: refetchQuestion,
  } = useQuery({
    queryKey: ["question", questionId],
    queryFn: () => fetchQuestion(questionId),
  });

  const submitMutation = useMutation({
    mutationFn: (choiceId: string) => submitAnswer(questionId, { selectedChoiceId: choiceId }),
  });

  const result = submitMutation.data;

  // 숫자키 1~4로 보기 선택 (제출 전에만 동작 — 결과가 확정되면 비활성화)
  useEffect(() => {
    if (!question || result) return;

    function handleKeyDown(e: KeyboardEvent) {
      const choice = question?.choices.find((c) => c.label === e.key);
      if (choice) {
        setSelectedChoiceId(choice.id);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [question, result]);

  if (isLoading) {
    return <p>불러오는 중입니다...</p>;
  }

  if (isQuestionError || !question) {
    return (
      <div>
        <p>문제를 불러오지 못했습니다.</p>
        <button type="button" onClick={() => refetchQuestion()}>
          다시 시도
        </button>
      </div>
    );
  }

  const handleSubmit = () => {
    if (!selectedChoiceId) return;
    submitMutation.mutate(selectedChoiceId);
  };

  return (
    <div>
      <p className="text-sm text-gray-500">
        {question.subjectName} {question.year}
        {question.round ? `-${question.round}회` : ""}
      </p>
      <p className="whitespace-pre-wrap">{question.content}</p>

      <ul>
        {question.choices.map((choice) => {
          const isSelected = choice.id === selectedChoiceId;
          const isCorrectChoice = Boolean(result) && choice.id === result?.correctChoiceId;
          const isWrongPick = Boolean(result) && isSelected && !isCorrectChoice;

          return (
            <li key={choice.id}>
              <button
                type="button"
                disabled={Boolean(result)}
                aria-pressed={isSelected}
                onClick={() => setSelectedChoiceId(choice.id)}
                className={
                  isCorrectChoice ? "bg-green-100" : isWrongPick ? "bg-red-100" : isSelected ? "bg-blue-100" : ""
                }
              >
                {choice.label}. {choice.content}
              </button>
            </li>
          );
        })}
      </ul>

      {!result && (
        <button type="button" disabled={!selectedChoiceId || submitMutation.isPending} onClick={handleSubmit}>
          {submitMutation.isPending ? "제출 중..." : "제출"}
        </button>
      )}

      {submitMutation.isError && (
        <div>
          <p>제출에 실패했습니다. 다시 시도해주세요.</p>
          <button type="button" disabled={submitMutation.isPending} onClick={handleSubmit}>
            다시 시도
          </button>
        </div>
      )}

      {result && (
        <div>
          <p>{result.isCorrect ? "정답입니다!" : "오답입니다."}</p>
          <p>{result.explanation ? result.explanation : "해설 준비 중입니다."}</p>
        </div>
      )}
    </div>
  );
}
