"use client";

import { useMemo, useState } from "react";
import { History, MapPinned, Search, UserRound } from "lucide-react";
import { dateTime } from "@/components/ops/format";
import { EmptyState, StatusBadge } from "@/components/ops/ui";
import type { AssignmentHistoryItem } from "@/components/ops/types";

export function AssignmentHistoryList({
  items,
  loading = false,
}: {
  items: AssignmentHistoryItem[];
  loading?: boolean;
}) {
  const [query, setQuery] = useState("");
  const normalizedQuery = query.trim().toLowerCase();
  const filteredItems = useMemo(() => {
    if (!normalizedQuery) return items;
    return items.filter((item) => [
      item.code,
      item.customer_name,
      item.customer_phone,
      item.customer_address,
      item.assigned_by_name ?? "",
      item.note ?? "",
      item.technician_name,
    ].some((value) => value.toLowerCase().includes(normalizedQuery)));
  }, [items, normalizedQuery]);

  return (
    <section className="grid gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-zinc-700">
          <History size={15} />
          <span>{filteredItems.length} lần phân công</span>
        </div>
        <div className="relative flex items-center !w-64 max-w-full shrink-0">
          <Search size={13} className="search-field-icon" />
          <input
            className="input search-field-input h-9 !w-full py-1 text-xs"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Tìm mã, khách, địa chỉ..."
          />
        </div>
      </div>

      {loading ? <EmptyState>Đang tải lịch sử phân công...</EmptyState> : null}
      {!loading && filteredItems.length === 0 ? <EmptyState>Chưa có lịch sử phân công phù hợp.</EmptyState> : null}

      {!loading ? (
        <div className="grid gap-2">
          {filteredItems.map((item) => (
            <article key={item.id} className="rounded-md border border-zinc-200 bg-white p-3 text-sm">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-bold text-zinc-950">{item.code}</p>
                  <p className="mt-1 text-zinc-500">{dateTime(item.assigned_at)}</p>
                </div>
                <StatusBadge status={item.work_order_status} />
              </div>
              <div className="mt-3 grid gap-2 text-zinc-700 md:grid-cols-2">
                <p className="inline-flex items-center gap-2">
                  <UserRound size={14} />{item.customer_name} · {item.customer_phone}
                </p>
                <p className="inline-flex items-center gap-2">
                  <MapPinned size={14} />{item.customer_address}
                </p>
              </div>
              <div className="mt-3 grid gap-1 rounded-md bg-zinc-50 p-2 text-xs text-zinc-600">
                <p>Kỹ thuật viên: <strong>{item.technician_name}</strong></p>
                <p>Người phân công: <strong>{item.assigned_by_name ?? "Hệ thống"}</strong></p>
                <p>Trạng thái phân công: <strong>{item.unassigned_at ? `Đã thay đổi lúc ${dateTime(item.unassigned_at)}` : "Đang hiệu lực"}</strong></p>
                {item.note ? <p>Ghi chú: <strong>{item.note}</strong></p> : null}
              </div>
            </article>
          ))}
        </div>
      ) : null}
    </section>
  );
}
