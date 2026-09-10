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

  return (
    <div className="flex items-center gap-3">
      <button type="button" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
        이전
      </button>
      <span>
        {page} / {totalPages}
      </span>
      <button type="button" disabled={page >= totalPages} onClick={() => onPageChange(page + 1)}>
        다음
      </button>
    </div>
  );
}
