"use client";

import { FormEvent, useState } from "react";
import { CreditCard } from "lucide-react";
import { money } from "@/components/ops/format";
import { PendingButton, ValidatedForm } from "@/components/ops/ui";
import type { WorkOrderDetail } from "@/components/ops/types";
import { ImageUploadField } from "@/components/ops/image-upload-field";
import { WorkFileGallery } from "@/components/ops/work-file-gallery";

export function PaymentForm({
  detail,
  onSubmit,
  isSubmitting = false,
}: {
  detail: WorkOrderDetail;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  isSubmitting?: boolean;
}) {
  const currentStatus = detail.workOrder.status;
  const canSubmit = ["completed", "awaiting_payment", "debt"].includes(currentStatus);
  const [status, setStatus] = useState<"paid" | "debt">("paid");
  const [method, setMethod] = useState(detail.workOrder.payment_method ?? "cash");

  return (
    <ValidatedForm onSubmit={onSubmit} aria-busy={isSubmitting} className="modal-section">
      <h3 className="section-title">Thanh toán</h3>
      <p className="mt-2 text-2xl font-semibold">{money(detail.workOrder.total_amount)}</p>
      <div className="mt-3 grid gap-1 rounded-md bg-zinc-50 p-3 text-sm text-zinc-700">
        <p>Tiền công: <strong>{money(detail.workOrder.labor_cost)}</strong></p>
        <p>Vật tư: <strong>{money(detail.workOrder.material_amount)}</strong></p>
        <p>VAT: <strong>{money(detail.workOrder.vat_amount)}</strong></p>
      </div>
      {!canSubmit ? (
        <p className="mt-3 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Chỉ cập nhật thanh toán khi phiếu đã hoàn thành, chờ thanh toán hoặc đang công nợ.
        </p>
      ) : null}
      <div className="mt-3 grid gap-2">
        <select
          name="status"
          className="input"
          value={status}
          onChange={(event) => {
            const nextStatus = event.target.value as "paid" | "debt";
            setStatus(nextStatus);
            if (nextStatus === "debt") setMethod("debt");
            if (nextStatus === "paid" && method === "debt") setMethod("cash");
          }}
          disabled={!canSubmit || isSubmitting}
        >
          <option value="paid">Đã thanh toán</option>
          {currentStatus !== "debt" ? <option value="debt">Công nợ</option> : null}
        </select>
        <select name="method" className="input" value={method} onChange={(event) => setMethod(event.target.value)} disabled={!canSubmit || isSubmitting || status === "debt"}>
          <option value="cash">Tiền mặt</option>
          <option value="bank_transfer">Chuyển khoản</option>
          <option value="debt">Công nợ</option>
        </select>
        <input name="transactionRef" className="input" defaultValue={detail.workOrder.transaction_ref ?? ""} placeholder="Mã giao dịch" disabled={!canSubmit || isSubmitting || status === "debt"} />
        <input name="debtDueDate" className="input" type="date" defaultValue={detail.workOrder.debt_due_date ?? ""} disabled={!canSubmit || isSubmitting || status !== "debt"} />
        <input name="note" className="input" defaultValue={detail.workOrder.payment_note ?? ""} placeholder={status === "debt" ? "Ghi chú công nợ hoặc ngày hẹn" : "Ghi chú"} disabled={!canSubmit || isSubmitting} />
        <label className="grid gap-1 text-xs font-semibold text-zinc-600">
          Ảnh bill
          <ImageUploadField name="billFile" capture="environment" disabled={!canSubmit || isSubmitting} previewLabel="Xem trước ảnh bill" />
        </label>
        <PendingButton className="btn-primary h-10" type="submit" disabled={!canSubmit} pending={isSubmitting} pendingLabel="Đang cập nhật..."><CreditCard size={15} />Xác nhận</PendingButton>
        {detail.files.some((file) => file.purpose === "bill") ? (
          <WorkFileGallery files={detail.files.filter((file) => file.purpose === "bill")} />
        ) : null}
      </div>
    </ValidatedForm>
  );
}
