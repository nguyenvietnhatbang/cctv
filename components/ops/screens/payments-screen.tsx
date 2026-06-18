"use client";

import { useMemo, useState } from "react";
import { CreditCard, Eye, Coins, Search, UserRound, ListFilter, type LucideIcon } from "lucide-react";
import { money } from "@/components/ops/format";
import { DeadlineBadge, EmptyState, StatusBadge, TablePagination, TableShell, clampTablePage, getPageItems } from "@/components/ops/ui";
import type { WorkOrderListItem } from "@/components/ops/types";

type PaymentViewMode = "orders" | "customers";

const viewTabs: ReadonlyArray<{ value: PaymentViewMode; label: string; icon: LucideIcon }> = [
  { value: "orders", label: "Theo công việc", icon: CreditCard },
  { value: "customers", label: "Theo khách hàng", icon: UserRound },
];

type CustomerPaymentGroup = {
  customerId: string;
  customerName: string;
  customerPhone: string;
  customerAddress: string;
  orders: WorkOrderListItem[];
  orderCount: number;
  totalAmount: number;
  paidAmount: number;
  debtAmount: number;
};

function paymentStatusLabel(order: WorkOrderListItem) {
  if (order.payment_status === "paid") return "Đã thanh toán";
  if (order.payment_status === "debt") return "Công nợ";
  return "Chưa thanh toán";
}

function PaymentStatusPill({ order }: { order: WorkOrderListItem }) {
  if (order.payment_status === "paid") {
    return (
      <span className="inline-flex items-center rounded-full border border-green-200 bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700">
        Đã thanh toán
      </span>
    );
  }

  if (order.payment_status === "debt") {
    return (
      <span className="inline-flex items-center rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700">
        Công nợ
      </span>
    );
  }

  return (
    <span className="inline-flex items-center rounded-full border border-zinc-200 bg-zinc-50 px-2 py-0.5 text-xs font-medium text-zinc-500">
      Chưa thanh toán
    </span>
  );
}

export function PaymentsScreen({
  orders,
  onView,
  onPayment,
}: {
  orders: WorkOrderListItem[];
  onView: (id: string) => void;
  onPayment: (id: string) => void;
}) {
  const [viewMode, setViewMode] = useState<PaymentViewMode>("orders");
  const [filter, setFilter] = useState<"all" | "awaiting" | "paid" | "debt">("awaiting");
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(1);
  const [customerPage, setCustomerPage] = useState(1);
  const allPaymentOrders = orders.filter((order) =>
    ["completed", "awaiting_payment", "debt", "paid"].includes(order.status),
  );
  const normalizedSearchQuery = searchQuery.trim().toLowerCase();
  const paymentOrders = allPaymentOrders.filter((order) => {
    const matchesFilter =
      filter === "awaiting" ? ["completed", "awaiting_payment"].includes(order.status)
      : filter === "paid" ? order.status === "paid" || order.payment_status === "paid"
      : filter === "debt" ? order.status === "debt" || order.payment_status === "debt"
      : true;
    const matchesSearch =
      !normalizedSearchQuery ||
      [
        order.code,
        order.customer_name,
        order.customer_phone,
        order.customer_address,
        order.technician_name ?? "",
        paymentStatusLabel(order),
      ].some((value) => value.toLowerCase().includes(normalizedSearchQuery));
    return matchesFilter && matchesSearch;
  });
  const customerGroups = useMemo(() => {
    const groups = new Map<string, CustomerPaymentGroup>();

    for (const order of paymentOrders) {
      const current = groups.get(order.customer_id);
      if (current) {
        current.orders.push(order);
        current.orderCount += 1;
        current.totalAmount += Number(order.total_amount);
        current.paidAmount += Number(order.paid_amount);
        current.debtAmount += Number(order.debt_amount);
        continue;
      }

      groups.set(order.customer_id, {
        customerId: order.customer_id,
        customerName: order.customer_name,
        customerPhone: order.customer_phone,
        customerAddress: order.customer_address,
        orders: [order],
        orderCount: 1,
        totalAmount: Number(order.total_amount),
        paidAmount: Number(order.paid_amount),
        debtAmount: Number(order.debt_amount),
      });
    }

    return [...groups.values()].sort((left, right) =>
      right.debtAmount - left.debtAmount
      || right.orderCount - left.orderCount
      || left.customerName.localeCompare(right.customerName, "vi"),
    );
  }, [paymentOrders]);
  const safePage = clampTablePage(page, paymentOrders.length);
  const visiblePaymentOrders = getPageItems(paymentOrders, safePage);
  const safeCustomerPage = clampTablePage(customerPage, customerGroups.length);
  const visibleCustomerGroups = getPageItems(customerGroups, safeCustomerPage);
  const activeCount = viewMode === "orders" ? paymentOrders.length : customerGroups.length;

  function showCustomerOrders(group: CustomerPaymentGroup) {
    setViewMode("orders");
    setSearchQuery(group.customerPhone || group.customerName);
    setPage(1);
    setCustomerPage(1);
  }

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
            {viewTabs.map(({ value, label, icon: Icon }) => (
              <button
                key={value}
                className={`tab-button h-9 gap-2 px-3 text-xs ${viewMode === value ? "tab-button-active" : ""}`}
                onClick={() => {
                  setViewMode(value);
                  setPage(1);
                  setCustomerPage(1);
                }}
                type="button"
              >
                <Icon size={14} />
                {label}
              </button>
            ))}
          </div>
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
                  setCustomerPage(1);
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
                  setCustomerPage(1);
                }}
                className="input search-field-input h-9 !w-full py-1 text-xs"
                placeholder="Tìm mã, khách, SĐT, trạng thái..."
              />
            </div>
            <span className="text-xs font-semibold text-zinc-500 flex items-center gap-1">
              <Coins size={13} />
              {viewMode === "orders" ? "Số công việc" : "Số khách"}: {activeCount}
            </span>
          </div>
        </div>

        {viewMode === "customers" ? (
          customerGroups.length === 0 ? (
            <EmptyState>Chưa có khách hàng phù hợp với bộ lọc thanh toán.</EmptyState>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Khách hàng</th>
                  <th className="text-right">Số phiếu</th>
                  <th className="text-right">Tổng tiền</th>
                  <th className="text-right">Đã thu</th>
                  <th className="text-right">Còn nợ</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {visibleCustomerGroups.map((group) => (
                  <tr key={group.customerId}>
                    <td data-label="Khách hàng">
                      <p className="font-semibold leading-tight text-zinc-900">{group.customerName}</p>
                      <p className="mt-1 text-xs text-zinc-500">{group.customerPhone}</p>
                      <p className="mt-1 line-clamp-2 text-xs text-zinc-500">{group.customerAddress}</p>
                    </td>
                    <td data-label="Số phiếu" className="text-right">
                      <p className="font-bold text-zinc-900">{group.orderCount}</p>
                    </td>
                    <td data-label="Tổng tiền" className="text-right font-bold text-zinc-900">{money(group.totalAmount)}</td>
                    <td data-label="Đã thu" className="text-right font-semibold text-emerald-700">{money(group.paidAmount)}</td>
                    <td data-label="Còn nợ" className="text-right font-semibold text-rose-700">{money(group.debtAmount)}</td>
                    <td data-label="">
                      <div className="action-cell">
                        <button
                          className="btn-secondary h-9 px-3 text-xs"
                          onClick={() => showCustomerOrders(group)}
                          type="button"
                          aria-label={`Xem phiếu thanh toán của ${group.customerName}`}
                        >
                          <ListFilter size={14} />Xem phiếu
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )
        ) : paymentOrders.length === 0 ? (
          <EmptyState>Chưa có công việc cần xử lý thanh toán.</EmptyState>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th className="w-[120px]">Mã công việc</th>
                <th>Khách hàng</th>
                <th>Trạng thái</th>
                <th className="text-right">Tổng tiền</th>
                <th className="text-right">Đã thu</th>
                <th className="text-right">Còn nợ</th>
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
                  <td data-label="Đã thu" className="text-right font-semibold text-emerald-700">{money(order.paid_amount)}</td>
                  <td data-label="Còn nợ" className="text-right font-semibold text-rose-700">{money(order.debt_amount)}</td>
                  <td data-label="Thanh toán">
                    <PaymentStatusPill order={order} />
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
        {viewMode === "customers" ? (
          <TablePagination page={safeCustomerPage} total={customerGroups.length} onPageChange={setCustomerPage} />
        ) : (
          <TablePagination page={safePage} total={paymentOrders.length} onPageChange={setPage} />
        )}
      </TableShell>
    </div>
  );
}
