"use client";

import { useState } from "react";
import { BarChart3, TrendingUp, Users2, PackageCheck } from "lucide-react";
import { WORK_ORDER_STATUS_LABELS } from "@/lib/types";
import { money, todayInVietnam } from "@/components/ops/format";
import { PendingButton, StatusBadge, ValidatedForm } from "@/components/ops/ui";
import type { ReportData } from "@/components/ops/types";

export function ReportsScreen({
  report,
  onSubmit,
}: {
  report: ReportData | null;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void | Promise<void>;
}) {
  const today = todayInVietnam();
  const [submitting, setSubmitting] = useState(false);

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
      {/* Screen Title & Description */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-extrabold text-zinc-900 tracking-tight">Báo cáo doanh thu</h2>
          <p className="text-xs text-zinc-500 mt-1">Truy xuất doanh thu đã thu, công nợ và thống kê vật tư sử dụng</p>
        </div>
      </div>

      {/* Compact Date Range Filter Card */}
      <div className="panel bg-white border border-zinc-200 rounded-lg p-4 shadow-sm flex flex-wrap items-center justify-between gap-4">
        <ValidatedForm onSubmit={submit} aria-busy={submitting} className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs text-zinc-500 bg-white border border-zinc-200 rounded-md px-2.5 h-9 shrink-0">
            <span className="text-[10px] uppercase font-bold text-zinc-400">Từ:</span>
            <input
              name="from"
              type="date"
              className="border-none bg-transparent outline-none p-0 text-xs w-[120px]"
              defaultValue={report?.range.from ?? today}
              disabled={submitting}
            />
            <span className="text-zinc-255">|</span>
            <span className="text-[10px] uppercase font-bold text-zinc-400">Đến:</span>
            <input
              name="to"
              type="date"
              className="border-none bg-transparent outline-none p-0 text-xs w-[120px]"
              defaultValue={report?.range.to ?? today}
              disabled={submitting}
            />
          </div>
          <PendingButton
            className="btn-primary h-9 text-xs px-3"
            type="submit"
            pending={submitting}
            pendingLabel="Đang tải..."
          >
            <BarChart3 size={13} />
            Xem báo cáo
          </PendingButton>
        </ValidatedForm>
      </div>

      {report ? (
        <>
          {/* Metrics Summary */}
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div className="metric-card bg-white border border-zinc-200 rounded-lg p-4">
              <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Số công việc</span>
              <strong className="block text-2xl font-bold text-zinc-900 mt-2 leading-none">
                {report.summary.order_count}
              </strong>
            </div>
            <div className="metric-card bg-white border border-zinc-200 rounded-lg p-4">
              <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Đã thu</span>
              <strong className="block text-2xl font-bold text-zinc-900 mt-2 leading-none">
                {money(report.summary.paid_revenue)}
              </strong>
            </div>
            <div className="metric-card bg-white border border-zinc-200 rounded-lg p-4">
              <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Công nợ</span>
              <strong className="block text-2xl font-bold text-zinc-900 mt-2 leading-none">
                {money(report.summary.open_debt)}
              </strong>
            </div>
            <div className="metric-card bg-white border border-zinc-200 rounded-lg p-4">
              <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Tổng phát sinh</span>
              <strong className="block text-2xl font-bold text-zinc-900 mt-2 leading-none">
                {money(report.summary.gross_amount)}
              </strong>
            </div>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            {/* By Status */}
            <section className="panel bg-white border border-zinc-200 rounded-lg p-5 shadow-sm">
              <div className="panel-heading mb-4 border-b border-zinc-100 pb-2">
                <div>
                  <h2 className="text-sm font-bold text-zinc-900 flex items-center gap-1.5">
                    <TrendingUp size={15} className="text-zinc-500" />
                    Theo trạng thái
                  </h2>
                </div>
                <span className="text-xs font-semibold px-2 py-0.5 rounded bg-zinc-100 text-zinc-800">
                  {report.byStatus.length} nhóm
                </span>
              </div>
              <div className="grid gap-2 max-h-[300px] overflow-y-auto pr-1">
                {report.byStatus.map((item) => (
                  <div
                    key={item.status}
                    className="compact-row border border-zinc-100 rounded-md p-3 hover:bg-zinc-50 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <StatusBadge status={item.status} />
                      <span className="text-xs text-zinc-500">{WORK_ORDER_STATUS_LABELS[item.status]}</span>
                    </div>
                    <strong className="text-sm text-zinc-900">{item.count} công việc</strong>
                  </div>
                ))}
              </div>
            </section>

            {/* By Technician */}
            <section className="panel bg-white border border-zinc-200 rounded-lg p-5 shadow-sm">
              <div className="panel-heading mb-4 border-b border-zinc-100 pb-2">
                <div>
                  <h2 className="text-sm font-bold text-zinc-900 flex items-center gap-1.5">
                    <Users2 size={15} className="text-zinc-500" />
                    Theo kỹ thuật viên
                  </h2>
                </div>
                <span className="text-xs font-semibold text-zinc-500">Doanh thu đã thu</span>
              </div>
              <div className="grid gap-2 max-h-[300px] overflow-y-auto pr-1">
                {report.byTechnician.map((item) => (
                  <div
                    key={item.technician_name}
                    className="compact-row border border-zinc-100 rounded-md p-3 hover:bg-zinc-50 transition-colors"
                  >
                    <div>
                      <p className="font-bold text-sm text-zinc-900 leading-snug">{item.technician_name}</p>
                      <p className="text-xs text-zinc-500 mt-1">{item.order_count} công việc</p>
                    </div>
                    <strong className="text-sm text-zinc-900">{money(item.paid_revenue)}</strong>
                  </div>
                ))}
              </div>
            </section>

            {/* Materials Used */}
            <section className="panel bg-white border border-zinc-200 rounded-lg p-5 shadow-sm md:col-span-2">
              <div className="panel-heading mb-4 border-b border-zinc-100 pb-2">
                <div>
                  <h2 className="text-sm font-bold text-zinc-900 flex items-center gap-1.5">
                    <PackageCheck size={15} className="text-zinc-500" />
                    Vật tư đã dùng
                  </h2>
                </div>
                <span className="text-xs font-semibold px-2 py-0.5 rounded bg-zinc-100 text-zinc-800">
                  {report.materials.length} dòng
                </span>
              </div>
              <div className="grid gap-2 max-h-[350px] overflow-y-auto pr-1">
                {report.materials.map((item) => (
                  <div
                    key={item.name}
                    className="compact-row border border-zinc-100 rounded-md p-3 hover:bg-zinc-50 transition-colors"
                  >
                    <div>
                      <p className="font-bold text-sm text-zinc-900 leading-snug">{item.name}</p>
                      <p className="text-xs text-zinc-500 mt-1">Số lượng: {item.quantity}</p>
                    </div>
                    <strong className="text-sm text-zinc-900">{money(item.total_amount)}</strong>
                  </div>
                ))}
              </div>
            </section>
          </div>
        </>
      ) : null}
    </div>
  );
}
