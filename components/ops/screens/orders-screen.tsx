"use client";

import { useState } from "react";
import { Edit, Eye, Plus, XCircle } from "lucide-react";
import { WORK_ORDER_STATUS_LABELS, WORK_ORDER_STATUSES, WORK_ORDER_TYPE_LABELS, WORK_ORDER_TYPES } from "@/lib/types";
import { dateTime, money } from "@/components/ops/format";
import { EmptyState, StatusBadge, TableShell, Toolbar } from "@/components/ops/ui";
import { WorkOrderCreateModal } from "@/components/ops/modals";
import type { Customer, Filters, Technician, WorkOrderListItem } from "@/components/ops/types";

export function OrdersScreen({
  filters,
  customers,
  technicians,
  orders,
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
  canCreate: boolean;
  isCreating: boolean;
  onFilter: (filters: Filters) => void;
  onCreate: (event: React.FormEvent<HTMLFormElement>) => void;
  onView: (id: string) => void;
  onEdit: (id: string) => void;
  onCancel: (item: WorkOrderListItem) => void;
}) {
  const [creating, setCreating] = useState(false);

  return (
    <>
      <Toolbar title="Danh sách phiếu" subtitle="Lọc, xem, sửa và xóa phiếu công việc">
        <div className="mb-3 flex justify-end">
          {canCreate ? (
            <button className="btn-primary h-10" onClick={() => setCreating(true)} type="button">
              <Plus size={16} />Tạo phiếu
            </button>
          ) : null}
        </div>
        <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_180px_180px] xl:grid-cols-[minmax(0,1fr)_160px_160px_200px_150px_150px]">
          <input
            value={filters.q}
            onChange={(event) => onFilter({ ...filters, q: event.target.value })}
            className="input"
            placeholder="Mã phiếu, khách, SĐT, địa chỉ"
          />
          <select value={filters.status} onChange={(event) => onFilter({ ...filters, status: event.target.value })} className="input">
            <option value="">Tất cả trạng thái</option>
            {WORK_ORDER_STATUSES.map((status) => (
              <option key={status} value={status}>{WORK_ORDER_STATUS_LABELS[status]}</option>
            ))}
          </select>
          <select value={filters.type} onChange={(event) => onFilter({ ...filters, type: event.target.value })} className="input">
            <option value="">Tất cả loại việc</option>
            {WORK_ORDER_TYPES.map((type) => (
              <option key={type} value={type}>{WORK_ORDER_TYPE_LABELS[type]}</option>
            ))}
          </select>
          <select value={filters.technicianId} onChange={(event) => onFilter({ ...filters, technicianId: event.target.value })} className="input">
            <option value="">Tất cả kỹ thuật</option>
            {technicians.map((technician) => (
              <option key={technician.id} value={technician.id}>{technician.full_name}</option>
            ))}
          </select>
          <input type="date" value={filters.dateFrom} onChange={(event) => onFilter({ ...filters, dateFrom: event.target.value })} className="input" aria-label="Từ ngày" />
          <input type="date" value={filters.dateTo} onChange={(event) => onFilter({ ...filters, dateTo: event.target.value })} className="input" aria-label="Đến ngày" />
        </div>
      </Toolbar>

      <TableShell>
        {orders.length === 0 ? <EmptyState>Không có phiếu phù hợp bộ lọc.</EmptyState> : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Mã phiếu</th>
                <th>Khách hàng</th>
                <th>Loại việc</th>
                <th>Kỹ thuật</th>
                <th>Trạng thái</th>
                <th>Hẹn/Tạo</th>
                <th className="text-right">Tổng</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => (
                <tr key={order.id}>
                  <td className="font-semibold">{order.code}</td>
                  <td>
                    <p className="font-medium">{order.customer_name}</p>
                    <p className="text-xs text-zinc-500">{order.customer_phone} · {order.customer_address}</p>
                  </td>
                  <td>{WORK_ORDER_TYPE_LABELS[order.type]}</td>
                  <td>{order.technician_name ?? "Chưa phân công"}</td>
                  <td><StatusBadge status={order.status} /></td>
                  <td>{dateTime(order.appointment_at ?? order.created_at)}</td>
                  <td className="text-right font-semibold">{money(order.total_amount)}</td>
                  <td>
                    <div className="action-cell">
                      <button className="icon-button" onClick={() => onView(order.id)} type="button" aria-label="Xem"><Eye size={16} /></button>
                      <button className="icon-button" onClick={() => onEdit(order.id)} type="button" aria-label="Sửa"><Edit size={16} /></button>
                      <button className="icon-button" onClick={() => onCancel(order)} type="button" aria-label="Hủy phiếu"><XCircle size={16} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </TableShell>

      {creating ? (
        <WorkOrderCreateModal
          customers={customers}
          technicians={technicians}
          isSubmitting={isCreating}
          onClose={() => setCreating(false)}
          onSubmit={onCreate}
        />
      ) : null}
    </>
  );
}
