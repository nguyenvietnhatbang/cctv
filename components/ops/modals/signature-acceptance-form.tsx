"use client";

import { FormEvent, useRef, useState } from "react";
import { CheckCircle2, Eraser } from "lucide-react";
import { money } from "@/components/ops/format";
import { PendingButton, ValidatedForm } from "@/components/ops/ui";
import type { WorkOrderDetail } from "@/components/ops/types";
import { ImageUploadField } from "@/components/ops/image-upload-field";
import { MoneyInput } from "@/components/ops/money-input";

export function SignatureAcceptanceForm({
  detail,
  onAcceptance,
  allowPayment = false,
  isSubmitting = false,
}: {
  detail: WorkOrderDetail;
  onAcceptance: (payload: {
    acceptanceName: string;
    acceptancePhone: string | null;
    signatureDataUrl: string;
    payment?: {
      status: string;
      method: string | null;
      amount: string | null;
      debtDueDate: string | null;
      note: string | null;
      billFile: File | null;
    };
  }) => void | Promise<void>;
  allowPayment?: boolean;
  isSubmitting?: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [drawing, setDrawing] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);
  const [includePayment, setIncludePayment] = useState(false);

  const workOrderStatus = detail.workOrder.status;
  const canOfferPayment = allowPayment
    && ["working", "awaiting_acceptance", "completed", "awaiting_payment", "debt"].includes(workOrderStatus);
  const canCollectPayment = canOfferPayment && includePayment;
  
  const laborAmount = Number(detail.workOrder.labor_amount ?? detail.workOrder.labor_cost ?? 0);
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

  function point(event: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    const rect = canvas?.getBoundingClientRect();
    if (!canvas || !rect) return { x: 0, y: 0 };
    return {
      x: ((event.clientX - rect.left) / rect.width) * canvas.width,
      y: ((event.clientY - rect.top) / rect.height) * canvas.height,
    };
  }

  function start(event: React.PointerEvent<HTMLCanvasElement>) {
    const context = canvasRef.current?.getContext("2d");
    if (!context) return;
    const next = point(event);
    context.strokeStyle = "#18181b";
    context.lineWidth = 3;
    context.lineCap = "round";
    context.beginPath();
    context.moveTo(next.x, next.y);
    setDrawing(true);
    setHasSignature(true);
  }

  function move(event: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawing) return;
    const context = canvasRef.current?.getContext("2d");
    if (!context) return;
    const next = point(event);
    context.lineTo(next.x, next.y);
    context.stroke();
  }

  function clear() {
    const canvas = canvasRef.current;
    canvas?.getContext("2d")?.clearRect(0, 0, canvas.width, canvas.height);
    setHasSignature(false);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas || !hasSignature) return;

    const formData = new FormData(event.currentTarget);
    const canvasDataUrl = canvas.toDataURL("image/png");

    let paymentPayload = undefined;
    if (canCollectPayment) {
      const billFile = formData.get("billFile") as File | null;
      paymentPayload = {
        status: String(formData.get("paymentStatus") || "paid"),
        method: String(formData.get("paymentMethod") || "cash") || null,
        amount: String(formData.get("paymentAmount") || "0") || null,
        debtDueDate: String(formData.get("paymentDebtDueDate") || "") || null,
        note: String(formData.get("paymentNote") || "") || null,
        billFile: billFile && billFile.size > 0 ? billFile : null,
      };
    }

    await onAcceptance({
      acceptanceName: String(formData.get("acceptanceName") ?? ""),
      acceptancePhone: String(formData.get("acceptancePhone") || "") || null,
      signatureDataUrl: canvasDataUrl,
      payment: paymentPayload,
    });
  }

  return (
    <ValidatedForm onSubmit={submit} aria-busy={isSubmitting} className="modal-section">
      <h3 className="section-title">{canCollectPayment ? "Nghiệm thu & Thanh toán" : "Nghiệm thu"}</h3>
      
      <div className="mt-3 grid gap-4 lg:grid-cols-2">
        {/* Cột trái: Chi tiết thanh toán */}
        <div className="grid content-start gap-3">
          <div className="rounded-md border border-zinc-200 bg-zinc-50 p-3 text-sm text-zinc-700">
            <h4 className="font-semibold text-zinc-900 border-b border-zinc-200 pb-1.5 mb-2">Tóm tắt chi phí</h4>
            <div className="grid gap-1.5">
              <div className="flex justify-between">
                <span>Chi phí vật tư đã chốt:</span>
                <strong>{money(detail.workOrder.material_amount)}</strong>
              </div>
              <div className="flex justify-between">
                <span>Tiền nhân công:</span>
                <strong>{money(laborAmount)}</strong>
              </div>
              <div className="flex justify-between">
                <span>Thuế VAT:</span>
                <strong>{money(detail.workOrder.vat_amount)}</strong>
              </div>
              <div className="flex justify-between border-t border-dashed border-zinc-200 pt-1.5">
                <span>Đã thu trước đó:</span>
                <strong>{money(paidAmount)}</strong>
              </div>
              <div className="flex justify-between">
                <span>Còn lại phải thu:</span>
                <strong className="text-blue-600">{money(debtAmount)}</strong>
              </div>
              <div className="flex justify-between border-t border-zinc-200 pt-2 text-base font-bold text-zinc-950">
                <span>Tổng chi phí phiếu:</span>
                <span>{money(totalAmount)}</span>
              </div>
            </div>
          </div>

          {canOfferPayment ? (
            <label className="flex items-start gap-2 rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-900">
              <input
                type="checkbox"
                className="mt-1"
                checked={includePayment}
                onChange={(event) => setIncludePayment(event.target.checked)}
                disabled={isSubmitting}
              />
              <span>
                <strong>Ghi nhận thanh toán cùng lúc nghiệm thu</strong>
                <span className="mt-0.5 block text-xs leading-5 text-blue-700">Bỏ chọn nếu chỉ ký nghiệm thu và chuyển cho điều phối/kế toán thu tiền sau.</span>
              </span>
            </label>
          ) : null}

          {canCollectPayment ? (
            <div className="grid gap-2">
              <h4 className="text-xs font-bold text-zinc-500 uppercase tracking-wider mt-1">Ghi nhận thanh toán tại hiện trường</h4>
              <select
                name="paymentStatus"
                className="input"
                value={status}
                onChange={(event) => {
                  const nextStatus = event.target.value as "paid" | "debt";
                  setStatus(nextStatus);
                  if (nextStatus === "paid") setAmount(String(debtAmount));
                  if (nextStatus === "debt") setAmount("0");
                }}
                disabled={isSubmitting}
              >
                <option value="paid">Thu tiền</option>
                <option value="debt">Công nợ / thu một phần</option>
              </select>
              <label className="grid gap-1 text-xs font-semibold text-zinc-600">
                Số tiền khách thanh toán
                <MoneyInput
                  name="paymentAmount"
                  className="input"
                  value={amount}
                  onValueChange={setAmount}
                  placeholder="VD: 200.125 hoặc 200.125,50"
                  disabled={isSubmitting}
                />
              </label>
              <select name="paymentMethod" className="input" value={canChoosePaymentMethod ? method : "debt"} onChange={(event) => setMethod(event.target.value)} disabled={isSubmitting || !canChoosePaymentMethod}>
                <option value="cash">Tiền mặt</option>
                <option value="bank_transfer">Chuyển khoản</option>
                <option value="debt">Công nợ</option>
              </select>
              {!canChoosePaymentMethod ? <input type="hidden" name="paymentMethod" value="debt" /> : null}
              <label className="grid gap-1 text-xs font-semibold text-zinc-600">
                Ngày hẹn thanh toán
                <input
                  name="paymentDebtDueDate"
                  className="input"
                  type="date"
                  defaultValue={detail.workOrder.debt_due_date ?? ""}
                  disabled={isSubmitting || !willKeepDebt}
                />
              </label>
              <input name="paymentNote" className="input" defaultValue={detail.workOrder.payment_note ?? ""} placeholder={willKeepDebt ? "Ghi chú công nợ hoặc ngày hẹn" : "Ghi chú thanh toán"} disabled={isSubmitting} />
              <label className="grid gap-1 text-xs font-semibold text-zinc-600">
                Ảnh hóa đơn / Bill chuyển khoản (nếu có)
                <ImageUploadField name="billFile" capture="environment" disabled={isSubmitting} previewLabel="Xem trước ảnh bill" />
              </label>
            </div>
          ) : null}
        </div>

        {/* Cột phải: Ký nghiệm thu */}
        <div className="grid content-start gap-3">
          <div className="rounded-md border border-zinc-200 bg-zinc-50 p-3 text-sm text-zinc-700">
            <h4 className="font-semibold text-zinc-900 border-b border-zinc-200 pb-1.5 mb-2">Thông tin khách hàng</h4>
            <p><strong>Khách hàng:</strong> {detail.workOrder.customer_name}</p>
            <p><strong>Địa chỉ:</strong> {detail.workOrder.customer_address}</p>
          </div>
          
          <div className="grid gap-2">
            <label className="grid gap-1 text-xs font-semibold text-zinc-600">
              Tên người nghiệm thu
              <input name="acceptanceName" className="input" defaultValue={detail.workOrder.acceptance_name ?? detail.workOrder.customer_name} placeholder="Họ tên người ký nhận" required disabled={isSubmitting} />
            </label>
            <label className="grid gap-1 text-xs font-semibold text-zinc-600">
              Số điện thoại người nghiệm thu
              <input name="acceptancePhone" className="input" defaultValue={detail.workOrder.acceptance_phone ?? ""} placeholder="SĐT người nghiệm thu nếu khác" disabled={isSubmitting} />
            </label>
            <div className="grid gap-1">
              <span className="text-xs font-semibold text-zinc-600">Khách ký chữ ký điện tử vào khung dưới đây</span>
              <canvas
                ref={canvasRef}
                width={720}
                height={260}
                className="h-40 w-full touch-none rounded-md border border-zinc-300 bg-white"
                onPointerDown={start}
                onPointerMove={move}
                onPointerUp={() => setDrawing(false)}
                onPointerCancel={() => setDrawing(false)}
              />
            </div>
            <label className="flex items-start gap-2 text-sm text-zinc-700 mt-1">
              <input type="checkbox" className="mt-1" required aria-label="đồng ý nghiệm thu" />
              <span>Khách đã xem tóm tắt chi phí, nội dung xử lý và đồng ý ký xác nhận nghiệm thu.</span>
            </label>
            
            <div className="grid grid-cols-2 gap-2 mt-2">
              <button onClick={clear} className="btn-secondary h-10" type="button" disabled={isSubmitting}><Eraser size={15} />Ký lại</button>
              <PendingButton className="btn-primary h-10" type="submit" disabled={!hasSignature} pending={isSubmitting} pendingLabel="Đang lưu..."><CheckCircle2 size={15} />Xác nhận</PendingButton>
            </div>
          </div>
        </div>
      </div>
    </ValidatedForm>
  );
}
