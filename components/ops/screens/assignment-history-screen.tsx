"use client";

import { useEffect, useState } from "react";
import { History } from "lucide-react";
import { apiFetch } from "@/components/ops/api";
import { AssignmentHistoryList } from "@/components/ops/assignment-history-list";
import type { AssignmentHistoryItem } from "@/components/ops/types";

export function AssignmentHistoryScreen() {
  const [items, setItems] = useState<AssignmentHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    apiFetch<{ assignmentHistory: AssignmentHistoryItem[] }>("/api/assignment-history")
      .then((payload) => {
        if (!cancelled) setItems(payload.assignmentHistory);
      })
      .catch(() => {
        if (!cancelled) setItems([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section className="mx-auto grid w-full max-w-6xl gap-5">
      <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm lg:p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase text-zinc-500">Kỹ thuật viên</p>
            <h2 className="mt-1 text-2xl font-extrabold tracking-normal text-zinc-950 lg:text-3xl">Lịch sử phân công</h2>
            <p className="mt-1 text-sm text-zinc-500">Tra cứu các phiếu từng được giao, thời điểm phân công và trạng thái thay đổi.</p>
          </div>
          <History className="mt-1 text-zinc-400" size={24} />
        </div>
      </div>

      <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
        <AssignmentHistoryList items={items} loading={loading} />
      </div>
    </section>
  );
}
