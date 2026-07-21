"use client";

import { useEffect, useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { BarChart3, CalendarDays, Edit, Eye, Search, Trash2 } from "lucide-react";
import { apiFetch } from "@/components/ops/api";
import { monthStartInVietnam, money, todayInVietnam } from "@/components/ops/format";
import { EmptyState, Modal, StatusBadge, TablePagination, TableShell, Toolbar, clampTablePage, getPageItems } from "@/components/ops/ui";
import { TECHNICIAN_STATUS_LABELS, type WorkOrderStatus } from "@/lib/types";
import type { Technician } from "@/components/ops/types";

type TechnicianPerformance = Technician & {
  order_count: string;
  completed_count: string;
  doing_count: string;
  paused_count: string;
  paid_revenue: string;
  labor_amount: string;
  material_amount: string;
  recorded_minutes: string;
  estimated_minutes: string;
};

type TechnicianWorkOrder = {
  work_order_id: string;
  code: string;
  customer_name: string;
  status: WorkOrderStatus;
  recorded_minutes: string;
  estimated_minutes: string;
};

type PerformanceResponse = {
  technicians: TechnicianPerformance[];
  workOrders: TechnicianWorkOrder[];
};

function duration(minutes: string | number) {
  const total = Math.max(0, Math.round(Number(minutes) || 0));
  return `${Math.floor(total / 60)} giờ ${total % 60} phút`;
}

function totalMinutes(item: Pick<TechnicianPerformance, "recorded_minutes" | "estimated_minutes">) {
  return Number(item.recorded_minutes) + Number(item.estimated_minutes);
}

export function TechniciansScreen({
  onEdit,
  onDelete,
}: {
  onEdit: (item: Technician) => void;
  onDelete: (item: Technician) => void;
}) {
  const today = todayInVietnam();
  const monthStart = monthStartInVietnam();
  const [from, setFrom] = useState(monthStart);
  const [to, setTo] = useState(today);
  const [performance, setPerformance] = useState<TechnicianPerformance[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<TechnicianPerformance | null>(null);
  const [details, setDetails] = useState<TechnicianWorkOrder[]>([]);
  const [detailsLoading, setDetailsLoading] = useState(false);

  async function loadPerformance(nextFrom = from, nextTo = to) {
    setLoading(true);
    setError(null);
    try {
      const payload = await apiFetch<PerformanceResponse>(`/api/technician-performance?from=${nextFrom}&to=${nextTo}`);
      setPerformance(payload.technicians);
      setPage(1);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Không tải được hiệu suất kỹ thuật viên");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void loadPerformance(monthStart, today); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const filtered = performance.filter((item) => {
    const q = searchQuery.trim().toLowerCase();
    return (!q || [item.full_name, item.phone ?? "", item.email ?? "", item.service_area ?? ""].some((value) => value.toLowerCase().includes(q)))
      && (!statusFilter || item.status === statusFilter);
  });
  const safePage = clampTablePage(page, filtered.length);
  const visible = getPageItems(filtered, safePage);
  const chartData = useMemo(() => performance.slice(0, 8).map((item) => ({ name: item.full_name, hoàn_thành: Number(item.completed_count), giờ: Math.round(totalMinutes(item) / 60 * 10) / 10 })), [performance]);
  const totals = useMemo(() => performance.reduce((result, item) => ({ completed: result.completed + Number(item.completed_count), doing: result.doing + Number(item.doing_count), minutes: result.minutes + totalMinutes(item) }), { completed: 0, doing: 0, minutes: 0 }), [performance]);

  async function openDetails(item: TechnicianPerformance) {
    setSelected(item);
    setDetails([]);
    setDetailsLoading(true);
    try {
      const payload = await apiFetch<PerformanceResponse>(`/api/technician-performance?from=${from}&to=${to}&technicianId=${item.id}`);
      setDetails(payload.workOrders);
    } finally {
      setDetailsLoading(false);
    }
  }

  return (
    <>
      <Toolbar title="Kỹ thuật viên" subtitle="Theo dõi hiệu suất, doanh thu và thời gian tác nghiệp tại công trình">
        <form className="mt-4 flex flex-wrap justify-end gap-2" onSubmit={(event) => { event.preventDefault(); void loadPerformance(); }}>
          <div className="date-range-control">
            <CalendarDays size={14} className="text-zinc-400" />
            <input aria-label="Từ ngày" type="date" value={from} max={to} onChange={(event) => setFrom(event.target.value)} />
            <span className="date-separator">|</span>
            <input aria-label="Đến ngày" type="date" value={to} min={from} max={today} onChange={(event) => setTo(event.target.value)} />
          </div>
          <button className="btn-primary h-10" type="submit" disabled={loading}><BarChart3 size={15} />Xem hiệu suất</button>
        </form>
      </Toolbar>

      <section className="grid gap-3 sm:grid-cols-3">
        {[{ label: "Hoàn thành", value: totals.completed }, { label: "Đang làm", value: totals.doing }, { label: "Tổng giờ công trình", value: duration(totals.minutes) }].map((item) => (
          <div key={item.label} className="panel p-4"><p className="text-sm text-zinc-500">{item.label}</p><strong className="mt-2 block text-2xl text-zinc-950">{item.value}</strong></div>
        ))}
      </section>

      <section className="panel mt-6">
        <div className="panel-heading"><div><h2>Hiệu suất nổi bật</h2><p className="mt-1 text-sm text-zinc-500">So sánh số việc hoàn thành và tổng giờ tác nghiệp.</p></div></div>
        <div className="h-[280px] min-w-0"><ResponsiveContainer width="100%" height="100%"><BarChart data={chartData}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} /><YAxis yAxisId="jobs" allowDecimals={false} /><YAxis yAxisId="hours" orientation="right" /><Tooltip /><Legend /><Bar yAxisId="jobs" dataKey="hoàn_thành" name="Hoàn thành" fill="#10b981" radius={[4, 4, 0, 0]} /><Bar yAxisId="hours" dataKey="giờ" name="Giờ công trình" fill="#2563eb" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer></div>
      </section>

      <TableShell>
        <div className="table-toolbar">
          <span className="text-xs font-semibold text-zinc-500">Kỳ: {from} đến {to} · {filtered.length} kỹ thuật viên</span>
          <div className="table-filter-row">
            <select value={statusFilter} onChange={(event) => { setStatusFilter(event.target.value); setPage(1); }} className="input h-9 bg-white py-1 text-xs"><option value="">Tất cả trạng thái</option>{Object.entries(TECHNICIAN_STATUS_LABELS).map(([status, label]) => <option key={status} value={status}>{label}</option>)}</select>
            <div className="table-search"><Search size={13} className="search-field-icon" /><input value={searchQuery} onChange={(event) => { setSearchQuery(event.target.value); setPage(1); }} className="input search-field-input h-9 !w-full py-1 text-xs" placeholder="Tìm tên, liên hệ, khu vực..." /></div>
          </div>
        </div>
        {error ? <EmptyState>{error}</EmptyState> : loading ? <EmptyState>Đang tổng hợp hiệu suất...</EmptyState> : filtered.length === 0 ? <EmptyState>Không có kỹ thuật viên phù hợp.</EmptyState> : <table className="data-table min-w-[1120px]"><thead><tr><th>Kỹ thuật viên</th><th>Trạng thái</th><th>Tổng việc</th><th>Hoàn thành</th><th>Đang làm</th><th>Tạm dừng</th><th>Nhân công</th><th>Vật tư</th><th>Thời gian công trình</th><th /></tr></thead><tbody>{visible.map((item) => <tr key={item.id}><td data-label="Kỹ thuật viên" className="font-semibold">{item.full_name}<p className="mt-1 text-xs font-normal text-zinc-500">{item.service_area ?? "Chưa có khu vực"}</p></td><td data-label="Trạng thái">{TECHNICIAN_STATUS_LABELS[item.status]}</td><td data-label="Tổng việc">{item.order_count}</td><td data-label="Hoàn thành">{item.completed_count}</td><td data-label="Đang làm">{item.doing_count}</td><td data-label="Tạm dừng">{item.paused_count}</td><td data-label="Nhân công">{money(item.labor_amount)}</td><td data-label="Vật tư">{money(item.material_amount)}</td><td data-label="Thời gian công trình">{duration(totalMinutes(item))}</td><td data-label=""><div className="action-cell"><button className="icon-button" onClick={() => void openDetails(item)} type="button" aria-label="Xem chi tiết"><Eye size={16} /></button><button className="icon-button" onClick={() => onEdit(item)} type="button" aria-label="Sửa"><Edit size={16} /></button><button className="icon-button" onClick={() => onDelete(item)} type="button" aria-label="Xóa"><Trash2 size={16} /></button></div></td></tr>)}</tbody></table>}
        <TablePagination page={safePage} total={filtered.length} onPageChange={setPage} />
      </TableShell>

      {selected ? <Modal title={`Hiệu suất ${selected.full_name}`} size="xl" onClose={() => setSelected(null)}><section className="grid gap-3 sm:grid-cols-4"><div><p className="text-xs text-zinc-500">Hoàn thành</p><strong>{selected.completed_count}</strong></div><div><p className="text-xs text-zinc-500">Nhân công</p><strong>{money(selected.labor_amount)}</strong></div><div><p className="text-xs text-zinc-500">Vật tư</p><strong>{money(selected.material_amount)}</strong></div><div><p className="text-xs text-zinc-500">Thời gian</p><strong>{duration(totalMinutes(selected))}</strong></div></section><p className="mt-4 text-xs text-zinc-500">Thời gian có nhãn “ước tính” được suy ra từ check-in đến lần hoàn tất/tạm dừng đầu tiên của phiếu cũ.</p><div className="mt-4 overflow-x-auto"><table className="data-table min-w-[700px]"><thead><tr><th>Phiếu</th><th>Khách hàng</th><th>Trạng thái</th><th>Thời gian</th><th>Nguồn</th></tr></thead><tbody>{detailsLoading ? <tr><td colSpan={5}>Đang tải chi tiết...</td></tr> : details.map((order) => <tr key={order.work_order_id}><td>{order.code}</td><td>{order.customer_name}</td><td><StatusBadge status={order.status} /></td><td>{duration(Number(order.recorded_minutes) + Number(order.estimated_minutes))}</td><td>{Number(order.recorded_minutes) > 0 ? "Phiên tác nghiệp" : "Ước tính từ check-in"}</td></tr>)}</tbody></table></div></Modal> : null}
    </>
  );
}
