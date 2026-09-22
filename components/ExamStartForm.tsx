"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import type { CreateExamRequest, CreateExamResponse, ExamMode } from "@/types/exam";
import type { SubjectDto } from "@/types/question";

async function fetchSubjects(): Promise<SubjectDto[]> {
  const res = await fetch("/api/subjects");
  if (!res.ok) throw new Error("과목 목록을 불러오지 못했습니다.");
  return res.json();
}

// DevTools의 오프라인 시뮬레이션은 (진짜 네트워크 단절과 달리) 요청을 즉시
// 실패시키지 않고 응답 없이 계속 pending 상태로 둘 수 있다. 그런 경우든
// 실제 서버 장애든, 요청이 무한정 걸려있는 상황 자체를 막기 위해 타임아웃을 둔다.
const CREATE_EXAM_TIMEOUT_MS = 10_000;

async function createExam(body: CreateExamRequest): Promise<CreateExamResponse> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), CREATE_EXAM_TIMEOUT_MS);

  try {
    const res = await fetch("/api/exams", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (!res.ok) throw new Error("시험을 시작하지 못했습니다.");
    return await res.json();
  } finally {
    // 정상 완료든, HTTP 에러든, abort든 항상 타이머를 정리한다.
    clearTimeout(timeoutId);
  }
}

const MODE_OPTIONS: { mode: ExamMode; title: string; description: string }[] = [
  { mode: "FULL_100", title: "전체 100문항", description: "5과목 각 20문항 · 150분" },
  { mode: "SUBJECT_20", title: "과목별 20문항", description: "선택한 과목 20문항 · 30분" },
];

export function ExamStartForm() {
  const router = useRouter();
  const [mode, setMode] = useState<ExamMode | null>(null);
  const [subjectId, setSubjectId] = useState<string | null>(null);

  const { data: subjects } = useQuery({ queryKey: ["subjects"], queryFn: fetchSubjects });

  const startMutation = useMutation({
    mutationFn: createExam,
    onSuccess: (data) => {
      router.push(`/exam/${data.sessionId}`);
    },
  });

  const canStart = mode === "FULL_100" || (mode === "SUBJECT_20" && Boolean(subjectId));

  const handleStart = () => {
    if (!mode || !canStart) return;
    startMutation.mutate(mode === "SUBJECT_20" ? { mode, subjectId: subjectId! } : { mode });
  };

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="text-xl font-semibold">CBT 모의고사</h1>
      <p className="mt-2 text-ink/70">시험 방식을 선택하세요.</p>

      {/* role="radio"를 쓰므로 부모는 radiogroup으로 감싸고, 선택 상태는
          aria-checked로 표현한다(aria-pressed는 토글 버튼 시맨틱이라 radio와 섞이면 안 됨). */}
      <div role="radiogroup" aria-label="시험 방식" className="mt-6 space-y-3">
        {MODE_OPTIONS.map((option) => {
          const isSelected = mode === option.mode;
          return (
            <button
              key={option.mode}
              type="button"
              role="radio"
              aria-checked={isSelected}
              onClick={() => setMode(option.mode)}
              className={
                "flex w-full items-center gap-4 border px-4 py-4 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-paper " +
                (isSelected ? "border-focus" : "border-rule")
              }
            >
              <span
                aria-hidden="true"
                className={
                  "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 text-xs font-semibold " +
                  (isSelected ? "border-focus bg-focus text-paper" : "border-rule")
                }
              >
                {isSelected ? "✓" : ""}
              </span>
              <span>
                <span className="block font-semibold">{option.title}</span>
                <span className="block text-sm text-ink/60">{option.description}</span>
              </span>
            </button>
          );
        })}
      </div>

      {mode === "SUBJECT_20" && (
        <div className="mt-4">
          <label htmlFor="exam-subject" className="mb-1.5 block text-sm font-medium text-ink/70">
            과목 선택
          </label>
          <select
            id="exam-subject"
            value={subjectId ?? ""}
            onChange={(e) => setSubjectId(e.target.value || null)}
            className="w-full rounded border border-rule bg-paper px-3 py-1.5 text-sm text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus sm:w-auto"
          >
            <option value="" disabled>
              과목을 선택하세요
            </option>
            {subjects?.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="mt-8">
        <button
          type="button"
          disabled={!canStart || startMutation.isPending}
          onClick={handleStart}
          className="w-full rounded-md bg-focus px-5 py-2 font-semibold text-paper focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-paper disabled:opacity-40 sm:w-auto"
        >
          {startMutation.isPending ? "시작하는 중..." : "시작"}
        </button>
      </div>

      {startMutation.isError && (
        <div className="mt-4 space-y-2 border border-incorrect/40 px-4 py-3 text-sm">
          <p className="text-incorrect">시험을 시작하지 못했습니다. 다시 시도해주세요.</p>
          <button
            type="button"
            disabled={startMutation.isPending}
            onClick={handleStart}
            className="font-semibold text-focus underline underline-offset-2"
          >
            다시 시도
          </button>
        </div>
      )}
    </div>
  );
}
