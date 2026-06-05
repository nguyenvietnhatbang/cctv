"use client";

import { dateTime } from "@/components/ops/format";
import type { WorkOrderDetail } from "@/components/ops/types";

export function StatusHistory({ detail }: { detail: WorkOrderDetail }) {
  return (
    <div className="rounded-md border border-zinc-200 p-4">
      <h3 className="section-title">Lịch sử trạng thái</h3>
      <div className="mt-3 grid gap-2">
        {detail.history.map((item) => (
          <div key={item.id} className="rounded-md bg-zinc-50 p-3 text-sm">
            <p className="font-medium">{item.to_status}</p>
            <p className="text-zinc-500">{dateTime(item.changed_at)} · {item.changed_by_name ?? "Hệ thống"} {item.note ? `· ${item.note}` : ""}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
