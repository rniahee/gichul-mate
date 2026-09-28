"use client";

import { useEffect } from "react";
import { useExamStore } from "@/components/ExamStoreProvider";
import { formatRemaining } from "@/lib/exam-timer";
import { useExamTimer } from "@/lib/hooks/use-exam-timer";
import type { ExamSessionDetail } from "@/types/exam";
import { ExamNavigator } from "./ExamNavigator";
import { ExamQuestionPanel } from "./ExamQuestionPanel";

interface ExamSessionBodyProps {
  data: ExamSessionDetail;
}

// 제출 버튼과 실시간 만료 자동 제출은 다음 커밋(E-4)에서 이어서 추가한다.
export function ExamSessionBody({ data }: ExamSessionBodyProps) {
  const { questions, startedAt, durationSeconds, serverNow, mode } = data;

  const { remainingMs, expiredOnLoad } = useExamTimer({ startedAt, durationSeconds, serverNow });

  const rawIndex = useExamStore((s) => s.currentIndex);
  const draftAnswers = useExamStore((s) => s.draftAnswers);
  const setCurrentIndex = useExamStore((s) => s.setCurrentIndex);
  const selectAnswer = useExamStore((s) => s.selectAnswer);

  const displayIndex = Math.min(Math.max(rawIndex, 0), questions.length - 1);

  // localStorage에 남아있던 currentIndex가 지금 문제 수 범위를 벗어나면(예: 손상된
  // 값, 혹은 예전 데이터) 화면엔 항상 displayIndex를 써서 잘못된 값이 보이는 프레임
  // 자체가 없게 하고, 저장값도 다음 변경 시점에 맞게 보정해둔다.
  useEffect(() => {
    if (rawIndex !== displayIndex) {
      setCurrentIndex(displayIndex);
    }
  }, [rawIndex, displayIndex, setCurrentIndex]);

  const subjectName = questions[0]?.subjectName ?? "";
  const modeLabel = mode === "FULL_100" ? "전체 100문항" : `과목별 20문항 · ${subjectName}`;

  // 실시간 만료(onExpire) 연동은 E-4에서 추가 — 지금은 로드 시점 만료만 잠금 사유.
  const locked = expiredOnLoad;
  const currentQuestion = questions[displayIndex];

  const handleNext = () => {
    if (displayIndex < questions.length - 1) {
      setCurrentIndex(displayIndex + 1);
    }
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-rule pb-4">
        <p className="text-sm text-ink/60">{modeLabel}</p>
        <p className="font-mono text-2xl font-semibold tabular-nums">{formatRemaining(remainingMs)}</p>
      </div>

      {expiredOnLoad && (
        <div className="mt-4 border border-incorrect/40 px-4 py-3 text-sm text-incorrect">
          제한 시간이 종료된 시험입니다. 제출 버튼을 눌러 결과를 확인하세요.
        </div>
      )}

      <div className="mt-6 flex flex-col gap-6 sm:flex-row sm:items-start">
        <div className="sm:w-56 sm:shrink-0">
          <ExamNavigator
            questions={questions}
            draftAnswers={draftAnswers}
            currentIndex={displayIndex}
            onSelect={setCurrentIndex}
          />
        </div>

        <div className="min-w-0 flex-1">
          {currentQuestion && (
            <ExamQuestionPanel
              key={currentQuestion.id}
              question={currentQuestion}
              questionNumber={displayIndex + 1}
              selectedChoiceId={draftAnswers[currentQuestion.id] ?? null}
              locked={locked}
              onSelect={(choiceId) => selectAnswer(currentQuestion.id, choiceId)}
              onNext={handleNext}
            />
          )}
        </div>
      </div>

      <p className="mt-6 text-sm text-ink/40">(제출 버튼은 다음 단계에서 추가됩니다)</p>
    </div>
  );
}
