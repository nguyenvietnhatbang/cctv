"use client";

import { StatusBadge } from "@/components/ops/ui";
import { money } from "@/components/ops/format";
import type { Metrics, WorkOrderListItem } from "@/components/ops/types";

export function DashboardScreen({
  metrics,
  orders,
  onOpenOrders,
}: {
  metrics: Metrics | null;
  orders: WorkOrderListItem[];
  onOpenOrders: (status: string) => void;
}) {
  const cards = [
    ["Phiếu hôm nay", metrics?.total_today ?? "0", ""],
    ["Chờ phân công", metrics?.pending_assignment ?? "0", "pending_assignment"],
    ["Đang xử lý", metrics?.working ?? "0", "working"],
    ["Chờ nghiệm thu", metrics?.awaiting_acceptance ?? "0", "awaiting_acceptance"],
    ["Chờ thanh toán", metrics?.awaiting_payment ?? "0", "awaiting_payment"],
    ["Đã thu hôm nay", money(metrics?.paid_today), ""],
    ["Công nợ mở", money(metrics?.open_debt), "debt"],
  ] as const;

  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map(([label, value, status]) => (
          <button key={label} className="metric-card" onClick={() => onOpenOrders(status)} type="button">
            <span>{label}</span>
            <strong>{value}</strong>
          </button>
        ))}
      </div>
      <section className="panel">
        <div className="panel-heading">
          <h2>Việc cần xử lý</h2>
          <span>{orders.length} phiếu</span>
        </div>
        <div className="grid gap-2">
          {orders.slice(0, 10).map((order) => (
            <div key={order.id} className="compact-row">
              <div>
                <p className="font-semibold">{order.code} · {order.customer_name}</p>
                <p className="text-sm text-zinc-500">{order.customer_address}</p>
              </div>
              <StatusBadge status={order.status} />
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
