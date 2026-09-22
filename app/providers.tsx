"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { pruneStaleExamDrafts } from "@/lib/exam-storage";

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());

  // 앱 진입 시 한 번, 24시간 넘게 방치된 시험 임시 답안을 정리한다.
  // pruneStaleExamDrafts()는 저장소가 없거나(SSR) 접근이 막혀도 조용히 0을 반환한다.
  useEffect(() => {
    pruneStaleExamDrafts();
  }, []);

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
