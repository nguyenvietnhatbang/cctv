"use client";

import { FormEvent } from "react";
import { Save } from "lucide-react";
import { Field, PendingButton, ValidatedForm } from "@/components/ops/ui";
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
    <ValidatedForm onSubmit={onSubmit} aria-busy={isSubmitting} className="modal-panel form-grid">
      <h3 className="section-title">Chi phí và ghi chú</h3>
      {financialLocked ? (
        <p className="mt-2 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">Chi phí đã khóa sau nghiệm thu/thanh toán. Chỉ admin được điều chỉnh tiền công và VAT.</p>
      ) : null}
      <div className="grid gap-3 md:grid-cols-2">
        <Field label="Tiền công">
          <input name="laborCost" className="input" type="number" step="1000" defaultValue={Number(detail.workOrder.labor_cost)} placeholder="Tiền công" disabled={financialLocked || isSubmitting} />
        </Field>
        <Field label="VAT (%)">
          <input name="vatRate" className="input" type="number" step="0.1" defaultValue={Number(detail.workOrder.vat_rate)} placeholder="VAT %" disabled={financialLocked || isSubmitting} />
        </Field>
        <Field label="Ghi chú hoàn thành/phát sinh">
          <textarea name="completionNote" className="input min-h-20" defaultValue={detail.workOrder.completion_note ?? ""} placeholder="Ghi chú hoàn thành/phát sinh" disabled={isSubmitting} />
        </Field>
        <Field label="Ghi chú nội bộ">
          <input name="internalNote" className="input" defaultValue={detail.workOrder.internal_note ?? ""} placeholder="Ghi chú nội bộ" disabled={isSubmitting} />
        </Field>
      </div>
      <div className="form-actions">
        <PendingButton className="btn-secondary h-10" type="submit" pending={isSubmitting} pendingLabel="Đang lưu..."><Save size={15} />Lưu</PendingButton>
      </div>
    </ValidatedForm>
  );
}
