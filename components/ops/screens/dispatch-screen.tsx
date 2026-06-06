"use client";

import { useState } from "react";
import { Eye, Search, UserPlus } from "lucide-react";
import { TECHNICIAN_STATUS_LABELS } from "@/lib/types";
import { EmptyState, StatusBadge, TablePagination, TableShell, Toolbar, clampTablePage, getPageItems } from "@/components/ops/ui";
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
  const [orderQuery, setOrderQuery] = useState("");
  const [orderPage, setOrderPage] = useState(1);
  const [technicianQuery, setTechnicianQuery] = useState("");
  const [technicianStatus, setTechnicianStatus] = useState("");
  const [technicianPage, setTechnicianPage] = useState(1);
  const pending = orders.filter((order) => order.status === "pending_assignment");
  const filteredPending = pending.filter((order) => {
    const q = orderQuery.trim().toLowerCase();
    if (!q) return true;
    return [order.code, order.customer_name, order.customer_phone, order.customer_address, order.description]
      .some((value) => value.toLowerCase().includes(q));
  });
  const safeOrderPage = clampTablePage(orderPage, filteredPending.length);
  const visiblePending = getPageItems(filteredPending, safeOrderPage);
  const filteredTechnicians = technicians.filter((technician) => {
    const q = technicianQuery.trim().toLowerCase();
    const matchesSearch =
      !q ||
      [technician.full_name, technician.phone ?? "", technician.email ?? "", technician.service_area ?? ""]
        .some((value) => value.toLowerCase().includes(q));
    const matchesStatus = !technicianStatus || technician.status === technicianStatus;
    return matchesSearch && matchesStatus;
  });
  const safeTechnicianPage = clampTablePage(technicianPage, filteredTechnicians.length, 5);
  const visibleTechnicians = getPageItems(filteredTechnicians, safeTechnicianPage, 5);

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_390px]">
      <section className="grid gap-4">
        <Toolbar title="Công việc cần phân công" subtitle="Xem bối cảnh công việc hoặc mở modal phân công riêng" />
        <TableShell>
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-zinc-100 bg-zinc-50/20 p-4">
            <span className="text-xs font-semibold text-zinc-500">Tổng số: {filteredPending.length} công việc</span>
            <div className="relative flex items-center !w-72 shrink-0">
              <Search size={13} className="search-field-icon" />
              <input
                value={orderQuery}
                onChange={(event) => {
                  setOrderQuery(event.target.value);
                  setOrderPage(1);
                }}
                className="input search-field-input h-9 !w-full py-1 text-xs"
                placeholder="Tìm mã, khách, SĐT, địa chỉ..."
              />
            </div>
          </div>
          {filteredPending.length === 0 ? <EmptyState>Không còn công việc chờ phân công phù hợp.</EmptyState> : (
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
                {visiblePending.map((order) => (
                  <tr key={order.id}>
                    <td className="font-semibold">{order.code}</td>
                    <td>{order.customer_name}</td>
                    <td>{order.customer_address}</td>
                    <td><StatusBadge order={order} /></td>
                    <td>
                      <div className="action-cell">
                        <button className="icon-button" onClick={() => onView(order.id)} type="button" aria-label="Xem công việc">
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
          <TablePagination page={safeOrderPage} total={filteredPending.length} onPageChange={setOrderPage} />
        </TableShell>
      </section>
      <section className="panel">
        <div className="panel-heading">
          <h2>Kỹ thuật viên</h2>
          <span>{filteredTechnicians.length} người</span>
        </div>
        <div className="mb-3 grid gap-2">
          <select
            value={technicianStatus}
            onChange={(event) => {
              setTechnicianStatus(event.target.value);
              setTechnicianPage(1);
            }}
            className="input h-9 py-1 text-xs"
          >
            <option value="">Tất cả trạng thái</option>
            {Object.entries(TECHNICIAN_STATUS_LABELS).map(([status, label]) => (
              <option key={status} value={status}>{label}</option>
            ))}
          </select>
          <div className="relative flex items-center">
            <Search size={13} className="search-field-icon" />
            <input
              value={technicianQuery}
              onChange={(event) => {
                setTechnicianQuery(event.target.value);
                setTechnicianPage(1);
              }}
              className="input search-field-input h-9 py-1 text-xs"
              placeholder="Tìm kỹ thuật, khu vực..."
            />
          </div>
        </div>
        <div className="grid gap-2">
          {visibleTechnicians.map((technician) => (
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
        <TablePagination page={safeTechnicianPage} total={filteredTechnicians.length} pageSize={5} onPageChange={setTechnicianPage} />
      </section>
    </div>
  );
}
