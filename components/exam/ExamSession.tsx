"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { ExamStoreProvider } from "@/components/ExamStoreProvider";
import { fetchExamSession } from "@/lib/exam-api";
import { ExamSessionBody } from "./ExamSessionBody";

interface ExamSessionProps {
  sessionId: string;
}

export function ExamSession({ sessionId }: ExamSessionProps) {
  const router = useRouter();

  const {
    data,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ["examSession", sessionId],
    queryFn: () => fetchExamSession(sessionId),
    // 진행 중인 시험 데이터(문제 목록, 시작 시각)는 재조회로 바뀌면 안 된다 —
    // 특히 타이머 오프셋과 문제 순서가 재계산/재섞임 없이 고정돼 있어야 한다.
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  });

  // 이미 제출된 세션에 직접 들어온 경우(북마크, 뒤로가기 등)는 결과 화면으로 보낸다.
  // 네비게이션은 부수효과라 렌더링 중이 아니라 effect에서 수행한다.
  useEffect(() => {
    if (data && data.finishedAt !== null) {
      router.replace(`/exam/${sessionId}/result`);
    }
  }, [data, sessionId, router]);

  if (isLoading) {
    return <p className="mx-auto max-w-2xl px-4 py-8 text-ink/60">불러오는 중입니다...</p>;
  }

  if (isError || !data) {
    return (
      <div className="mx-auto max-w-2xl space-y-3 px-4 py-8">
        <p className="text-incorrect">시험 정보를 불러오지 못했습니다.</p>
        <button
          type="button"
          onClick={() => refetch()}
          className="font-semibold text-focus underline underline-offset-2"
        >
          다시 시도
        </button>
      </div>
    );
  }

  if (data.finishedAt !== null) {
    // 위 effect가 곧 결과 화면으로 옮기기 전까지 잠깐 보일 안내문.
    return <p className="mx-auto max-w-2xl px-4 py-8 text-ink/60">이미 제출된 시험입니다. 결과로 이동합니다...</p>;
  }

  return (
    <ExamStoreProvider key={sessionId} sessionId={sessionId}>
      <ExamSessionBody data={data} />
    </ExamStoreProvider>
  );
}
