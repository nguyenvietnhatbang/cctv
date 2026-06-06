"use client";

import { useState } from "react";
import { dateTime } from "@/components/ops/format";
import type { WorkOrderDetail } from "@/components/ops/types";
import { ModalListControls, clampPage, pageItems } from "@/components/ops/modals/modal-list-controls";

export function StatusHistory({ detail }: { detail: WorkOrderDetail }) {
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const normalizedQuery = query.trim().toLowerCase();
  const filteredHistory = detail.history.filter((item) => {
    if (!normalizedQuery) return true;
    return [item.to_status, dateTime(item.changed_at), item.changed_by_name ?? "", item.note ?? ""]
      .some((value) => value.toLowerCase().includes(normalizedQuery));
  });
  const safePage = clampPage(page, filteredHistory.length);
  const visibleHistory = pageItems(filteredHistory, safePage);

  return (
    <div className="rounded-md border border-zinc-200 p-4">
      <h3 className="section-title">Lịch sử trạng thái</h3>
      <div className="mt-3">
        <ModalListControls
          query={query}
          onQueryChange={(nextQuery) => {
            setQuery(nextQuery);
            setPage(1);
          }}
          page={safePage}
          total={filteredHistory.length}
          label="Lọc lịch sử trạng thái"
          placeholder="Lọc trạng thái, người đổi, ghi chú..."
          onPageChange={(nextPage) => setPage(clampPage(nextPage, filteredHistory.length))}
        />
      </div>
      <div className="mt-3 grid gap-2">
        {visibleHistory.map((item) => (
          <div key={item.id} className="rounded-md bg-zinc-50 p-3 text-sm">
            <p className="font-medium">{item.to_status}</p>
            <p className="text-zinc-500">{dateTime(item.changed_at)} · {item.changed_by_name ?? "Hệ thống"} {item.note ? `· ${item.note}` : ""}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
