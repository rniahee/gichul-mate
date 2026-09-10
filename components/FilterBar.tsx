"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useDebouncedValue } from "@/lib/hooks/use-debounced-value";
import type { SubjectDto } from "@/types/question";

interface FilterBarProps {
  subjectId: string | null;
  year: number | null;
  keyword: string;
  onSubjectChange: (subjectId: string | null) => void;
  onYearChange: (year: number | null) => void;
  onKeywordChange: (keyword: string) => void;
}

async function fetchSubjects(): Promise<SubjectDto[]> {
  const res = await fetch("/api/subjects");
  if (!res.ok) throw new Error("과목 목록을 불러오지 못했습니다.");
  return res.json();
}

async function fetchYears(): Promise<number[]> {
  const res = await fetch("/api/questions/years");
  if (!res.ok) throw new Error("연도 목록을 불러오지 못했습니다.");
  return res.json();
}

export function FilterBar({
  subjectId,
  year,
  keyword,
  onSubjectChange,
  onYearChange,
  onKeywordChange,
}: FilterBarProps) {
  const { data: subjects } = useQuery({ queryKey: ["subjects"], queryFn: fetchSubjects });
  const { data: years } = useQuery({ queryKey: ["questionYears"], queryFn: fetchYears });

  const [keywordInput, setKeywordInput] = useState(keyword);
  const debouncedKeyword = useDebouncedValue(keywordInput, 400);

  // URL이 바뀌어서(예: 뒤로가기) 부모가 내려주는 keyword가 달라지면 입력창도 맞춘다.
  // (effect 대신 렌더링 중 조정 — React 공식 권장 패턴)
  const [syncedKeyword, setSyncedKeyword] = useState(keyword);
  if (keyword !== syncedKeyword) {
    setSyncedKeyword(keyword);
    setKeywordInput(keyword);
  }

  useEffect(() => {
    if (debouncedKeyword !== keyword) {
      onKeywordChange(debouncedKeyword);
    }
  }, [debouncedKeyword, keyword, onKeywordChange]);

  return (
    <div className="flex flex-wrap gap-3">
      <select
        value={subjectId ?? ""}
        onChange={(e) => onSubjectChange(e.target.value || null)}
        aria-label="과목 필터"
      >
        <option value="">전체 과목</option>
        {subjects?.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
          </option>
        ))}
      </select>

      <select
        value={year ?? ""}
        onChange={(e) => onYearChange(e.target.value ? Number(e.target.value) : null)}
        aria-label="연도 필터"
      >
        <option value="">전체 연도</option>
        {years?.map((y) => (
          <option key={y} value={y}>
            {y}
          </option>
        ))}
      </select>

      <input
        type="text"
        value={keywordInput}
        onChange={(e) => setKeywordInput(e.target.value)}
        placeholder="키워드 검색"
        aria-label="키워드 검색"
      />
    </div>
  );
}
