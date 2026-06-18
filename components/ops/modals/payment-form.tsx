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
  const totalAmount = Number(detail.workOrder.total_amount);
  const paidAmount = Number(detail.workOrder.paid_amount);
  const storedDebtAmount = Number(detail.workOrder.debt_amount);
  const debtAmount = Math.max(storedDebtAmount > 0 ? storedDebtAmount : totalAmount - paidAmount, 0);
  const [status, setStatus] = useState<"paid" | "debt">("paid");
  const [method, setMethod] = useState(detail.workOrder.payment_method && detail.workOrder.payment_method !== "debt" ? detail.workOrder.payment_method : "cash");
  const [amount, setAmount] = useState(String(debtAmount || totalAmount));
  const collectionAmount = Number(amount || 0);
  const willKeepDebt = status === "debt" || collectionAmount < debtAmount;
  const canChoosePaymentMethod = collectionAmount > 0;

  return (
    <ValidatedForm onSubmit={onSubmit} aria-busy={isSubmitting} className="modal-section">
      <h3 className="section-title">Thanh toán</h3>
      <p className="mt-2 text-2xl font-semibold">{money(detail.workOrder.total_amount)}</p>
      <div className="mt-3 grid gap-1 rounded-md bg-zinc-50 p-3 text-sm text-zinc-700">
        <p>Tiền công: <strong>{money(detail.workOrder.labor_cost)}</strong></p>
        <p>Vật tư: <strong>{money(detail.workOrder.material_amount)}</strong></p>
        <p>VAT: <strong>{money(detail.workOrder.vat_amount)}</strong></p>
        <p>Đã thu: <strong>{money(detail.workOrder.paid_amount)}</strong></p>
        <p>Còn lại: <strong>{money(debtAmount)}</strong></p>
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
            if (nextStatus === "paid") setAmount(String(debtAmount));
            if (nextStatus === "debt") setAmount("0");
          }}
          disabled={!canSubmit || isSubmitting}
        >
          <option value="paid">Thu tiền</option>
          <option value="debt">Công nợ / thu một phần</option>
        </select>
        <input
          name="amount"
          className="input"
          type="number"
          min="0"
          max={debtAmount}
          step="1000"
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
          placeholder="Số tiền thực thu"
          disabled={!canSubmit || isSubmitting}
        />
        <select name="method" className="input" value={canChoosePaymentMethod ? method : "debt"} onChange={(event) => setMethod(event.target.value)} disabled={!canSubmit || isSubmitting || !canChoosePaymentMethod}>
          <option value="cash">Tiền mặt</option>
          <option value="bank_transfer">Chuyển khoản</option>
          <option value="debt">Công nợ</option>
        </select>
        {!canChoosePaymentMethod ? <input type="hidden" name="method" value="debt" /> : null}
        <p className="rounded-md bg-zinc-50 px-3 py-2 text-xs font-semibold text-zinc-500">
          Mã giao dịch sẽ tự tạo khi xác nhận thu tiền.
        </p>
        <input name="debtDueDate" className="input" type="date" defaultValue={detail.workOrder.debt_due_date ?? ""} disabled={!canSubmit || isSubmitting || !willKeepDebt} />
        <input name="note" className="input" defaultValue={detail.workOrder.payment_note ?? ""} placeholder={willKeepDebt ? "Ghi chú công nợ hoặc ngày hẹn" : "Ghi chú"} disabled={!canSubmit || isSubmitting} />
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
