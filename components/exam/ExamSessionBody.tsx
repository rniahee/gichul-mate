"use client";

import { useEffect } from "react";
import { useExamStore } from "@/components/ExamStoreProvider";
import { formatRemaining } from "@/lib/exam-timer";
import { useExamTimer } from "@/lib/hooks/use-exam-timer";
import type { ExamSessionDetail } from "@/types/exam";

interface ExamSessionBodyProps {
  data: ExamSessionDetail;
}

// 이 단계(2단계-E-2)에서는 타이머·스토어 연결과 currentIndex 보정까지만 다룬다.
// 네비게이터/문제 패널/제출은 다음 커밋(E-3, E-4)에서 이어서 추가한다.
export function ExamSessionBody({ data }: ExamSessionBodyProps) {
  const { questions, startedAt, durationSeconds, serverNow, mode } = data;

  const { remainingMs, expiredOnLoad } = useExamTimer({ startedAt, durationSeconds, serverNow });

  const rawIndex = useExamStore((s) => s.currentIndex);
  const setCurrentIndex = useExamStore((s) => s.setCurrentIndex);
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

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-rule pb-4">
        <p className="text-sm text-ink/60">{modeLabel}</p>
        <p className="font-mono text-2xl font-semibold tabular-nums">{formatRemaining(remainingMs)}</p>
      </div>

      {expiredOnLoad && (
        <div className="mt-4 border border-incorrect/40 px-4 py-3 text-sm text-incorrect">
          제한 시간이 종료된 시험입니다. 제출 버튼을 눌러 결과를 확인하세요.
        </div>
      )}

      <p className="mt-6 text-ink/60">
        {displayIndex + 1} / {questions.length}
      </p>
      <p className="mt-2 text-sm text-ink/40">(네비게이터·문제 화면·제출 버튼은 다음 단계에서 추가됩니다)</p>
    </div>
  );
}
