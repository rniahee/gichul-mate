"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import { useStore } from "zustand";
import { createExamStore, type ExamStoreApi, type ExamStoreState } from "@/lib/stores/exam-store";

const ExamStoreContext = createContext<ExamStoreApi | null>(null);

// 시험 세션 하나당 스토어 하나. 스토어는 생성 시점에 localStorage에서 임시 답안을
// 동기적으로 복원하므로, 서버 렌더 결과와 달라질 수 있다. 그래서 이 Provider는
// 서버 데이터를 불러온 뒤(클라이언트에서만 렌더되는 시점)에 마운트해야 한다.
export function ExamStoreProvider({ sessionId, children }: { sessionId: string; children: ReactNode }) {
  // sessionId가 바뀌면 부모에서 key={sessionId}로 다시 마운트해서 스토어를 새로 만든다.
  const [store] = useState(() => createExamStore(sessionId));
  return <ExamStoreContext.Provider value={store}>{children}</ExamStoreContext.Provider>;
}

export function useExamStoreApi(): ExamStoreApi {
  const store = useContext(ExamStoreContext);
  if (!store) throw new Error("useExamStoreApi는 ExamStoreProvider 안에서만 사용할 수 있습니다.");
  return store;
}

export function useExamStore<T>(selector: (state: ExamStoreState) => T): T {
  return useStore(useExamStoreApi(), selector);
}
