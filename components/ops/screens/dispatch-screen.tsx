"use client";

import { useState } from "react";
import { Clock, Download, Eye, MapPinned, Phone, Search, UserPlus } from "lucide-react";
import { TECHNICIAN_STATUS_LABELS, WORK_ORDER_TYPE_LABELS, type WorkOrderStatus } from "@/lib/types";
import { dateTime, todayInVietnam } from "@/components/ops/format";
import { CustomerSearchSelect } from "@/components/ops/customer-search-select";
import { createExcelSection, exportSectionsToExcel } from "@/components/ops/export-excel";
import { EmptyState, StatusBadge, TablePagination, TableShell, Toolbar, clampTablePage, getPageItems } from "@/components/ops/ui";
import type { Customer, Technician, WorkOrderListItem } from "@/components/ops/types";

const DISPATCH_STATUSES = new Set<WorkOrderStatus>([
  "pending_assignment",
  "assigned",
  "accepted",
  "traveling",
  "working",
  "awaiting_acceptance",
  "paused",
]);

function appointmentDate(order: WorkOrderListItem) {
  return order.appointment_at
    ? new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh" }).format(new Date(order.appointment_at))
    : null;
}

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
  const [dateScope, setDateScope] = useState<"open" | "this_month" | "today" | "all">("open");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
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
    const orderDate = appointmentDate(order);
    const hasCustomDate = Boolean(dateFrom || dateTo);
    const today = todayInVietnam();
    const currentMonth = today.slice(0, 8);
    const matchesDate = hasCustomDate
      ? orderDate !== null && (!dateFrom || orderDate >= dateFrom) && (!dateTo || orderDate <= dateTo)
      : dateScope === "today"
        ? orderDate === today
        : dateScope === "this_month"
          ? orderDate !== null && orderDate.startsWith(currentMonth)
          : true;
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

  function exportDispatch() {
    exportSectionsToExcel({
      title: "Kế hoạch điều phối",
      subtitle: `Số phiếu: ${filteredDispatchOrders.length} - Số kỹ thuật viên: ${filteredTechnicians.length}`,
      filename: "ke-hoach-dieu-phoi",
      sections: [
        createExcelSection({
          title: "Danh sách phiếu điều phối",
          rows: filteredDispatchOrders,
          emptyText: "Không có phiếu điều phối phù hợp.",
          columns: [
            { header: "STT", value: (_order, index) => index + 1, align: "center" },
            { header: "Mã phiếu", value: (order) => order.code },
            { header: "Khách hàng", value: (order) => order.customer_name },
            { header: "Số điện thoại", value: (order) => order.customer_phone },
            { header: "Địa chỉ", value: (order) => order.customer_address },
            { header: "Loại việc", value: (order) => WORK_ORDER_TYPE_LABELS[order.type] },
            { header: "Mức ưu tiên", value: (order) => order.priority === "urgent" ? "Gấp" : "Bình thường" },
            { header: "Mô tả", value: (order) => order.description },
            { header: "Lịch hẹn", value: (order) => dateTime(order.appointment_at) },
            { header: "Kỹ thuật viên", value: (order) => order.technician_name ?? "Chưa phân công" },
            { header: "Thời điểm phân công", value: (order) => order.assigned_at ? dateTime(order.assigned_at) : "" },
          ],
        }),
        createExcelSection({
          title: "Danh sách kỹ thuật viên",
          rows: filteredTechnicians,
          emptyText: "Không có kỹ thuật viên phù hợp.",
          columns: [
            { header: "STT", value: (_technician, index) => index + 1, align: "center" },
            { header: "Kỹ thuật viên", value: (technician) => technician.full_name },
            { header: "Số điện thoại", value: (technician) => technician.phone ?? "" },
            { header: "Email", value: (technician) => technician.email ?? "" },
            { header: "Khu vực", value: (technician) => technician.service_area ?? "" },
            { header: "Trạng thái", value: (technician) => TECHNICIAN_STATUS_LABELS[technician.status] },
            { header: "Việc hôm nay", value: (technician) => technician.jobs_today, align: "right" },
          ],
        }),
      ],
    });
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_390px]">
      <section className="grid gap-4">
        <Toolbar title="Điều phối công việc" subtitle="Theo dõi phiếu chưa gán, phiếu đã gán và tải việc kỹ thuật viên">
          <div className="mt-4 flex justify-end">
            <button className="btn-secondary" onClick={exportDispatch} type="button">
              <Download size={16} />
              Xuất Excel
            </button>
          </div>
        </Toolbar>
        <TableShell>
          <div className="table-toolbar dispatch-toolbar">
            <div className="dispatch-toolbar-row">
              <div className="table-filter-row">
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
              <div className="table-filter-row">
                {[
                  ["open", "Đang mở"],
                  ["this_month", "Tháng này"],
                  ["today", "Hôm nay"],
                  ["all", "Tất cả"],
                ].map(([value, label]) => (
                  <button
                    key={value}
                    className={`tab-button h-8 px-3 text-xs ${dateScope === value && !dateFrom && !dateTo ? "tab-button-active" : ""}`}
                    onClick={() => {
                      setDateScope(value as typeof dateScope);
                      setDateFrom("");
                      setDateTo("");
                      setOrderPage(1);
                    }}
                    type="button"
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <div className="dispatch-toolbar-row">
              <CustomerSearchSelect
                className="dispatch-customer-filter"
                label="Khách"
                value={customerId}
                customers={customers}
                onChange={(nextCustomerId) => {
                  setCustomerId(nextCustomerId);
                  setOrderPage(1);
                }}
              />
              <div className="date-range-control dispatch-date-range">
                <span className="text-[10px] uppercase font-bold text-zinc-400">Từ:</span>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(event) => {
                    setDateFrom(event.target.value);
                    setOrderPage(1);
                  }}
                  aria-label="Từ ngày điều phối"
                />
                <span className="date-separator text-zinc-200">|</span>
                <span className="text-[10px] uppercase font-bold text-zinc-400">Đến:</span>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(event) => {
                    setDateTo(event.target.value);
                    setOrderPage(1);
                  }}
                  aria-label="Đến ngày điều phối"
                />
              </div>
              <button
                className="btn-secondary h-9 text-xs"
                onClick={() => {
                  setDateFrom("");
                  setDateTo("");
                  setCustomerId("");
                  setOrderQuery("");
                  setOrderPage(1);
                }}
                type="button"
              >
                Xóa lọc
              </button>
              <span className="dispatch-count text-xs font-semibold text-zinc-500">{filteredDispatchOrders.length} phiếu</span>
              <div className="table-search dispatch-search">
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
            <div className="table-scroll">
              <table className="data-table dispatch-table">
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
                      <td data-label="Phiếu">
                        <p className="font-semibold text-zinc-900">{order.code}</p>
                        <p className="mt-1 text-xs text-zinc-500">
                          {WORK_ORDER_TYPE_LABELS[order.type]} · {order.priority === "urgent" ? "Gấp" : "Bình thường"}
                        </p>
                      </td>
                      <td data-label="Khách hàng">
                        <p className="font-semibold text-zinc-900">{order.customer_name}</p>
                        <p className="mt-1 line-clamp-2 max-w-[320px] text-xs font-medium text-zinc-700">{order.description}</p>
                        <p className="mt-1 inline-flex items-center gap-1.5 text-xs text-zinc-500">
                          <Phone size={12} />{order.customer_phone}
                        </p>
                        <p className="mt-1 flex max-w-[320px] items-start gap-1.5 text-xs text-zinc-500">
                          <MapPinned size={12} className="mt-0.5 shrink-0" />{order.customer_address}
                        </p>
                      </td>
                      <td data-label="Lịch hẹn">
                        <p className="inline-flex items-center gap-1.5 text-sm text-zinc-700">
                          <Clock size={13} />{dateTime(order.appointment_at)}
                        </p>
                        <p className="mt-1 text-xs text-zinc-500">Tạo: {dateTime(order.created_at)}</p>
                      </td>
                      <td data-label="Kỹ thuật">
                        <p className="font-semibold text-zinc-800">{order.technician_name ?? "Chưa phân công"}</p>
                        {order.assigned_at ? <p className="mt-1 text-xs text-zinc-500">Gán lúc {dateTime(order.assigned_at)}</p> : null}
                      </td>
                      <td data-label="Trạng thái"><StatusBadge status={order.status} /></td>
                      <td data-label="">
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
            </div>
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
              <p className="mt-1 text-sm text-zinc-500">{technician.jobs_today} phiếu hẹn hôm nay</p>
            </div>
          ))}
        </div>
        <TablePagination page={safeTechnicianPage} total={filteredTechnicians.length} pageSize={5} onPageChange={setTechnicianPage} />
      </section>
    </div>
  );
}
