"use client";

import { BarChart3 } from "lucide-react";
import { WORK_ORDER_STATUS_LABELS } from "@/lib/types";
import { money, todayInVietnam } from "@/components/ops/format";
import { StatusBadge } from "@/components/ops/ui";
import type { ReportData } from "@/components/ops/types";

export function ReportsScreen({
  report,
  onSubmit,
}: {
  report: ReportData | null;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
}) {
  const today = todayInVietnam();

  return (
    <>
      <section className="panel">
        <div className="panel-heading">
          <h2>Báo cáo cơ bản</h2>
          <span>Lọc theo ngày</span>
        </div>
        <form onSubmit={onSubmit} className="grid gap-3 md:grid-cols-[180px_180px_auto]">
          <input name="from" type="date" className="input" defaultValue={report?.range.from ?? today} />
          <input name="to" type="date" className="input" defaultValue={report?.range.to ?? today} />
          <button className="btn-primary h-11" type="submit"><BarChart3 size={16} />Xem báo cáo</button>
        </form>
      </section>
      {report ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div className="metric-card"><span>Số phiếu</span><strong>{report.summary.order_count}</strong></div>
            <div className="metric-card"><span>Đã thu</span><strong>{money(report.summary.paid_revenue)}</strong></div>
            <div className="metric-card"><span>Công nợ</span><strong>{money(report.summary.open_debt)}</strong></div>
            <div className="metric-card"><span>Tổng phát sinh</span><strong>{money(report.summary.gross_amount)}</strong></div>
          </div>
          <section className="panel">
            <div className="panel-heading"><h2>Theo trạng thái</h2><span>{report.byStatus.length} nhóm</span></div>
            <div className="grid gap-2">
              {report.byStatus.map((item) => (
                <div key={item.status} className="compact-row">
                  <div className="flex items-center gap-2">
                    <StatusBadge status={item.status} />
                    <span className="text-sm text-zinc-500">{WORK_ORDER_STATUS_LABELS[item.status]}</span>
                  </div>
                  <strong>{item.count}</strong>
                </div>
              ))}
            </div>
          </section>
          <section className="panel">
            <div className="panel-heading"><h2>Theo kỹ thuật viên</h2><span>Doanh thu đã thu</span></div>
            <div className="grid gap-2">
              {report.byTechnician.map((item) => (
                <div key={item.technician_name} className="compact-row">
                  <div><p className="font-semibold">{item.technician_name}</p><p className="text-sm text-zinc-500">{item.order_count} phiếu</p></div>
                  <strong>{money(item.paid_revenue)}</strong>
                </div>
              ))}
            </div>
          </section>
          <section className="panel">
            <div className="panel-heading"><h2>Vật tư đã dùng</h2><span>{report.materials.length} dòng</span></div>
            <div className="grid gap-2">
              {report.materials.map((item) => (
                <div key={item.name} className="compact-row">
                  <div><p className="font-semibold">{item.name}</p><p className="text-sm text-zinc-500">SL: {item.quantity}</p></div>
                  <strong>{money(item.total_amount)}</strong>
                </div>
              ))}
            </div>
          </section>
        </>
      ) : null}
    </>
  );
}
