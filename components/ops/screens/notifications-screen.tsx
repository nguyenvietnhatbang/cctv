"use client";

import { Bell, CheckCircle2, Eye } from "lucide-react";
import { dateTime } from "@/components/ops/format";
import { EmptyState } from "@/components/ops/ui";
import type { NotificationItem } from "@/components/ops/types";

export function NotificationsScreen({
  notifications,
  onOpen,
  onRead,
}: {
  notifications: NotificationItem[];
  onOpen: (id: string) => void;
  onRead: (id: string) => void;
}) {
  return (
    <section className="panel">
      <div className="panel-heading">
        <h2>Thông báo</h2>
        <span>{notifications.filter((item) => !item.read_at).length} chưa đọc</span>
      </div>
      <div className="grid gap-2">
        {notifications.map((item) => (
          <div key={item.id} className={`rounded-md border p-3 ${item.read_at ? "border-zinc-200" : "border-cyan-200 bg-cyan-50"}`}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-semibold">{item.title}</p>
                <p className="mt-1 text-sm text-zinc-600">{item.body}</p>
                <p className="mt-2 text-xs text-zinc-500">{dateTime(item.created_at)}</p>
              </div>
              <Bell size={18} className={item.read_at ? "text-zinc-400" : "text-cyan-700"} />
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {item.work_order_id ? (
                <button onClick={() => onOpen(item.work_order_id!)} className="btn-secondary h-9" type="button"><Eye size={15} />Mở phiếu</button>
              ) : null}
              {!item.read_at ? (
                <button onClick={() => onRead(item.id)} className="btn-primary h-9" type="button"><CheckCircle2 size={15} />Đã đọc</button>
              ) : null}
            </div>
          </div>
        ))}
        {notifications.length === 0 ? <EmptyState>Chưa có thông báo.</EmptyState> : null}
      </div>
    </section>
  );
}
