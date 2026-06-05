"use client";

import { Eye, MapPinned, Phone } from "lucide-react";
import { dateTime } from "@/components/ops/format";
import { EmptyState, StatusBadge } from "@/components/ops/ui";
import type { WorkOrderListItem } from "@/components/ops/types";

export function TechnicianScreen({
  orders,
  onView,
}: {
  orders: WorkOrderListItem[];
  onView: (id: string) => void;
}) {
  return (
    <section className="grid gap-3">
      {orders.map((order) => (
        <article key={order.id} className="mobile-job">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-zinc-500">{order.code}</p>
              <h2 className="mt-1 text-lg font-semibold">{order.customer_name}</h2>
            </div>
            <StatusBadge status={order.status} />
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
    </section>
  );
}
