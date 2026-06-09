"use client";

import { useState } from "react";
import { Clock, Eye, MapPinned, Phone, Search, UserPlus } from "lucide-react";
import { TECHNICIAN_STATUS_LABELS, WORK_ORDER_TYPE_LABELS, type WorkOrderStatus } from "@/lib/types";
import { dateTime, todayInVietnam } from "@/components/ops/format";
import { EmptyState, StatusBadge, TablePagination, TableShell, Toolbar, clampTablePage, getPageItems } from "@/components/ops/ui";
import type { Customer, Technician, WorkOrderListItem } from "@/components/ops/types";

const DISPATCH_STATUSES = new Set<WorkOrderStatus>([
  "pending_assignment",
  "assigned",
  "accepted",
  "traveling",
  "working",
  "awaiting_acceptance",
]);

export function DispatchScreen({
  orders,
  customers,
  technicians,
  onView,
  onAssign,
}: {
  orders: WorkOrderListItem[];
  customers: Customer[];
  technicians: Technician[];
  onView: (id: string) => void;
  onAssign: (id: string) => void;
}) {
  const [orderQuery, setOrderQuery] = useState("");
  const [orderScope, setOrderScope] = useState<"active" | "unassigned" | "assigned">("active");
  const [dateFrom, setDateFrom] = useState(todayInVietnam);
  const [dateTo, setDateTo] = useState(todayInVietnam);
  const [customerId, setCustomerId] = useState("");
  const [orderPage, setOrderPage] = useState(1);
  const [technicianQuery, setTechnicianQuery] = useState("");
  const [technicianStatus, setTechnicianStatus] = useState("");
  const [technicianPage, setTechnicianPage] = useState(1);
  const dispatchOrders = orders.filter((order) => DISPATCH_STATUSES.has(order.status));
  const unassignedCount = dispatchOrders.filter((order) => order.status === "pending_assignment").length;
  const assignedCount = dispatchOrders.length - unassignedCount;
  const scopedOrders = dispatchOrders.filter((order) => {
    if (orderScope === "unassigned") return order.status === "pending_assignment";
    if (orderScope === "assigned") return order.status !== "pending_assignment";
    return true;
  });
  const filteredDispatchOrders = scopedOrders.filter((order) => {
    const q = orderQuery.trim().toLowerCase();
    const orderDate = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh" }).format(new Date(order.appointment_at ?? order.created_at));
    const matchesDate = (!dateFrom || orderDate >= dateFrom) && (!dateTo || orderDate <= dateTo);
    const matchesCustomer = !customerId || order.customer_id === customerId;
    const matchesSearch = !q || [order.code, order.customer_name, order.customer_phone, order.customer_address, order.description, order.technician_name ?? ""]
      .some((value) => value.toLowerCase().includes(q));
    return matchesDate && matchesCustomer && matchesSearch;
  });
  const safeOrderPage = clampTablePage(orderPage, filteredDispatchOrders.length);
  const visibleDispatchOrders = getPageItems(filteredDispatchOrders, safeOrderPage);
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
        <Toolbar title="Điều phối công việc" subtitle="Theo dõi phiếu chưa gán, phiếu đã gán và tải việc kỹ thuật viên" />
        <TableShell>
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-zinc-100 bg-zinc-50/20 p-4">
            <div className="flex flex-wrap items-center gap-2">
              <button
                className={`btn-secondary h-9 text-xs ${orderScope === "active" ? "bg-zinc-900 text-white hover:bg-zinc-800" : ""}`}
                onClick={() => {
                  setOrderScope("active");
                  setOrderPage(1);
                }}
                type="button"
              >
                Tất cả {dispatchOrders.length}
              </button>
              <button
                className={`btn-secondary h-9 text-xs ${orderScope === "unassigned" ? "bg-zinc-900 text-white hover:bg-zinc-800" : ""}`}
                onClick={() => {
                  setOrderScope("unassigned");
                  setOrderPage(1);
                }}
                type="button"
              >
                Chưa phân công {unassignedCount}
              </button>
              <button
                className={`btn-secondary h-9 text-xs ${orderScope === "assigned" ? "bg-zinc-900 text-white hover:bg-zinc-800" : ""}`}
                onClick={() => {
                  setOrderScope("assigned");
                  setOrderPage(1);
                }}
                type="button"
              >
                Đang điều phối {assignedCount}
              </button>
            </div>
            <div className="grid w-full gap-2 md:grid-cols-[140px_140px_minmax(180px,260px)_auto_auto]">
              <input
                className="input h-9 py-1 text-xs"
                type="date"
                value={dateFrom}
                onChange={(event) => {
                  setDateFrom(event.target.value);
                  setOrderPage(1);
                }}
                aria-label="Từ ngày điều phối"
              />
              <input
                className="input h-9 py-1 text-xs"
                type="date"
                value={dateTo}
                onChange={(event) => {
                  setDateTo(event.target.value);
                  setOrderPage(1);
                }}
                aria-label="Đến ngày điều phối"
              />
              <select
                className="input h-9 py-1 text-xs"
                value={customerId}
                onChange={(event) => {
                  setCustomerId(event.target.value);
                  setOrderPage(1);
                }}
              >
                <option value="">Tất cả khách hàng</option>
                {customers.map((customer) => (
                  <option key={customer.id} value={customer.id}>{customer.name} · {customer.phone}</option>
                ))}
              </select>
              <button
                className="btn-secondary h-9 text-xs"
                onClick={() => {
                  const today = todayInVietnam();
                  setDateFrom(today);
                  setDateTo(today);
                  setCustomerId("");
                  setOrderQuery("");
                  setOrderPage(1);
                }}
                type="button"
              >
                Hôm nay
              </button>
              <button
                className="btn-secondary h-9 text-xs"
                onClick={() => {
                  setDateFrom("");
                  setDateTo("");
                  setOrderPage(1);
                }}
                type="button"
              >
                Tất cả ngày
              </button>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-xs font-semibold text-zinc-500">Đang hiển thị: {filteredDispatchOrders.length} phiếu</span>
              <div className="relative flex items-center !w-72 shrink-0">
                <Search size={13} className="search-field-icon" />
                <input
                  value={orderQuery}
                  onChange={(event) => {
                    setOrderQuery(event.target.value);
                    setOrderPage(1);
                  }}
                  className="input search-field-input h-9 !w-full py-1 text-xs"
                  placeholder="Tìm mã, khách, SĐT, địa chỉ, kỹ thuật..."
                />
              </div>
            </div>
          </div>
          {filteredDispatchOrders.length === 0 ? (
            <div className="p-4">
              <EmptyState>Không có phiếu điều phối phù hợp.</EmptyState>
            </div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Phiếu</th>
                  <th>Khách hàng</th>
                  <th>Lịch hẹn</th>
                  <th>Kỹ thuật viên</th>
                  <th>Trạng thái</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {visibleDispatchOrders.map((order) => (
                  <tr key={order.id}>
                    <td>
                      <p className="font-semibold text-zinc-900">{order.code}</p>
                      <p className="mt-1 text-xs text-zinc-500">
                        {WORK_ORDER_TYPE_LABELS[order.type]} · {order.priority === "urgent" ? "Gấp" : "Bình thường"}
                      </p>
                    </td>
                    <td>
                      <p className="font-semibold text-zinc-900">{order.customer_name}</p>
                      <p className="mt-1 inline-flex items-center gap-1.5 text-xs text-zinc-500">
                        <Phone size={12} />{order.customer_phone}
                      </p>
                      <p className="mt-1 flex max-w-[320px] items-start gap-1.5 text-xs text-zinc-500">
                        <MapPinned size={12} className="mt-0.5 shrink-0" />{order.customer_address}
                      </p>
                    </td>
                    <td>
                      <p className="inline-flex items-center gap-1.5 text-sm text-zinc-700">
                        <Clock size={13} />{dateTime(order.appointment_at ?? order.created_at)}
                      </p>
                    </td>
                    <td>
                      <p className="font-semibold text-zinc-800">{order.technician_name ?? "Chưa phân công"}</p>
                      {order.assigned_at ? <p className="mt-1 text-xs text-zinc-500">Gán lúc {dateTime(order.assigned_at)}</p> : null}
                    </td>
                    <td><StatusBadge status={order.status} /></td>
                    <td>
                      <div className="action-cell">
                        <button className="icon-button" onClick={() => onView(order.id)} type="button" aria-label="Xem công việc">
                          <Eye size={16} />
                        </button>
                        <button className="icon-button" onClick={() => onAssign(order.id)} type="button" aria-label={order.technician_id ? "Đổi phân công" : "Phân công"}>
                          <UserPlus size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <TablePagination page={safeOrderPage} total={filteredDispatchOrders.length} onPageChange={setOrderPage} />
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
          {visibleTechnicians.length === 0 ? <EmptyState>Không có kỹ thuật viên phù hợp.</EmptyState> : null}
          {visibleTechnicians.map((technician) => (
            <div key={technician.id} className="rounded-md border border-zinc-200 p-3">
              <div className="flex items-center justify-between gap-3">
                <p className="font-semibold">{technician.full_name}</p>
                <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-semibold">
                  {TECHNICIAN_STATUS_LABELS[technician.status]}
                </span>
              </div>
              <p className="mt-2 text-sm text-zinc-500">{technician.service_area ?? "Chưa gán khu vực"}</p>
              <p className="mt-1 text-sm text-zinc-500">{technician.jobs_today} phiếu hôm nay</p>
            </div>
          ))}
        </div>
        <TablePagination page={safeTechnicianPage} total={filteredTechnicians.length} pageSize={5} onPageChange={setTechnicianPage} />
      </section>
    </div>
  );
}
