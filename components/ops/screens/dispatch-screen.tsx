"use client";

import { Eye, UserPlus } from "lucide-react";
import { TECHNICIAN_STATUS_LABELS } from "@/lib/types";
import { EmptyState, StatusBadge, TableShell, Toolbar } from "@/components/ops/ui";
import type { Technician, WorkOrderListItem } from "@/components/ops/types";

export function DispatchScreen({
  orders,
  technicians,
  onView,
  onAssign,
}: {
  orders: WorkOrderListItem[];
  technicians: Technician[];
  onView: (id: string) => void;
  onAssign: (id: string) => void;
}) {
  const pending = orders.filter((order) => order.status === "pending_assignment");

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_390px]">
      <section className="grid gap-4">
        <Toolbar title="Phiếu cần phân công" subtitle="Xem bối cảnh phiếu hoặc mở modal phân công riêng" />
        <TableShell>
          {pending.length === 0 ? <EmptyState>Không còn phiếu chờ phân công.</EmptyState> : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Mã</th>
                  <th>Khách</th>
                  <th>Địa chỉ</th>
                  <th>Trạng thái</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {pending.map((order) => (
                  <tr key={order.id}>
                    <td className="font-semibold">{order.code}</td>
                    <td>{order.customer_name}</td>
                    <td>{order.customer_address}</td>
                    <td><StatusBadge status={order.status} /></td>
                    <td>
                      <div className="action-cell">
                        <button className="icon-button" onClick={() => onView(order.id)} type="button" aria-label="Xem phiếu">
                          <Eye size={16} />
                        </button>
                        <button className="icon-button" onClick={() => onAssign(order.id)} type="button" aria-label="Phân công">
                          <UserPlus size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </TableShell>
      </section>
      <section className="panel">
        <div className="panel-heading">
          <h2>Kỹ thuật viên</h2>
          <span>{technicians.length} người</span>
        </div>
        <div className="grid gap-2">
          {technicians.map((technician) => (
            <div key={technician.id} className="rounded-md border border-zinc-200 p-3">
              <div className="flex items-center justify-between gap-3">
                <p className="font-semibold">{technician.full_name}</p>
                <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-semibold">
                  {TECHNICIAN_STATUS_LABELS[technician.status]}
                </span>
              </div>
              <p className="mt-2 text-sm text-zinc-500">{technician.service_area ?? "Chưa gán khu vực"}</p>
              <p className="mt-1 text-sm text-zinc-500">{technician.jobs_today} việc hôm nay</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
