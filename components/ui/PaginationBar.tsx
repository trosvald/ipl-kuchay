"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { cn } from "@/lib/utils";

export interface PaginationBarProps {
  page: number;
  pageSize: number;
  totalRows: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  pageSizeOptions?: number[];
  className?: string;
}

export function PaginationBar({
  page,
  pageSize,
  totalRows,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [5, 10, 20, 50],
  className,
}: Readonly<PaginationBarProps>) {
  const totalPages = Math.max(1, Math.ceil(totalRows / pageSize));
  const pageStart = totalRows === 0 ? 0 : (page - 1) * pageSize + 1;
  const pageEnd = Math.min(page * pageSize, totalRows);

  return (
    <div
      className={cn(
        "flex flex-col gap-3 text-sm text-slate-500 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between",
        className,
      )}
    >
      {/* Info text */}
      <p className="text-xs">
        {totalRows === 0
          ? "Tidak ada data"
          : `Menampilkan ${pageStart}-${pageEnd} dari ${totalRows} data`}
      </p>

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Page size selector */}
        <label htmlFor="pagination-page-size" className="inline-flex items-center gap-1.5 text-xs">
          <span className="hidden sm:inline text-slate-500">Baris</span>
          <Select
            id="pagination-page-size"
            className="h-8 w-16 text-xs rounded-md border-slate-200"
            value={String(pageSize)}
            onChange={(event) => {
              onPageSizeChange(Number(event.target.value));
              onPageChange(1);
            }}
          >
            {pageSizeOptions.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </Select>
        </label>

        {/* Navigation */}
        <div className="flex items-center gap-1">
          <Button
            size="xs"
            variant="outline"
            aria-label="Halaman sebelumnya"
            onClick={() => onPageChange(Math.max(1, page - 1))}
            disabled={page <= 1}
            className="border-slate-200"
          >
            <ChevronLeft className="size-3.5" />
          </Button>

          <span className="min-w-[4rem] text-center text-xs font-medium text-slate-600 tabular-nums">
            {totalPages === 0 ? "0 / 0" : `${page} / ${totalPages}`}
          </span>

          <Button
            size="xs"
            variant="outline"
            aria-label="Halaman berikutnya"
            onClick={() => onPageChange(Math.min(totalPages, page + 1))}
            disabled={page >= totalPages}
            className="border-slate-200"
          >
            <ChevronRight className="size-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}
