"use client";

import { useCallback, useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import type { QuestionDetail, SubmitRequest, SubmitResponse } from "@/types/question";

interface QuestionViewProps {
  questionId: string;
  // 학습 모드(StudySession)에서 진행률/정답 수를 집계하는 데 쓰는 선택적 콜백.
  // /questions/[id] 단독 사용처는 넘기지 않아도 된다.
  onAnswered?: (isCorrect: boolean) => void;
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

export function QuestionView({ questionId, onAnswered }: QuestionViewProps) {
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
    // onSuccess는 렌더마다 useMutation 내부에서 최신 옵션으로 재동기화되므로
    // (observer.setOptions), onAnswered를 useCallback 의존성에 신경 쓸 필요 없이
    // 항상 최신 콜백을 참조한다.
    onSuccess: (data) => {
      onAnswered?.(data.isCorrect);
    },
  });

  const result = submitMutation.data;

  const handleSubmit = useCallback(() => {
    if (!selectedChoiceId) return;
    submitMutation.mutate(selectedChoiceId);
  }, [selectedChoiceId, submitMutation]);

  // 숫자키 1~4로 보기 선택, Enter로 제출 (제출 전에만 동작 — 결과가 확정되면
  // 비활성화). 버튼의 네이티브 Enter 동작에 기대지 않고 명시적으로 처리한다:
  // 보기 버튼에 포커스가 있으면 Enter가 그 버튼만 재클릭하고, 숫자키로 선택한
  // 직후에는 포커스가 어디에도 없어서 애초에 네이티브 제출이 일어나지 않는다.
  useEffect(() => {
    if (!question || result) return;

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Enter") {
        handleSubmit();
        return;
      }
      const choice = question?.choices.find((c) => c.label === e.key);
      if (choice) {
        setSelectedChoiceId(choice.id);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [question, result, handleSubmit]);

  if (isLoading) {
    return <p className="text-ink/60">불러오는 중입니다...</p>;
  }

  if (isQuestionError || !question) {
    return (
      <div className="space-y-3">
        <p className="text-incorrect">문제를 불러오지 못했습니다.</p>
        <button
          type="button"
          onClick={() => refetchQuestion()}
          className="font-semibold text-focus underline underline-offset-2"
        >
          다시 시도
        </button>
      </div>
    );
  }

  return (
    <div>
      <p className="font-mono text-sm text-ink/60">
        {question.subjectName} · {question.year}
        {question.round ? `-${question.round}회` : ""}
      </p>
      <p className="mt-3 whitespace-pre-wrap text-lg leading-relaxed">{question.content}</p>

      <ul className="mt-6 border-t border-rule">
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
                className="flex w-full items-center gap-3 border-b border-rule px-2 py-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-paper disabled:cursor-default"
              >
                {/* 선택 여부는 채워진/빈 원(OMR 마킹)으로 표시 — 색만이 아니라
                    정답/오답도 ✓/✗ 기호를 같이 넣어서 색각 이상 사용자도 구분 가능 */}
                <span
                  aria-hidden="true"
                  className={
                    "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 text-xs font-semibold " +
                    (isCorrectChoice
                      ? "border-correct bg-correct text-paper"
                      : isWrongPick
                        ? "border-incorrect bg-incorrect text-paper"
                        : isSelected
                          ? "border-focus bg-focus"
                          : "border-rule")
                  }
                >
                  {isCorrectChoice ? "✓" : isWrongPick ? "✗" : ""}
                </span>
                <span className="font-mono text-sm text-ink/60">{choice.label}</span>
                <span className="flex-1">{choice.content}</span>
              </button>
            </li>
          );
        })}
      </ul>

      {!result && (
        <div className="mt-6 flex items-center gap-3">
          <button
            type="button"
            disabled={!selectedChoiceId || submitMutation.isPending}
            onClick={handleSubmit}
            className="rounded-md bg-focus px-5 py-2 font-semibold text-paper focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-paper disabled:opacity-40"
          >
            {submitMutation.isPending ? "제출 중..." : "제출"}
          </button>
          <span className="text-sm text-ink/50">Enter로도 제출할 수 있어요</span>
        </div>
      )}

      {submitMutation.isError && (
        <div className="mt-4 space-y-2 border border-incorrect/40 px-4 py-3 text-sm">
          <p className="text-incorrect">제출에 실패했습니다. 다시 시도해주세요.</p>
          <button
            type="button"
            disabled={submitMutation.isPending}
            onClick={handleSubmit}
            className="font-semibold text-focus underline underline-offset-2"
          >
            다시 시도
          </button>
        </div>
      )}

      {result && (
        <div className="mt-6 border-t border-rule pt-6">
          <p className={"text-lg font-semibold " + (result.isCorrect ? "text-correct" : "text-incorrect")}>
            {result.isCorrect ? "정답입니다" : "오답입니다"}
          </p>
          <p className="mt-2 text-ink/70">{result.explanation ? result.explanation : "해설 준비 중입니다."}</p>
        </div>
      )}
    </div>
  );
}
