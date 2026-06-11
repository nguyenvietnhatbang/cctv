"use client";

import { useState } from "react";
import { CreditCard, Eye, Coins, Search } from "lucide-react";
import { money } from "@/components/ops/format";
import { DeadlineBadge, EmptyState, StatusBadge, TablePagination, TableShell, clampTablePage, getPageItems } from "@/components/ops/ui";
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
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(1);
  const allPaymentOrders = orders.filter((order) =>
    ["completed", "awaiting_payment", "debt", "paid"].includes(order.status),
  );
  const paymentOrders = allPaymentOrders.filter((order) => {
    const q = searchQuery.trim().toLowerCase();
    const matchesFilter =
      filter === "awaiting" ? ["completed", "awaiting_payment"].includes(order.status)
      : filter === "paid" ? order.status === "paid" || order.payment_status === "paid"
      : filter === "debt" ? order.status === "debt" || order.payment_status === "debt"
      : true;
    const matchesSearch =
      !q ||
      [order.code, order.customer_name, order.customer_phone, order.technician_name ?? ""]
        .some((value) => value.toLowerCase().includes(q));
    return matchesFilter && matchesSearch;
  });
  const safePage = clampTablePage(page, paymentOrders.length);
  const visiblePaymentOrders = getPageItems(paymentOrders, safePage);

  return (
    <div className="flex flex-col gap-6">
      {/* Screen Title & Description */}
      <div className="screen-header">
        <div>
          <h2>Thanh toán & Công nợ</h2>
          <p>Xác nhận thanh toán, theo dõi công nợ khách hàng và doanh thu điều phối</p>
        </div>
      </div>

      {/* Table Shell with Tabs Header */}
      <TableShell>
        <div className="table-toolbar">
          <div className="table-filter-row">
            {[
              ["awaiting", "Chờ thanh toán"],
              ["paid", "Đã thanh toán"],
              ["debt", "Công nợ"],
              ["all", "Tất cả"],
            ].map(([value, label]) => (
              <button
                key={value}
                className={`tab-button h-8 px-3 text-xs ${filter === value ? "tab-button-active" : ""}`}
                onClick={() => {
                  setFilter(value as typeof filter);
                  setPage(1);
                }}
                type="button"
              >
                {label}
              </button>
            ))}
          </div>
          <div className="table-filter-row">
            <div className="table-search">
              <Search size={13} className="search-field-icon" />
              <input
                value={searchQuery}
                onChange={(event) => {
                  setSearchQuery(event.target.value);
                  setPage(1);
                }}
                className="input search-field-input h-9 !w-full py-1 text-xs"
                placeholder="Tìm mã, khách, SĐT..."
              />
            </div>
            <span className="text-xs font-semibold text-zinc-500 flex items-center gap-1">
              <Coins size={13} />
              Số công việc: {paymentOrders.length}
            </span>
          </div>
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
              {visiblePaymentOrders.map((order) => (
                <tr key={order.id}>
                  <td data-label="Mã" className="font-semibold">{order.code}</td>
                  <td data-label="Khách hàng">
                    <p className="font-semibold text-zinc-900 leading-tight">{order.customer_name}</p>
                    <p className="text-xs text-zinc-500 mt-1">{order.customer_phone}</p>
                  </td>
                  <td data-label="Trạng thái">
                    <div className="flex flex-wrap gap-1.5">
                      <StatusBadge order={order} />
                      <DeadlineBadge order={order} />
                    </div>
                  </td>
                  <td data-label="Tổng tiền" className="text-right font-bold text-zinc-900">{money(order.total_amount)}</td>
                  <td data-label="Thanh toán">
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
                  <td data-label="">
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
        <TablePagination page={safePage} total={paymentOrders.length} onPageChange={setPage} />
      </TableShell>
    </div>
  );
}
