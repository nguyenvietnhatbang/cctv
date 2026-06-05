"use client";

import { useState } from "react";
import { CreditCard, Eye } from "lucide-react";
import { money } from "@/components/ops/format";
import { EmptyState, StatusBadge, TableShell, Toolbar } from "@/components/ops/ui";
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
    <>
      <Toolbar title="Thanh toán và công nợ" subtitle="Kiểm tra tổng tiền, xác nhận phương thức thu hoặc chuyển công nợ">
        <div className="flex flex-wrap gap-2">
          {[
            ["awaiting", "Chờ thanh toán"],
            ["paid", "Đã thanh toán"],
            ["debt", "Công nợ"],
            ["all", "Tất cả"],
          ].map(([value, label]) => (
            <button
              key={value}
              className={`tab-button ${filter === value ? "tab-button-active" : ""}`}
              onClick={() => setFilter(value as typeof filter)}
              type="button"
            >
              {label}
            </button>
          ))}
        </div>
      </Toolbar>
      <TableShell>
        {paymentOrders.length === 0 ? <EmptyState>Chưa có phiếu cần xử lý thanh toán.</EmptyState> : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Mã phiếu</th>
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
                    <p className="font-medium">{order.customer_name}</p>
                    <p className="text-xs text-zinc-500">{order.customer_phone}</p>
                  </td>
                  <td><StatusBadge status={order.status} /></td>
                  <td className="text-right font-semibold">{money(order.total_amount)}</td>
                  <td>{paymentLabels[order.payment_status ?? "unpaid"] ?? order.payment_status ?? "Chưa thanh toán"}</td>
                  <td>
                    <div className="action-cell">
                      <button className="icon-button" onClick={() => onView(order.id)} type="button" aria-label="Xem thanh toán"><Eye size={16} /></button>
                      <button className="icon-button" onClick={() => onPayment(order.id)} type="button" aria-label="Xử lý thanh toán"><CreditCard size={16} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </TableShell>
    </>
  );
}
