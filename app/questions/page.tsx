"use client";

import { Suspense, useCallback, useMemo } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { FilterBar } from "@/components/FilterBar";
import { Pagination } from "@/components/Pagination";
import type { QuestionListResponse } from "@/types/question";

const PAGE_SIZE = 20;

async function fetchQuestions(params: URLSearchParams): Promise<QuestionListResponse> {
  const res = await fetch(`/api/questions?${params.toString()}`);
  if (!res.ok) throw new Error("문제 목록을 불러오지 못했습니다.");
  return res.json();
}

export default function QuestionsPage() {
  return (
    <Suspense fallback={<p className="p-6">불러오는 중입니다...</p>}>
      <QuestionsPageContent />
    </Suspense>
  );
}

// useSearchParams()를 쓰는 부분은 Suspense 경계 안에 있어야 한다
// (Next.js가 이 훅을 쓰는 클라이언트 컴포넌트는 CSR bailout 대상으로 취급함).
function QuestionsPageContent() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const subjectId = searchParams.get("subjectId");
  const yearParam = searchParams.get("year");
  const year = yearParam ? Number(yearParam) : null;
  const keyword = searchParams.get("keyword") ?? "";
  const page = Number(searchParams.get("page") ?? "1");

  // 필터/페이지 상태를 URL 쿼리에 담아 새로고침·공유·뒤로가기에도 유지되게 한다.
  const updateParams = useCallback(
    (updates: Record<string, string | number | null>) => {
      const next = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(updates)) {
        if (value === null || value === "") {
          next.delete(key);
        } else {
          next.set(key, String(value));
        }
      }
      router.replace(`${pathname}?${next.toString()}`, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  const handleSubjectChange = (newSubjectId: string | null) => {
    updateParams({ subjectId: newSubjectId, page: 1 });
  };
  const handleYearChange = (newYear: number | null) => {
    updateParams({ year: newYear, page: 1 });
  };
  const handleKeywordChange = (newKeyword: string) => {
    updateParams({ keyword: newKeyword || null, page: 1 });
  };
  const handlePageChange = (newPage: number) => {
    updateParams({ page: newPage });
  };

  const queryParams = useMemo(() => {
    const p = new URLSearchParams();
    if (subjectId) p.set("subjectId", subjectId);
    if (year) p.set("year", String(year));
    if (keyword) p.set("keyword", keyword);
    p.set("page", String(page));
    p.set("pageSize", String(PAGE_SIZE));
    return p;
  }, [subjectId, year, keyword, page]);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["questions", subjectId, year, keyword, page],
    queryFn: () => fetchQuestions(queryParams),
    placeholderData: keepPreviousData,
  });

  return (
    <div className="p-6">
      <h1>문제 은행</h1>

      <FilterBar
        subjectId={subjectId}
        year={year}
        keyword={keyword}
        onSubjectChange={handleSubjectChange}
        onYearChange={handleYearChange}
        onKeywordChange={handleKeywordChange}
      />

      {isLoading && <p>불러오는 중입니다...</p>}

      {isError && (
        <div>
          <p>문제를 불러오지 못했습니다.</p>
          <button type="button" onClick={() => refetch()}>
            다시 시도
          </button>
        </div>
      )}

      {!isLoading && !isError && data?.total === 0 && <p>조건에 맞는 문제가 없습니다.</p>}

      {data && data.total > 0 && (
        <ul>
          {data.items.map((q) => (
            <li key={q.id}>
              <Link href={`/questions/${q.id}`}>
                [{q.subjectName}] {q.content}
              </Link>
              <span>
                {" "}
                {q.year}
                {q.round ? `-${q.round}회` : ""}
              </span>
            </li>
          ))}
        </ul>
      )}

      {data && (
        <Pagination page={page} pageSize={PAGE_SIZE} total={data.total} onPageChange={handlePageChange} />
      )}
    </div>
  );
}
