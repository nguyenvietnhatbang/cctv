"use client";

import { FormEvent } from "react";
import { Save } from "lucide-react";
import { MoneyInput } from "@/components/ops/money-input";
import { PendingButton, ValidatedForm } from "@/components/ops/ui";
import type { WorkOrderDetail } from "@/components/ops/types";

export function CostNoteForm({
  detail,
  financialLocked,
  onSubmit,
  isSubmitting = false,
}: {
  detail: WorkOrderDetail;
  financialLocked: boolean;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  isSubmitting?: boolean;
}) {
  return (
    <ValidatedForm onSubmit={onSubmit} aria-busy={isSubmitting} className="modal-section">
      <h3 className="section-title">Chi phí và ghi chú</h3>
      {financialLocked ? (
        <p className="mt-2 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">Chi phí đã khóa sau nghiệm thu/thanh toán. Chỉ admin được điều chỉnh tiền công và VAT.</p>
      ) : null}
      <div className="mt-3 grid gap-3 md:grid-cols-3">
        <label className="grid gap-1 text-xs font-semibold text-zinc-600">
          Chi phí vật tư đã chốt
          <MoneyInput name="materialCost" className="input" defaultValue={Number(detail.workOrder.material_amount)} placeholder="VD: 500.000" disabled={financialLocked || isSubmitting} />
        </label>
        <label className="grid gap-1 text-xs font-semibold text-zinc-600">
          Chi phí nhân công
          <MoneyInput name="laborCost" className="input" defaultValue={Number(detail.workOrder.labor_cost)} placeholder="VD: 200.000" disabled={financialLocked || isSubmitting} />
        </label>
        <label className="grid gap-1 text-xs font-semibold text-zinc-600">
          VAT (%) — không bắt buộc
          <input name="vatRate" className="input" type="number" min="0" max="100" step="0.1" defaultValue={Number(detail.workOrder.vat_rate) || undefined} placeholder="Để trống nếu không có VAT" disabled={financialLocked || isSubmitting} />
        </label>
        <label className="grid gap-1 text-xs font-semibold text-zinc-600 md:col-span-3">
          Ghi chú hoàn thành/phát sinh
          <textarea name="completionNote" className="input min-h-20" defaultValue={detail.workOrder.completion_note ?? ""} placeholder="Nội dung đã làm, phát sinh, lưu ý nghiệm thu" disabled={isSubmitting} />
        </label>
        <label className="grid gap-1 text-xs font-semibold text-zinc-600 md:col-span-3">
          Ghi chú nội bộ
          <input name="internalNote" className="input" defaultValue={detail.workOrder.internal_note ?? ""} placeholder="Ghi chú chỉ dùng nội bộ" disabled={isSubmitting} />
        </label>
      </div>
      <PendingButton className="btn-secondary mt-3 h-10" type="submit" pending={isSubmitting} pendingLabel="Đang lưu..."><Save size={15} />Lưu</PendingButton>
    </ValidatedForm>
  );
}
