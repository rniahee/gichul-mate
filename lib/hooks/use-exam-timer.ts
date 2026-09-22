"use client";

import { useEffect, useEffectEvent, useState } from "react";
import { computeClockOffset, computeEndsAt, computeRemainingMs, startExamTimer } from "../exam-timer";

export interface UseExamTimerOptions {
  startedAt: string;
  durationSeconds: number;
  serverNow: string;
  // 로드 후 실제로 시간이 다 됐을 때 정확히 한 번 호출된다. 로드 시점에 이미
  // 만료돼 있던 경우(expiredOnLoad)에는 호출되지 않는다 — 자동 제출은 하지 않는 정책.
  onExpire?: () => void;
}

export interface UseExamTimerResult {
  remainingMs: number;
  expiredOnLoad: boolean;
}

export function useExamTimer({ startedAt, durationSeconds, serverNow, onExpire }: UseExamTimerOptions): UseExamTimerResult {
  // 클록 오프셋과 종료 시각은 데이터를 처음 받은 시점에 한 번만 고정한다.
  // TanStack Query가 재조회해서 startedAt/serverNow를 다시 줘도(값이 사실상 동일하더라도)
  // 다시 계산하지 않아야 남은 시간이 갑자기 튀는 일이 없다.
  // (렌더 중에는 ref.current를 읽을 수 없으므로 useState의 지연 초기화를 쓴다.)
  const [{ endsAt, offsetMs }] = useState(() => ({
    endsAt: computeEndsAt(startedAt, durationSeconds),
    offsetMs: computeClockOffset(new Date(serverNow).getTime(), Date.now()),
  }));

  const [remainingMs, setRemainingMs] = useState(() => computeRemainingMs(endsAt, Date.now(), offsetMs));
  const [expiredOnLoad] = useState(() => remainingMs <= 0);

  // useEffectEvent: 항상 최신 onExpire를 보되, 반환된 함수 자체는 참조가 바뀌지 않는다.
  // 그래서 onExpire가 리렌더마다 새로 만들어져도 아래 effect는 재실행되지 않는다.
  const notifyExpire = useEffectEvent(() => {
    onExpire?.();
  });

  useEffect(() => {
    const handle = startExamTimer({
      endsAt,
      offsetMs,
      onTick: setRemainingMs,
      onExpire: notifyExpire,
    });
    return () => handle.stop();
  }, [endsAt, offsetMs]);

  return { remainingMs, expiredOnLoad };
}
