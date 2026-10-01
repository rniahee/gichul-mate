"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useExamStore } from "@/components/ExamStoreProvider";
import { submitExam } from "@/lib/exam-api";
import { formatRemaining } from "@/lib/exam-timer";
import { useExamTimer } from "@/lib/hooks/use-exam-timer";
import type { ExamSessionDetail } from "@/types/exam";
import { ExamNavigator } from "./ExamNavigator";
import { ExamQuestionPanel } from "./ExamQuestionPanel";

interface ExamSessionBodyProps {
  sessionId: string;
  data: ExamSessionDetail;
}

export function ExamSessionBody({ sessionId, data }: ExamSessionBodyProps) {
  const router = useRouter();
  const { questions, startedAt, durationSeconds, serverNow, mode } = data;

  const rawIndex = useExamStore((s) => s.currentIndex);
  const draftAnswers = useExamStore((s) => s.draftAnswers);
  const setCurrentIndex = useExamStore((s) => s.setCurrentIndex);
  const selectAnswer = useExamStore((s) => s.selectAnswer);
  const finalize = useExamStore((s) => s.finalize);

  const displayIndex = Math.min(Math.max(rawIndex, 0), questions.length - 1);

  // localStorage에 남아있던 currentIndex가 지금 문제 수 범위를 벗어나면(예: 손상된
  // 값, 혹은 예전 데이터) 화면엔 항상 displayIndex를 써서 잘못된 값이 보이는 프레임
  // 자체가 없게 하고, 저장값도 다음 변경 시점에 맞게 보정해둔다.
  useEffect(() => {
    if (rawIndex !== displayIndex) {
      setCurrentIndex(displayIndex);
    }
  }, [rawIndex, displayIndex, setCurrentIndex]);

  // 응시 중 실시간으로 시간이 다 된 경우(아래 onExpire)에만 true가 된다.
  // 로드 시점에 이미 끝나 있던 경우는 useExamTimer의 expiredOnLoad로 별도 처리.
  const [hasExpiredLive, setHasExpiredLive] = useState(false);

  // 자동 만료 제출과 수동 "제출" 클릭이 겹쳐도 실제 요청은 하나만 나가게 막는
  // 동기 잠금. React state(submitMutation.isPending)는 리렌더를 거쳐야 반영돼서
  // 같은 이벤트 루프 틱 안의 중복 호출을 못 막기 때문에 ref를 쓴다.
  const submitLockRef = useRef(false);

  const submitMutation = useMutation({
    mutationFn: (answers: Record<string, string>) => submitExam(sessionId, answers),
    // 서버가 200이든(정상 제출) 409든(이미 다른 경로로 제출됨) submitExam()은 둘 다
    // 에러 없이 { alreadySubmitted } 형태로 돌려주므로, 여기서 구분할 필요가 없다
    // — 둘 다 "제출 완료"로 똑같이 처리한다.
    onSuccess: () => {
      finalize(); // isFinalized=true + localStorage 정리. 이후 selectAnswer/setCurrentIndex는 스토어 안에서 스스로 무시된다.
      router.push(`/exam/${sessionId}/result`);
    },
    onError: () => {
      submitLockRef.current = false; // 실패했으니 재시도할 수 있게 잠금을 푼다.
    },
  });

  function requestSubmit({ skipConfirm }: { skipConfirm: boolean }) {
    if (submitLockRef.current) return;

    if (!skipConfirm) {
      const unanswered = questions.length - Object.keys(draftAnswers).length;
      if (unanswered > 0) {
        // window.confirm()은 호출 중 JS 실행 자체를 동기적으로 멈춘다 — 이 대화상자가
        // 떠 있는 동안은 setInterval 기반 타이머(아래 onExpire 포함)도 못 돈다. 그래서
        // "확인창이 열려 있는 사이에 실시간 만료가 끼어들어 두 번 제출되는" 경쟁 상황은
        // 지금 구조에서 일어날 수 없다 — 의도한 설계라기보다 window.confirm의 블로킹
        // 특성에 기대고 있는 것이다. 나중에 confirm()을 비동기 커스텀 모달로 바꾸면 이
        // 보호가 사라진다. 그땐 아래의 재확인 한 줄만으로는 부족하고(모달이 떠 있는
        // 동안 걸어야 할 더 넓은 잠금이 필요), lock을 "확인 대기 중" 상태까지 포함하도록
        // 다시 설계해야 한다.
        const proceed = window.confirm(`안 푼 문제가 ${unanswered}개 있습니다. 제출하시겠습니까?`);
        if (!proceed) return;
      }
    }

    // confirm() 이후 방어적 재확인(지금 구조에서는 위 이유로 항상 false로 지나간다).
    if (submitLockRef.current) return;

    submitLockRef.current = true;
    submitMutation.mutate(draftAnswers);
  }

  const { remainingMs, expiredOnLoad } = useExamTimer({
    startedAt,
    durationSeconds,
    serverNow,
    onExpire: () => {
      setHasExpiredLive(true);
      // 이 시점의 "locked"는 아직 리렌더 전이라 hasExpiredLive를 반영 못 하므로,
      // locked 변수 대신 명시적으로 true를 넘긴다.
      requestSubmit({ skipConfirm: true });
    },
  });

  const subjectName = questions[0]?.subjectName ?? "";
  const modeLabel = mode === "FULL_100" ? "전체 100문항" : `과목별 20문항 · ${subjectName}`;

  const locked = expiredOnLoad || hasExpiredLive;
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
        <div className="flex items-center gap-4">
          <p className="font-mono text-2xl font-semibold tabular-nums">{formatRemaining(remainingMs)}</p>
          <button
            type="button"
            disabled={submitMutation.isPending}
            onClick={() => requestSubmit({ skipConfirm: locked })}
            className="rounded-md bg-focus px-5 py-2 font-semibold text-paper focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-paper disabled:opacity-40"
          >
            {submitMutation.isPending ? "제출 중..." : "제출"}
          </button>
        </div>
      </div>

      {expiredOnLoad && (
        <div className="mt-4 border border-incorrect/40 px-4 py-3 text-sm text-incorrect">
          제한 시간이 종료된 시험입니다. 제출 버튼을 눌러 결과를 확인하세요.
        </div>
      )}

      {submitMutation.isError && (
        <div className="mt-4 space-y-2 border border-incorrect/40 px-4 py-3 text-sm">
          <p className="text-incorrect">제출에 실패했습니다. 다시 시도해주세요.</p>
          <button
            type="button"
            disabled={submitMutation.isPending}
            onClick={() => requestSubmit({ skipConfirm: true })}
            className="font-semibold text-focus underline underline-offset-2"
          >
            다시 시도
          </button>
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
    </div>
  );
}
