"use client";

import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { BarChart3, CalendarDays, ClipboardCheck, CreditCard, PackageCheck, Search, TrendingUp, Users2 } from "lucide-react";
import { WORK_ORDER_STATUS_LABELS } from "@/lib/types";
import { money, monthStartInVietnam, todayInVietnam } from "@/components/ops/format";
import { PendingButton, StatusBadge, TablePagination, ValidatedForm, clampTablePage, getPageItems } from "@/components/ops/ui";
import type { ReportData } from "@/components/ops/types";

const DISPLAY_STATUS_TONE: Record<string, { accent: string; bg: string; text: string }> = {
  doing: { accent: "#0ea5e9", bg: "bg-sky-50", text: "text-sky-900" },
  doing_overdue: { accent: "#f43f5e", bg: "bg-rose-50", text: "text-rose-900" },
  done: { accent: "#10b981", bg: "bg-emerald-50", text: "text-emerald-900" },
  done_overdue: { accent: "#f59e0b", bg: "bg-amber-50", text: "text-amber-900" },
  todo: { accent: "#eab308", bg: "bg-yellow-50", text: "text-yellow-900" },
};

function asNumber(value: string | number | null | undefined) {
  return Number(value ?? 0);
}

function shortDate(value: string) {
  return new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit" }).format(new Date(value));
}

export function ReportsScreen({
  report,
  loading,
  onSubmit,
}: {
  report: ReportData | null;
  loading: boolean;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void | Promise<void>;
}) {
  const today = todayInVietnam();
  const monthStart = monthStartInVietnam();
  const [submitting, setSubmitting] = useState(false);
  const [technicianQuery, setTechnicianQuery] = useState("");
  const [technicianPage, setTechnicianPage] = useState(1);
  const [materialQuery, setMaterialQuery] = useState("");
  const [materialPage, setMaterialPage] = useState(1);

  const dailyChartData = useMemo(
    () => report?.daily.map((item) => ({
      date: shortDate(item.date),
      created: asNumber(item.created_count),
      completed: asNumber(item.completed_count),
      paid: asNumber(item.paid_revenue),
      debt: asNumber(item.open_debt),
    })) ?? [],
    [report?.daily],
  );

  const displayStatusData = useMemo(
    () => report?.byDisplayStatus.map((item) => ({
      ...item,
      countValue: asNumber(item.count),
      percentValue: asNumber(item.percent),
    })) ?? [],
    [report?.byDisplayStatus],
  );

  const filteredTechnicians = report?.byTechnician.filter((item) => {
    const q = technicianQuery.trim().toLowerCase();
    if (!q) return true;
    return [item.technician_name, String(item.order_count), money(item.paid_revenue)]
      .some((value) => value.toLowerCase().includes(q));
  }) ?? [];
  const safeTechnicianPage = clampTablePage(technicianPage, filteredTechnicians.length, 8);
  const visibleTechnicians = getPageItems(filteredTechnicians, safeTechnicianPage, 8);
  const filteredMaterials = report?.materials.filter((item) => {
    const q = materialQuery.trim().toLowerCase();
    if (!q) return true;
    return [item.name, String(item.quantity), money(item.total_amount)]
      .some((value) => value.toLowerCase().includes(q));
  }) ?? [];
  const safeMaterialPage = clampTablePage(materialPage, filteredMaterials.length, 8);
  const visibleMaterials = getPageItems(filteredMaterials, safeMaterialPage, 8);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    setSubmitting(true);
    try {
      await onSubmit(event);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="screen-header">
        <div>
          <h2>Báo cáo hệ thống</h2>
          <p>Tổng hợp công việc, tiến độ, doanh thu, công nợ, kỹ thuật viên và vật tư.</p>
        </div>
      </div>

      <section className="panel flex flex-wrap items-center justify-between gap-4">
        <ValidatedForm onSubmit={submit} aria-busy={submitting} className="table-filter-row">
          <div className="date-range-control">
            <CalendarDays size={14} className="text-zinc-400" />
            <span className="text-[10px] font-bold uppercase text-zinc-400">Từ</span>
            <input
              name="from"
              type="date"
              defaultValue={report?.range.from ?? monthStart}
              disabled={submitting}
            />
            <span className="date-separator text-zinc-200">|</span>
            <span className="text-[10px] font-bold uppercase text-zinc-400">Đến</span>
            <input
              name="to"
              type="date"
              defaultValue={report?.range.to ?? today}
              disabled={submitting}
            />
          </div>
          <PendingButton className="btn-primary h-10" type="submit" pending={submitting} pendingLabel="Đang tải...">
            <BarChart3 size={15} />Xem báo cáo
          </PendingButton>
        </ValidatedForm>
        {report ? (
          <p className="text-sm font-semibold text-zinc-500">
            Kỳ báo cáo: {report.range.from} đến {report.range.to}
          </p>
        ) : null}
      </section>

      {!report ? (
        <section className="panel flex min-h-[280px] flex-col items-center justify-center gap-3 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-zinc-100 text-zinc-500">
            <BarChart3 size={22} />
          </div>
          <div>
            <h3 className="text-base font-black text-zinc-950">{loading ? "Đang tải dữ liệu báo cáo" : "Chưa có dữ liệu báo cáo"}</h3>
            <p className="mt-1 text-sm text-zinc-500">
              {loading ? "Hệ thống đang tổng hợp số liệu trong kỳ hiện tại." : "Chọn khoảng ngày rồi bấm Xem báo cáo để tổng hợp số liệu."}
            </p>
          </div>
        </section>
      ) : null}

      {report ? (
        <>
          <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div className="metric-card">
              <span>Số công việc</span>
              <strong>{report.summary.order_count}</strong>
            </div>
            <div className="metric-card">
              <span>Đã thu</span>
              <strong>{money(report.summary.paid_revenue)}</strong>
            </div>
            <div className="metric-card">
              <span>Công nợ</span>
              <strong>{money(report.summary.open_debt)}</strong>
            </div>
            <div className="metric-card">
              <span>Tổng phát sinh</span>
              <strong>{money(report.summary.gross_amount)}</strong>
            </div>
          </section>

          <section className="grid gap-3 lg:grid-cols-5">
            {displayStatusData.map((item) => {
              const tone = DISPLAY_STATUS_TONE[item.status] ?? DISPLAY_STATUS_TONE.todo;
              return (
                <div key={item.status} className={`rounded-lg border border-zinc-200 p-4 shadow-sm ${tone.bg}`}>
                  <div className="flex items-center justify-between gap-3">
                    <h3 className={`text-base font-black ${tone.text}`}>{item.label}</h3>
                    <span className="h-3 w-3 rounded-full" style={{ backgroundColor: tone.accent }} />
                  </div>
                  <p className="mt-4 text-2xl font-black text-zinc-950">
                    {item.count}/{item.total}
                    <span className="ml-2 text-sm font-semibold text-zinc-500">công việc</span>
                  </p>
                  <p className="mt-1 text-sm font-bold text-zinc-700">{item.percent}% công việc</p>
                </div>
              );
            })}
          </section>

          <section className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.65fr)]">
            <div className="panel min-w-0">
              <div className="panel-heading">
                <div>
                  <h2 className="inline-flex items-center gap-2">
                    <TrendingUp size={16} />Tiến độ theo ngày
                  </h2>
                  <p className="mt-1 text-sm text-zinc-500">Công việc tạo mới và hoàn thành trong kỳ.</p>
                </div>
              </div>
              <div className="h-[320px] min-w-0">
                <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                  <BarChart data={dailyChartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="created" name="Công việc nhận" fill="#0ea5e9" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="completed" name="Hoàn thành" fill="#10b981" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="panel min-w-0">
              <div className="panel-heading">
                <div>
                  <h2 className="inline-flex items-center gap-2">
                    <ClipboardCheck size={16} />Tỷ trọng trạng thái
                  </h2>
                  <p className="mt-1 text-sm text-zinc-500">Phân bổ theo 5 trạng thái trực quan.</p>
                </div>
              </div>
              <div className="h-[320px] min-w-0">
                <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                  <PieChart>
                    <Pie
                      data={displayStatusData}
                      dataKey="countValue"
                      nameKey="label"
                      innerRadius={70}
                      outerRadius={105}
                      paddingAngle={2}
                    >
                      {displayStatusData.map((item) => (
                        <Cell key={item.status} fill={DISPLAY_STATUS_TONE[item.status]?.accent ?? "#71717a"} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </section>

          <section className="panel">
            <div className="panel-heading">
              <div>
                <h2 className="inline-flex items-center gap-2">
                  <CreditCard size={16} />Dòng tiền theo ngày
                </h2>
                <p className="mt-1 text-sm text-zinc-500">Đã thu và công nợ phát sinh trong kỳ.</p>
              </div>
            </div>
            <div className="h-[300px] min-w-0">
              <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                <LineChart data={dailyChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} tickFormatter={(value) => `${Math.round(Number(value) / 1000)}k`} />
                  <Tooltip formatter={(value) => money(Number(value))} />
                  <Legend />
                  <Line type="monotone" dataKey="paid" name="Đã thu" stroke="#10b981" strokeWidth={2.5} dot={false} />
                  <Line type="monotone" dataKey="debt" name="Công nợ" stroke="#ef4444" strokeWidth={2.5} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </section>

          <div className="grid gap-6 lg:grid-cols-2">
            <section className="panel">
              <div className="panel-heading">
                <div>
                  <h2 className="inline-flex items-center gap-2">
                    <Users2 size={16} />Theo kỹ thuật viên
                  </h2>
                  <p className="mt-1 text-sm text-zinc-500">Số việc và doanh thu đã thu theo người phụ trách.</p>
                </div>
              </div>
              <div className="mb-3">
                <div className="relative flex items-center">
                  <Search size={13} className="search-field-icon" />
                  <input
                    value={technicianQuery}
                    onChange={(event) => {
                      setTechnicianQuery(event.target.value);
                      setTechnicianPage(1);
                    }}
                    className="input search-field-input h-9 py-1 text-xs"
                    placeholder="Tìm kỹ thuật viên, doanh thu..."
                  />
                </div>
              </div>
              <div className="grid gap-2">
                {visibleTechnicians.map((item) => (
                  <div key={item.technician_name} className="compact-row">
                    <div>
                      <p className="font-bold text-sm text-zinc-900 leading-snug">{item.technician_name}</p>
                      <p className="text-xs text-zinc-500 mt-1">{item.order_count} công việc</p>
                    </div>
                    <strong className="text-sm text-zinc-900">{money(item.paid_revenue)}</strong>
                  </div>
                ))}
              </div>
              <TablePagination page={safeTechnicianPage} total={filteredTechnicians.length} pageSize={8} onPageChange={setTechnicianPage} />
            </section>

            <section className="panel">
              <div className="panel-heading">
                <div>
                  <h2 className="inline-flex items-center gap-2">
                    <PackageCheck size={16} />Vật tư đã dùng
                  </h2>
                  <p className="mt-1 text-sm text-zinc-500">Tổng số lượng và giá trị vật tư theo kỳ.</p>
                </div>
              </div>
              <div className="mb-3">
                <div className="relative flex items-center">
                  <Search size={13} className="search-field-icon" />
                  <input
                    value={materialQuery}
                    onChange={(event) => {
                      setMaterialQuery(event.target.value);
                      setMaterialPage(1);
                    }}
                    className="input search-field-input h-9 py-1 text-xs"
                    placeholder="Tìm vật tư, số lượng, tổng tiền..."
                  />
                </div>
              </div>
              <div className="grid gap-2">
                {visibleMaterials.map((item) => (
                  <div key={item.name} className="compact-row">
                    <div>
                      <p className="font-bold text-sm text-zinc-900 leading-snug">{item.name}</p>
                      <p className="text-xs text-zinc-500 mt-1">Số lượng: {item.quantity}</p>
                    </div>
                    <strong className="text-sm text-zinc-900">{money(item.total_amount)}</strong>
                  </div>
                ))}
              </div>
              <TablePagination page={safeMaterialPage} total={filteredMaterials.length} pageSize={8} onPageChange={setMaterialPage} />
            </section>
          </div>

          <section className="panel">
            <div className="panel-heading">
              <div>
                <h2>Theo trạng thái nghiệp vụ</h2>
                <p className="mt-1 text-sm text-zinc-500">Dùng để đối soát sâu khi cần xem trạng thái chi tiết.</p>
              </div>
              <span>{report.byStatus.length} nhóm</span>
            </div>
            <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
              {report.byStatus.map((item) => (
                <div key={item.status} className="compact-row">
                  <div className="flex items-center gap-2">
                    <StatusBadge status={item.status} />
                    <span className="text-xs text-zinc-500">{WORK_ORDER_STATUS_LABELS[item.status]}</span>
                  </div>
                  <strong className="text-sm text-zinc-900">{item.count} công việc</strong>
                </div>
              ))}
            </div>
          </section>
        </>
      ) : null}
    </div>
  );
}
