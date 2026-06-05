"use client";

import { FormEvent } from "react";
import { Save } from "lucide-react";
import type { WorkOrderDetail } from "@/components/ops/types";

export function CostNoteForm({
  detail,
  financialLocked,
  onSubmit,
}: {
  detail: WorkOrderDetail;
  financialLocked: boolean;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <form onSubmit={onSubmit} className="rounded-md border border-zinc-200 p-4">
      <h3 className="section-title">Chi phí và ghi chú</h3>
      {financialLocked ? (
        <p className="mt-2 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">Chi phí đã khóa sau nghiệm thu/thanh toán. Chỉ admin được điều chỉnh tiền công và VAT.</p>
      ) : null}
      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <input name="laborCost" className="input" type="number" step="1000" defaultValue={Number(detail.workOrder.labor_cost)} placeholder="Tiền công" disabled={financialLocked} />
        <input name="vatRate" className="input" type="number" step="0.1" defaultValue={Number(detail.workOrder.vat_rate)} placeholder="VAT %" disabled={financialLocked} />
        <textarea name="completionNote" className="input min-h-20 md:col-span-2" defaultValue={detail.workOrder.completion_note ?? ""} placeholder="Ghi chú hoàn thành/phát sinh" />
        <input name="internalNote" className="input md:col-span-2" defaultValue={detail.workOrder.internal_note ?? ""} placeholder="Ghi chú nội bộ" />
      </div>
      <button className="btn-secondary mt-3 h-10" type="submit"><Save size={15} />Lưu</button>
    </form>
  );
}
