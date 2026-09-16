"use client";

interface PaginationProps {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
}

// MVP 범위라 번호별 페이지 버튼 대신 이전/다음 + "N / 전체" 표시로 단순화했다.
export function Pagination({ page, pageSize, total, onPageChange }: PaginationProps) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  if (totalPages <= 1) return null;

  // 이전/다음은 화면의 핵심 행위(제출, 다음 문제)가 아니라 보조 탐색이라
  // secondary 스타일(테두리 + hover 시 옅은 채움)로 의도적으로 가볍게 뒀다.
  const buttonClassName =
    "rounded border border-rule px-3 py-1.5 text-sm font-medium text-ink transition-colors hover:border-focus hover:bg-focus/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus disabled:opacity-40 disabled:hover:border-rule disabled:hover:bg-transparent";

  return (
    <div className="mt-6 flex items-center justify-center gap-4">
      <button type="button" disabled={page <= 1} onClick={() => onPageChange(page - 1)} className={buttonClassName}>
        이전
      </button>
      <span className="font-mono text-sm text-ink/70">
        {page} / {totalPages}
      </span>
      <button
        type="button"
        disabled={page >= totalPages}
        onClick={() => onPageChange(page + 1)}
        className={buttonClassName}
      >
        다음
      </button>
    </div>
  );
}
