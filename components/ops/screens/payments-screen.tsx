"use client";

import { useState } from "react";
import { CreditCard, Eye, Coins } from "lucide-react";
import { money } from "@/components/ops/format";
import { EmptyState, StatusBadge, TableShell } from "@/components/ops/ui";
import type { WorkOrderListItem } from "@/components/ops/types";

export function PaymentsScreen({
  orders,
  onView,
  onPayment,
}: {
  orders: WorkOrderListItem[];
  onView: (id: string) => void;
  onPayment: (id: string) => void;
}) {
  const [filter, setFilter] = useState<"all" | "awaiting" | "paid" | "debt">("awaiting");
  const allPaymentOrders = orders.filter((order) =>
    ["completed", "awaiting_payment", "debt", "paid"].includes(order.status),
  );
  const paymentOrders = allPaymentOrders.filter((order) => {
    if (filter === "awaiting") return ["completed", "awaiting_payment"].includes(order.status);
    if (filter === "paid") return order.status === "paid" || order.payment_status === "paid";
    if (filter === "debt") return order.status === "debt" || order.payment_status === "debt";
    return true;
  });

  const paymentLabels: Record<string, string> = {
    unpaid: "Chưa thanh toán",
    paid: "Đã thanh toán",
    debt: "Công nợ",
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Screen Title & Description */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-extrabold text-zinc-900 tracking-tight">Thanh toán & Công nợ</h2>
          <p className="text-xs text-zinc-500 mt-1">Xác nhận thanh toán, theo dõi công nợ khách hàng và doanh thu điều phối</p>
        </div>
      </div>

      {/* Table Shell with Tabs Header */}
      <TableShell>
        <div className="flex flex-wrap items-center justify-between gap-4 p-4 border-b border-zinc-100 bg-zinc-50/20">
          <div className="flex items-center gap-2">
            {[
              ["awaiting", "Chờ thanh toán"],
              ["paid", "Đã thanh toán"],
              ["debt", "Công nợ"],
              ["all", "Tất cả"],
            ].map(([value, label]) => (
              <button
                key={value}
                className={`tab-button h-8 px-3 text-xs ${filter === value ? "tab-button-active" : ""}`}
                onClick={() => setFilter(value as typeof filter)}
                type="button"
              >
                {label}
              </button>
            ))}
          </div>
          <span className="text-xs font-semibold text-zinc-500 flex items-center gap-1">
            <Coins size={13} />
            Số công việc: {paymentOrders.length}
          </span>
        </div>

        {paymentOrders.length === 0 ? (
          <EmptyState>Chưa có công việc cần xử lý thanh toán.</EmptyState>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th className="w-[120px]">Mã công việc</th>
                <th>Khách hàng</th>
                <th>Trạng thái</th>
                <th className="text-right">Tổng tiền</th>
                <th>Thanh toán</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {paymentOrders.map((order) => (
                <tr key={order.id}>
                  <td className="font-semibold">{order.code}</td>
                  <td>
                    <p className="font-semibold text-zinc-900 leading-tight">{order.customer_name}</p>
                    <p className="text-xs text-zinc-500 mt-1">{order.customer_phone}</p>
                  </td>
                  <td>
                    <StatusBadge order={order} />
                  </td>
                  <td className="text-right font-bold text-zinc-900">{money(order.total_amount)}</td>
                  <td>
                    {order.payment_status === "paid" ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-50 text-green-700 border border-green-200">
                        Đã thanh toán
                      </span>
                    ) : order.payment_status === "debt" ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-50 text-red-700 border border-red-200">
                        Công nợ
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-zinc-50 text-zinc-500 border border-zinc-200">
                        Chưa thanh toán
                      </span>
                    )}
                  </td>
                  <td>
                    <div className="action-cell">
                      <button
                        className="icon-button"
                        onClick={() => onView(order.id)}
                        type="button"
                        aria-label="Xem thanh toán"
                      >
                        <Eye size={15} />
                      </button>
                      <button
                        className="icon-button text-green-600 hover:border-green-200 hover:bg-green-50"
                        onClick={() => onPayment(order.id)}
                        type="button"
                        aria-label="Xử lý thanh toán"
                      >
                        <CreditCard size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </TableShell>
    </div>
  );
}
