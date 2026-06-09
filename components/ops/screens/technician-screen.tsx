"use client";

import { useEffect, useState } from "react";
import { Eye, MapPinned, Phone } from "lucide-react";
import { apiFetch } from "@/components/ops/api";
import { AssignmentHistoryList } from "@/components/ops/assignment-history-list";
import { dateTime } from "@/components/ops/format";
import { EmptyState, StatusBadge } from "@/components/ops/ui";
import type { AssignmentHistoryItem, WorkOrderListItem } from "@/components/ops/types";

export function TechnicianScreen({
  orders,
  onView,
}: {
  orders: WorkOrderListItem[];
  onView: (id: string) => void;
}) {
  const [assignmentHistory, setAssignmentHistory] = useState<AssignmentHistoryItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setHistoryLoading(true);
    apiFetch<{ assignmentHistory: AssignmentHistoryItem[] }>("/api/assignment-history")
      .then((payload) => {
        if (!cancelled) setAssignmentHistory(payload.assignmentHistory);
      })
      .catch(() => {
        if (!cancelled) setAssignmentHistory([]);
      })
      .finally(() => {
        if (!cancelled) setHistoryLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section className="grid gap-6">
      <div className="grid gap-3">
        <div>
          <h2 className="text-xl font-bold text-zinc-950">Công việc đang giao</h2>
          <p className="mt-1 text-xs text-zinc-500">Các phiếu hiện tại cần xử lý</p>
        </div>
        {orders.map((order) => (
          <article key={order.id} className="mobile-job">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-zinc-500">{order.code}</p>
                <h2 className="mt-1 text-lg font-semibold">{order.customer_name}</h2>
              </div>
              <StatusBadge order={order} />
            </div>
            <p className="mt-3 text-sm leading-6 text-zinc-600">{order.description}</p>
            <div className="mt-4 grid gap-2 text-sm">
              <p>{order.customer_address}</p>
              <p>{dateTime(order.appointment_at)}</p>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2">
              <a className="btn-secondary h-11" href={`tel:${order.customer_phone}`}><Phone size={15} />Gọi</a>
              <a
                className="btn-secondary h-11"
                href={`https://maps.google.com/?q=${encodeURIComponent(order.customer_address)}`}
                target="_blank"
                rel="noreferrer"
              >
                <MapPinned size={15} />Bản đồ
              </a>
              <button className="btn-primary h-11" onClick={() => onView(order.id)} type="button"><Eye size={15} />Mở</button>
            </div>
          </article>
        ))}
        {orders.length === 0 ? <EmptyState>Chưa có công việc được giao.</EmptyState> : null}
      </div>

      <div className="grid gap-3">
        <div>
          <h2 className="text-xl font-bold text-zinc-950">Lịch sử phân công</h2>
          <p className="mt-1 text-xs text-zinc-500">Các phiếu đã từng được giao cho bạn</p>
        </div>
        <AssignmentHistoryList items={assignmentHistory} loading={historyLoading} />
      </div>
    </section>
  );
}
