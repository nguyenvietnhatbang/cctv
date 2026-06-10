"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { Edit, Eye, Plus, XCircle, Search } from "lucide-react";
import {
  DISPLAY_STATUS_LABELS,
  DISPLAY_STATUS_TONE,
  getAllowedWorkOrderTransitions,
  getDisplayStatus,
  PAYMENT_STATUSES,
  WORK_ORDER_STATUS_LABELS,
  WORK_ORDER_STATUSES,
  WORK_ORDER_TYPE_LABELS,
  WORK_ORDER_TYPES,
  type DisplayStatus,
} from "@/lib/types";
import { dateTime, money } from "@/components/ops/format";
import { DeadlineBadge, EmptyState, StatusBadge, TablePagination, TableShell, clampTablePage, getPageItems } from "@/components/ops/ui";
import type { Customer, Filters, Role, Technician, WorkOrderListItem } from "@/components/ops/types";

const PAYMENT_STATUS_LABELS: Record<string, string> = {
  unpaid: "Chưa thu",
  paid: "Đã thu",
  debt: "Công nợ",
};

type WorkOrderCreateModalProps = {
  customers: Customer[];
  technicians: Technician[];
  isSubmitting: boolean;
  onClose: () => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void | Promise<void>;
};

const WorkOrderCreateModal = dynamic<WorkOrderCreateModalProps>(
  () => import("@/components/ops/modals/work-order-create-modal").then((mod) => mod.WorkOrderCreateModal),
  {
    loading: () => (
      <div className="fixed inset-0 z-50 grid place-items-center bg-zinc-950/45 p-3">
        <div className="rounded-lg border border-zinc-200 bg-white px-5 py-4 text-sm font-semibold text-zinc-600 shadow-xl">
          Đang tải form tạo phiếu...
        </div>
      </div>
    ),
  },
);

export function OrdersScreen({
  filters,
  customers,
  technicians,
  orders,
  role,
  canCreate,
  isCreating,
  onFilter,
  onCreate,
  onView,
  onEdit,
  onCancel,
}: {
  filters: Filters;
  customers: Customer[];
  technicians: Technician[];
  orders: WorkOrderListItem[];
  role: Role;
  canCreate: boolean;
  isCreating: boolean;
  onFilter: (filters: Filters) => void;
  onCreate: (event: React.FormEvent<HTMLFormElement>) => void;
  onView: (id: string) => void;
  onEdit: (id: string) => void;
  onCancel: (item: WorkOrderListItem) => void;
}) {
  const [creating, setCreating] = useState(false);
  const [page, setPage] = useState(1);
  const [queryDraft, setQueryDraft] = useState(filters.q);
  const statusSummary = useMemo(
    () => orders.reduce<Record<DisplayStatus, number>>(
      (summary, order) => {
        const status = getDisplayStatus(order);
        summary[status] += 1;
        return summary;
      },
      {
        todo: 0,
        doing: 0,
        doing_overdue: 0,
        done: 0,
        done_overdue: 0,
        cancelled: 0,
      },
    ),
    [orders],
  );
  const paymentSummary = useMemo(
    () => orders.reduce<Record<string, number>>(
      (summary, order) => {
        const status = order.payment_status ?? "unpaid";
        summary[status] = (summary[status] ?? 0) + 1;
        return summary;
      },
      {},
    ),
    [orders],
  );
  const safePage = clampTablePage(page, orders.length);
  const visibleOrders = useMemo(() => getPageItems(orders, safePage), [orders, safePage]);

  function applyFilter(nextFilters: Filters) {
    setPage(1);
    onFilter(nextFilters);
  }

  useEffect(() => {
    setQueryDraft(filters.q);
  }, [filters.q]);

  useEffect(() => {
    if (queryDraft === filters.q) return;
    const timeout = window.setTimeout(() => {
      applyFilter({ ...filters, q: queryDraft });
    }, 320);
    return () => window.clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryDraft, filters]);

  return (
    <div className="flex flex-col gap-6">
      {/* Screen Title & Action Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-extrabold text-zinc-900 tracking-tight">Công việc</h2>
          <p className="text-xs text-zinc-500 mt-1">Lập kế hoạch, theo dõi tiến độ thi công và xử lý sự cố kỹ thuật</p>
        </div>
        {canCreate ? (
          <button className="btn-primary" onClick={() => setCreating(true)} type="button">
            <Plus size={16} />
            Tạo công việc
          </button>
        ) : null}
      </div>

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
        {(Object.entries(DISPLAY_STATUS_LABELS) as Array<[DisplayStatus, string]>).map(([status, label]) => (
          status === "cancelled" ? null : (
          <button
            key={status}
            className={`rounded-md border border-zinc-200 bg-white p-3 text-left shadow-sm transition hover:border-zinc-300 ${filters.status === status ? "ring-2 ring-zinc-900" : ""}`}
            onClick={() => applyFilter({ ...filters, status: filters.status === status ? "" : status })}
            type="button"
          >
            <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ${DISPLAY_STATUS_TONE[status]}`}>
              {label}
            </span>
            <p className="mt-2 text-2xl font-bold text-zinc-950">{statusSummary[status]}</p>
          </button>
          )
        ))}
      </div>

      {/* Orders Table Shell with Compact Filter Header */}
      <TableShell>
        <div className="flex flex-wrap items-center justify-between gap-3 p-4 border-b border-zinc-200 bg-zinc-50/20">
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={filters.status}
              onChange={(event) => applyFilter({ ...filters, status: event.target.value })}
              className="input !w-[160px] bg-white h-9 py-1 text-xs shrink-0"
            >
              <option value="">Trạng thái: Tất cả</option>
              <optgroup label="Nhóm vận hành">
                {Object.entries(DISPLAY_STATUS_LABELS).map(([status, label]) => (
                  status === "cancelled" ? null : (
                  <option key={status} value={status}>
                    {label}
                  </option>
                  )
                ))}
              </optgroup>
              <optgroup label="Trạng thái nghiệp vụ">
                {WORK_ORDER_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {WORK_ORDER_STATUS_LABELS[status]}
                  </option>
                ))}
              </optgroup>
            </select>
            <select
              value={filters.type}
              onChange={(event) => applyFilter({ ...filters, type: event.target.value })}
              className="input !w-[135px] bg-white h-9 py-1 text-xs shrink-0"
            >
              <option value="">Loại việc: Tất cả</option>
              {WORK_ORDER_TYPES.map((type) => (
                <option key={type} value={type}>
                  {WORK_ORDER_TYPE_LABELS[type]}
                </option>
              ))}
            </select>
            <select
              value={filters.technicianId}
              onChange={(event) => applyFilter({ ...filters, technicianId: event.target.value })}
              className="input !w-[150px] bg-white h-9 py-1 text-xs shrink-0"
            >
              <option value="">Kỹ thuật: Tất cả</option>
              {technicians.map((technician) => (
                <option key={technician.id} value={technician.id}>
                  {technician.full_name}
                </option>
              ))}
            </select>

            {/* Combined Date Range Box */}
            <div className="flex items-center gap-1.5 text-xs text-zinc-500 bg-white border border-zinc-200 rounded-md px-2.5 h-9 shrink-0">
              <span className="text-[10px] uppercase font-bold text-zinc-400">Từ:</span>
              <input
                type="date"
                value={filters.dateFrom}
                onChange={(event) => applyFilter({ ...filters, dateFrom: event.target.value })}
                className="border-none bg-transparent outline-none p-0 text-xs w-[110px]"
                aria-label="Từ ngày"
              />
              <span className="text-zinc-200">|</span>
              <span className="text-[10px] uppercase font-bold text-zinc-400">Đến:</span>
              <input
                type="date"
                value={filters.dateTo}
                onChange={(event) => applyFilter({ ...filters, dateTo: event.target.value })}
                className="border-none bg-transparent outline-none p-0 text-xs w-[110px]"
                aria-label="Đến ngày"
              />
            </div>
          </div>

          <div className="relative flex items-center !w-60 shrink-0">
            <Search size={13} className="search-field-icon" />
            <input
              value={queryDraft}
              onChange={(event) => setQueryDraft(event.target.value)}
              className="input search-field-input h-9 !w-full py-1 text-xs"
              placeholder="Tìm kiếm công việc..."
            />
          </div>
        </div>

        {orders.length === 0 ? (
          <EmptyState>Không có công việc phù hợp bộ lọc.</EmptyState>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th className="w-[120px]">Mã công việc</th>
                <th>Khách hàng</th>
                <th>Loại việc</th>
                <th>Kỹ thuật</th>
                <th>Trạng thái</th>
                <th>Thanh toán</th>
                <th>Hẹn/Tạo</th>
                <th className="text-right">Tổng</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {visibleOrders.map((order) => (
                <tr key={order.id}>
                  <td className="font-semibold">{order.code}</td>
                  <td>
                    <p className="font-semibold text-zinc-900 leading-tight">{order.customer_name}</p>
                    <p className="text-xs text-zinc-500 mt-1 truncate max-w-xs">
                      {order.customer_phone} · {order.customer_address}
                    </p>
                  </td>
                  <td>
                    <span className="inline-flex px-2 py-0.5 rounded bg-zinc-100 text-zinc-800 text-xs font-semibold">
                      {WORK_ORDER_TYPE_LABELS[order.type]}
                    </span>
                  </td>
                  <td className="text-sm text-zinc-700">{order.technician_name ?? "Chưa phân công"}</td>
                  <td>
                    <div className="flex flex-wrap gap-1.5">
                      <StatusBadge order={order} />
                      <DeadlineBadge order={order} />
                    </div>
                  </td>
                  <td>
                    <span className="inline-flex rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-semibold text-zinc-700 ring-1 ring-zinc-200">
                      {PAYMENT_STATUS_LABELS[order.payment_status ?? "unpaid"] ?? order.payment_status ?? "Chưa thu"}
                    </span>
                  </td>
                  <td className="text-xs text-zinc-500">{dateTime(order.appointment_at ?? order.created_at)}</td>
                  <td className="text-right font-bold text-zinc-900">{money(order.total_amount)}</td>
                  <td>
                    <div className="action-cell">
                      <button
                        className="icon-button"
                        onClick={() => onView(order.id)}
                        type="button"
                        aria-label="Xem"
                      >
                        <Eye size={15} />
                      </button>
                      {["admin", "dispatcher"].includes(role) ? (
                        <button
                          className="icon-button"
                          onClick={() => onEdit(order.id)}
                          type="button"
                          aria-label="Sửa"
                        >
                          <Edit size={15} />
                        </button>
                      ) : null}
                      {getAllowedWorkOrderTransitions(order.status, role).some((transition) => transition.status === "cancelled") ? (
                        <button
                          className="icon-button hover:text-red-600 hover:border-red-200"
                          onClick={() => onCancel(order)}
                          type="button"
                          aria-label="Hủy công việc"
                        >
                          <XCircle size={15} />
                        </button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <TablePagination page={safePage} total={orders.length} onPageChange={setPage} />
      </TableShell>

      <div className="grid gap-2 sm:grid-cols-3">
        {PAYMENT_STATUSES.map((status) => (
          <div key={status} className="rounded-md border border-zinc-200 bg-white p-3 shadow-sm">
            <p className="text-xs font-bold uppercase text-zinc-500">{PAYMENT_STATUS_LABELS[status]}</p>
            <p className="mt-1 text-2xl font-black text-zinc-950">{paymentSummary[status] ?? 0}</p>
          </div>
        ))}
      </div>

      {creating ? (
        <WorkOrderCreateModal
          customers={customers}
          technicians={technicians}
          isSubmitting={isCreating}
          onClose={() => setCreating(false)}
          onSubmit={onCreate}
        />
      ) : null}
    </div>
  );
}
