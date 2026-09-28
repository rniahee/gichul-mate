"use client";

import { useCallback, useEffect } from "react";
import type { QuestionDetail } from "@/types/question";
import { ExamOmrMarker } from "./ExamOmrMarker";

interface ExamQuestionPanelProps {
  question: QuestionDetail;
  questionNumber: number;
  selectedChoiceId: string | null;
  // 시간 종료 후(로드 시 만료 또는 응시 중 만료) 답안 변경을 막을 때 true.
  locked: boolean;
  // 선택 = draftAnswers 갱신일 뿐, 서버로 아무것도 보내지 않는다(학습 모드와의 핵심 차이).
  onSelect: (choiceId: string) => void;
  // Enter는 제출이 아니라 다음 문제로 이동하는 안전한 동작이다. 마지막 문제에서는
  // 호출부(ExamSessionBody)가 범위를 넘지 않게 처리한다.
  onNext: () => void;
}

export function ExamQuestionPanel({
  question,
  questionNumber,
  selectedChoiceId,
  locked,
  onSelect,
  onNext,
}: ExamQuestionPanelProps) {
  const handleSelect = useCallback(
    (choiceId: string) => {
      if (locked) return;
      onSelect(choiceId);
    },
    [locked, onSelect],
  );

  // 숫자키 1~4로 보기 선택, Enter로 다음 문제 이동.
  useEffect(() => {
    if (locked) return;

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Enter") {
        onNext();
        return;
      }
      const choice = question.choices.find((c) => c.label === e.key);
      if (choice) {
        handleSelect(choice.id);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [question, locked, handleSelect, onNext]);

  return (
    <div>
      <p className="font-mono text-sm text-ink/60">
        {questionNumber}번 · {question.subjectName}
        {question.year ? ` · ${question.year}` : ""}
        {question.round ? `-${question.round}회` : ""}
      </p>
      <p className="mt-3 whitespace-pre-wrap text-lg leading-relaxed">{question.content}</p>

      {/* 4지선다 중 하나만 고르는 배타적 선택이라 radiogroup/radio가 맞는 시맨틱.
          aria-checked로 선택 상태를 표현한다(토글 버튼인 aria-pressed는 여기 안 맞음). */}
      <div role="radiogroup" aria-label={`${questionNumber}번 문제 보기`} className="mt-6 border-t border-rule">
        {question.choices.map((choice) => {
          const isSelected = choice.id === selectedChoiceId;
          return (
            <button
              key={choice.id}
              type="button"
              role="radio"
              aria-checked={isSelected}
              disabled={locked}
              onClick={() => handleSelect(choice.id)}
              className="flex w-full items-center gap-3 border-b border-rule px-2 py-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-paper disabled:cursor-default disabled:opacity-60"
            >
              <ExamOmrMarker state={isSelected ? "selected" : "empty"} />
              <span className="font-mono text-sm text-ink/60">{choice.label}</span>
              <span className="min-w-0 flex-1 break-words">{choice.content}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
