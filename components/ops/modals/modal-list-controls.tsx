"use client";

import { Search } from "lucide-react";

export const MODAL_PAGE_SIZE = 5;

export function pageCount(total: number, pageSize = MODAL_PAGE_SIZE) {
  return Math.max(1, Math.ceil(total / pageSize));
}

export function pageItems<T>(items: T[], page: number, pageSize = MODAL_PAGE_SIZE) {
  return items.slice((page - 1) * pageSize, page * pageSize);
}

export function clampPage(page: number, total: number, pageSize = MODAL_PAGE_SIZE) {
  return Math.min(Math.max(1, page), pageCount(total, pageSize));
}

export function ModalListControls({
  query,
  onQueryChange,
  page,
  total,
  label,
  placeholder,
  onPageChange,
}: {
  query: string;
  onQueryChange: (query: string) => void;
  page: number;
  total: number;
  label: string;
  placeholder: string;
  onPageChange: (page: number) => void;
}) {
  const totalPages = pageCount(total);

  return (
    <div className="modal-list-controls">
      <label className="relative min-w-0 flex-1">
        <Search size={14} className="search-field-icon" />
        <input
          className="input search-field-input h-9 text-xs"
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder={placeholder}
          aria-label={label}
        />
      </label>
      <div className="flex shrink-0 items-center gap-2">
        <span className="text-xs font-semibold text-zinc-500">
          {total} mục · {page}/{totalPages}
        </span>
        <div className="flex gap-1">
          <button className="btn-secondary h-8 px-2 text-xs" type="button" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
            Trước
          </button>
          <button className="btn-secondary h-8 px-2 text-xs" type="button" disabled={page >= totalPages} onClick={() => onPageChange(page + 1)}>
            Sau
          </button>
        </div>
      </div>
    </div>
  );
}
