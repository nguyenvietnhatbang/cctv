"use client";

import { FormEvent, useMemo, useState } from "react";
import {
  CalendarClock,
  CheckCircle2,
  ClipboardCheck,
  CreditCard,
  FileBox,
  MapPinned,
  Navigation,
  PauseCircle,
  Phone,
  Play,
  ReceiptText,
  Save,
  Upload,
  type LucideIcon,
} from "lucide-react";
import {
  getAllowedWorkOrderTransitions,
  WORK_ORDER_STATUS_DESCRIPTIONS,
  WORK_ORDER_STATUS_LABELS,
  WORK_ORDER_TYPE_LABELS,
  type WorkOrderStatus,
} from "@/lib/types";
import { dateTime, money } from "@/components/ops/format";
import { mapSearchUrl } from "@/components/ops/app-utils";
import { MoneyInput } from "@/components/ops/money-input";
import { DeadlineBadge, Modal, PendingButton, StageBadge, StatusBadge, ValidatedForm } from "@/components/ops/ui";
import type { Material, WorkFile, WorkOrderDetail } from "@/components/ops/types";
import { ImageUploadField } from "@/components/ops/image-upload-field";
import { MaterialsForm } from "@/components/ops/modals/materials-form";
import { PaymentForm } from "@/components/ops/modals/payment-form";
import { SignatureAcceptanceForm } from "@/components/ops/modals/signature-acceptance-form";
import { WorkFileGallery } from "@/components/ops/work-file-gallery";

const FIELD_LOCKED_STATUSES: WorkOrderStatus[] = ["completed", "awaiting_payment", "paid", "debt", "paused", "cancelled"];

const ACTION_ICONS: Partial<Record<WorkOrderStatus, LucideIcon>> = {
  accepted: Play,
  traveling: Navigation,
  working: MapPinned,
  awaiting_acceptance: CheckCircle2,
};

const STEP_ORDER: WorkOrderStatus[] = ["assigned", "accepted", "traveling", "working", "awaiting_acceptance", "completed"];
const CHECKOUT_REASONS = [
  "Nghỉ trưa",
  "Hết giờ làm",
  "Tạm dừng để đi việc gấp khác",
] as const;

type TechnicianModalTab = "progress" | "costs" | "files" | "payment" | "acceptance";

const TECHNICIAN_MODAL_TABS: ReadonlyArray<{ id: TechnicianModalTab; label: string; icon: LucideIcon }> = [
  { id: "progress", label: "Tiến độ", icon: ClipboardCheck },
  { id: "costs", label: "Chi phí", icon: ReceiptText },
  { id: "files", label: "Ảnh", icon: FileBox },
  { id: "payment", label: "Thanh toán", icon: CreditCard },
  { id: "acceptance", label: "Nghiệm thu", icon: CheckCircle2 },
];

const PAYMENT_STATUS_LABELS: Record<string, string> = {
  unpaid: "Chưa thanh toán",
  paid: "Đã thanh toán",
  debt: "Công nợ",
};

function getCurrentPosition() {
  return new Promise<{ checkInLat: number; checkInLng: number } | null>((resolve) => {
    if (!("geolocation" in navigator)) {
      resolve(null);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => resolve({ checkInLat: position.coords.latitude, checkInLng: position.coords.longitude }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 30000 },
    );
  });
}

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function stepIndex(status: WorkOrderStatus) {
  const index = STEP_ORDER.indexOf(status);
  if (index >= 0) return index;
  if (["awaiting_payment", "paid", "debt"].includes(status)) return STEP_ORDER.length;
  return -1;
}

function PaymentSummary({ detail }: { detail: WorkOrderDetail }) {
  const paymentStatus = detail.workOrder.payment_status ?? "unpaid";
  const paidAmount = detail.workOrder.paid_amount;
  const debtAmount = detail.workOrder.debt_amount;
  const latestTransaction = detail.paymentTransactions[0];

  return (
    <section className="modal-section">
      <h3 className="section-title">Thanh toán</h3>
      <div className="mt-3 grid gap-2 text-sm text-zinc-700">
        <div className="flex items-center justify-between rounded-md bg-zinc-50 px-3 py-2">
          <span>Tổng chi phí</span>
          <strong className="text-zinc-950">{money(detail.workOrder.total_amount)}</strong>
        </div>
        <div className="flex items-center justify-between rounded-md bg-zinc-50 px-3 py-2">
          <span>Đã thanh toán</span>
          <strong className="text-zinc-950">{money(paidAmount)}</strong>
        </div>
        <div className="flex items-center justify-between rounded-md bg-zinc-50 px-3 py-2">
          <span>Công nợ còn lại</span>
          <strong className="text-zinc-950">{money(debtAmount)}</strong>
        </div>
        <div className="flex items-center justify-between rounded-md bg-zinc-50 px-3 py-2">
          <span>Hiện trạng</span>
          <strong className="text-zinc-950">{PAYMENT_STATUS_LABELS[paymentStatus] ?? paymentStatus}</strong>
        </div>
        <div className="flex items-center justify-between rounded-md bg-zinc-50 px-3 py-2">
          <span>Hẹn ngày thanh toán</span>
          <strong className="text-zinc-950">{detail.workOrder.debt_due_date ? dateTime(detail.workOrder.debt_due_date) : "Chưa có"}</strong>
        </div>
        <div className="rounded-md bg-zinc-50 px-3 py-2">
          <p className="text-zinc-600">Giao dịch gần nhất</p>
          <p className="mt-1 font-semibold text-zinc-950">
            {latestTransaction ? `${latestTransaction.transaction_ref} · ${money(latestTransaction.amount)}` : "Chưa có"}
          </p>
        </div>
        <div className="rounded-md bg-zinc-50 px-3 py-2">
          <p className="text-zinc-600">Ghi chú khác</p>
          <p className="mt-1 font-semibold text-zinc-950 whitespace-pre-wrap">{detail.workOrder.payment_note ?? "Chưa có"}</p>
        </div>
      </div>
    </section>
  );
}

function FieldCostForm({
  detail,
  locked,
  isSubmitting,
  onSubmit,
}: {
  detail: WorkOrderDetail;
  locked: boolean;
  isSubmitting: boolean;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void | Promise<void>;
}) {
  const materialAmount = Number(detail.workOrder.material_amount);
  const vatAmount = Number(detail.workOrder.vat_amount);
  const totalAmount = Number(detail.workOrder.total_amount);
  const laborAmount = Number(detail.workOrder.labor_cost);

  return (
    <ValidatedForm onSubmit={onSubmit} aria-busy={isSubmitting} className="modal-section">
      <h3 className="section-title">Chi phí nhân công</h3>
      {locked ? (
        <p className="mt-2 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">Chi phí đã khóa sau nghiệm thu/thanh toán.</p>
      ) : null}
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <label className="grid gap-1 text-xs font-semibold text-zinc-600">
          Chi phí nhân công
          <MoneyInput name="laborCost" className="input" defaultValue={Number(detail.workOrder.labor_cost)} placeholder="VD: 200.000" disabled={locked || isSubmitting} />
        </label>
        <label className="grid gap-1 text-xs font-semibold text-zinc-600">
          VAT (%)
          <input name="vatRate" className="input" type="number" step="0.1" defaultValue={Number(detail.workOrder.vat_rate)} placeholder="VD: 10" disabled={locked || isSubmitting} />
        </label>
      </div>
      <PendingButton className="btn-secondary mt-3 h-10" type="submit" disabled={locked} pending={isSubmitting} pendingLabel="Đang lưu...">
        <Save size={15} />Lưu chi phí
      </PendingButton>
      <div className="mt-3 grid gap-2 rounded-md bg-zinc-50 p-3 text-sm text-zinc-700">
        <div className="flex items-center justify-between gap-3">
          <span>Chi phí nhân công</span>
          <strong className="text-zinc-950">{money(laborAmount)}</strong>
        </div>
        <div className="flex items-center justify-between gap-3">
          <span>Chi phí vật tư</span>
          <strong className="text-zinc-950">{money(materialAmount)}</strong>
        </div>
        <div className="flex items-center justify-between gap-3">
          <span>VAT</span>
          <strong className="text-zinc-950">{money(vatAmount)}</strong>
        </div>
        <div className="flex items-center justify-between gap-3 border-t border-zinc-200 pt-2">
          <span>Tổng cộng</span>
          <strong className="text-zinc-950">{money(totalAmount)}</strong>
        </div>
      </div>
    </ValidatedForm>
  );
}

function FieldDocumentUploadForm({
  detail,
  locked,
  isUploading,
  deletingFileId,
  onSubmit,
  onDelete,
}: {
  detail: WorkOrderDetail;
  locked: boolean;
  isUploading: boolean;
  deletingFileId: string | null;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void | Promise<void>;
  onDelete: (file: WorkFile) => void | Promise<void>;
}) {
  const fieldFiles = detail.files.filter((file) => file.purpose === "after" || file.purpose === "handover_document");

  return (
    <section className="modal-section">
      <h3 className="section-title">Tài liệu sau thi công</h3>
      {locked ? (
        <p className="mt-2 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">Tài liệu đã khóa sau nghiệm thu/thanh toán.</p>
      ) : null}
      <ValidatedForm onSubmit={onSubmit} aria-busy={isUploading} className="mt-3 grid gap-2">
        <input type="hidden" name="purpose" value="after" />
        <ImageUploadField name="file" capture="environment" required disabled={locked || isUploading} aria-label="ảnh sau thi công" previewLabel="Xem trước ảnh sau thi công" />
        <PendingButton className="btn-secondary h-10" type="submit" disabled={locked} pending={isUploading} pendingLabel="Đang tải lên...">
          <Upload size={15} />Tải ảnh sau thi công
        </PendingButton>
      </ValidatedForm>
      <ValidatedForm onSubmit={onSubmit} aria-busy={isUploading} className="mt-3 grid gap-2">
        <input type="hidden" name="purpose" value="handover_document" />
        <input
          name="file"
          type="file"
          className="input"
          accept="image/*,.pdf,.doc,.docx,.xls,.xlsx"
          required
          disabled={locked || isUploading}
          aria-label="biên bản hoặc phiếu bàn giao"
        />
        <PendingButton className="btn-secondary h-10" type="submit" disabled={locked} pending={isUploading} pendingLabel="Đang tải lên...">
          <Upload size={15} />Tải biên bản / phiếu bàn giao
        </PendingButton>
      </ValidatedForm>
      {fieldFiles.length > 0 ? (
        <div className="mt-3">
          <WorkFileGallery
            files={fieldFiles}
            canDelete={() => !locked}
            onDelete={onDelete}
            deletingFileId={deletingFileId}
          />
        </div>
      ) : null}
    </section>
  );
}

export function TechnicianJobModal({
  detail,
  onClose,
  onStatus,
  onUpdate,
  onUpload,
  onFileDelete,
  onMaterialCreate,
  onMaterialUpdate,
  onMaterialDelete,
  onPayment,
  onAcceptance,
  pendingAction = null,
  materialPendingAction = null,
  deletingFileId = null,
}: {
  detail: WorkOrderDetail;
  onClose: () => void;
  onStatus: (status: WorkOrderStatus, payload?: { checkInLat?: number; checkInLng?: number; note?: string | null }) => void | Promise<void>;
  onUpdate: (event: FormEvent<HTMLFormElement>) => void | Promise<void>;
  onUpload: (event: FormEvent<HTMLFormElement>) => void | Promise<void>;
  onFileDelete: (file: WorkFile) => void | Promise<void>;
  onMaterialCreate: (event: FormEvent<HTMLFormElement>) => void | Promise<void>;
  onMaterialUpdate: (material: Material, event: FormEvent<HTMLFormElement>) => void | Promise<void>;
  onMaterialDelete: (material: Material) => void | Promise<void>;
  onPayment: (event: FormEvent<HTMLFormElement>) => void | Promise<void>;
  onAcceptance: (payload: { acceptanceName: string; acceptancePhone: string | null; signatureDataUrl: string }) => void | Promise<void>;
  pendingAction?: string | null;
  materialPendingAction?: { type: "create" } | { type: "update" | "delete"; id: string } | null;
  deletingFileId?: string | null;
}) {
  const [preparingStatus, setPreparingStatus] = useState(false);
  const [locationWarning, setLocationWarning] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TechnicianModalTab>("progress");
  const status = detail.workOrder.status;
  const nextFieldTransition = useMemo(
    () => getAllowedWorkOrderTransitions(status, "technician").find((transition) => transition.intent === "field"),
    [status],
  );
  const checkoutTransition = useMemo(
    () => getAllowedWorkOrderTransitions(status, "technician").find((transition) => transition.intent === "pause"),
    [status],
  );
  const resumeTransition = useMemo(
    () => status === "paused"
      ? getAllowedWorkOrderTransitions(status, "technician").find((transition) => transition.status === "working")
      : null,
    [status],
  );
  const currentStepIndex = stepIndex(status);
  const fieldLocked = FIELD_LOCKED_STATUSES.includes(status);
  const canSignAcceptance = status === "awaiting_acceptance";
  const canMoveNext = Boolean(nextFieldTransition);
  const canCheckout = Boolean(checkoutTransition);
  const canResume = Boolean(resumeTransition);
  const canQuickCheckIn = status === "assigned" || status === "accepted";
  const canCollectPayment = ["working", "awaiting_acceptance", "completed", "awaiting_payment", "debt"].includes(status);
  const nextStatus = nextFieldTransition?.status ?? null;
  const NextIcon = nextStatus ? ACTION_ICONS[nextStatus] ?? Play : ClipboardCheck;

  async function handleNextStatus() {
    if (!nextFieldTransition) return;
    setPreparingStatus(true);
    setLocationWarning(null);
    try {
      const checkIn = nextFieldTransition.status === "working" ? await getCurrentPosition() : null;
      if (nextFieldTransition.status === "working" && !checkIn) {
        setLocationWarning("Không lấy được vị trí check-in. Hãy cho phép quyền vị trí và mở app qua HTTPS hoặc localhost rồi thử lại.");
        return;
      }
      await onStatus(nextFieldTransition.status, checkIn ?? undefined);
    } catch (error) {
      setLocationWarning(getErrorMessage(error, "Không cập nhật được trạng thái phiếu. Vui lòng thử lại."));
    } finally {
      setPreparingStatus(false);
    }
  }

  async function handleQuickCheckIn() {
    setPreparingStatus(true);
    setLocationWarning(null);
    try {
      const checkIn = await getCurrentPosition();
      if (!checkIn) {
        setLocationWarning("Không lấy được vị trí check-in. Hãy cho phép quyền vị trí và mở app qua HTTPS hoặc localhost rồi thử lại.");
        return;
      }
      await onStatus("working", checkIn);
    } catch (error) {
      setLocationWarning(getErrorMessage(error, "Không check-in được. Vui lòng thử lại."));
    } finally {
      setPreparingStatus(false);
    }
  }

  async function handleCheckout(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!checkoutTransition) return;
    const formData = new FormData(event.currentTarget);
    const reason = String(formData.get("checkoutReason") || CHECKOUT_REASONS[0]);
    await onStatus(checkoutTransition.status, { note: `Check-out: ${reason}` });
  }

  async function handleResume() {
    if (!resumeTransition) return;
    await onStatus(resumeTransition.status, { note: "Tiếp tục xử lý sau check-out" });
  }

  return (
    <Modal title={`Xử lý hiện trường ${detail.workOrder.code}`} size="xl" onClose={onClose}>
      <div className="grid gap-4">
        <section className="modal-summary">
          <div className="flex flex-wrap items-center gap-2">
            <StageBadge status={status} />
            <StatusBadge order={detail.workOrder} />
            <DeadlineBadge order={detail.workOrder} />
            <span className="text-sm font-semibold text-zinc-500">{WORK_ORDER_TYPE_LABELS[detail.workOrder.type]}</span>
          </div>
          <div className="mt-3 grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
            <div className="min-w-0">
              <h3 className="text-lg font-bold text-zinc-950">{detail.workOrder.customer_name}</h3>
              <p className="mt-1 text-sm leading-6 text-zinc-600">{detail.workOrder.description}</p>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:flex">
              <a className="btn-primary h-11" href={`tel:${detail.workOrder.customer_phone}`}>
                <Phone size={15} />Gọi khách
              </a>
              <a
                className="btn-secondary h-11"
                href={mapSearchUrl({ address: detail.workOrder.customer_address, lat: detail.workOrder.customer_lat, lng: detail.workOrder.customer_lng })}
                target="_blank"
                rel="noreferrer"
              >
                <MapPinned size={15} />Bản đồ
              </a>
            </div>
          </div>
        </section>

        <nav className="modal-tabbar technician-tabbar" aria-label="Xử lý hiện trường">
          {TECHNICIAN_MODAL_TABS.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                className={`tab-button gap-2 ${activeTab === tab.id ? "tab-button-active" : ""}`}
                onClick={() => setActiveTab(tab.id)}
                type="button"
              >
                <Icon size={15} />
                {tab.label}
              </button>
            );
          })}
        </nav>

        <div className="modal-edit-shell technician-modal-shell">
          {activeTab === "progress" ? (
            <section className="grid gap-4">
              <div className="modal-section">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="section-title">Bước hiện tại</h3>
                    <p className="mt-1 text-sm leading-6 text-zinc-600">{WORK_ORDER_STATUS_DESCRIPTIONS[status]}</p>
                  </div>
                  <div className="grid w-full gap-2 sm:w-auto sm:grid-flow-col">
                    {canMoveNext && nextFieldTransition ? (
                      <PendingButton
                        className="btn-primary h-11"
                        onClick={handleNextStatus}
                        type="button"
                        pending={pendingAction === "status" || preparingStatus}
                        pendingLabel={preparingStatus ? "Đang chuẩn bị..." : "Đang chuyển..."}
                      >
                        <NextIcon size={15} />{nextFieldTransition.label}
                      </PendingButton>
                    ) : null}
                    {canQuickCheckIn ? (
                      <PendingButton
                        className="btn-secondary h-11"
                        onClick={handleQuickCheckIn}
                        type="button"
                        pending={pendingAction === "status" || preparingStatus}
                        pendingLabel={preparingStatus ? "Đang lấy vị trí..." : "Đang lưu..."}
                      >
                        <MapPinned size={15} />Check-in
                      </PendingButton>
                    ) : null}
                    {canResume && resumeTransition ? (
                      <PendingButton
                        className="btn-primary h-11"
                        onClick={handleResume}
                        type="button"
                        pending={pendingAction === "status"}
                        pendingLabel="Đang lưu..."
                      >
                        <Play size={15} />{resumeTransition.label}
                      </PendingButton>
                    ) : null}
                  </div>
                </div>

                <div className="mt-4 grid gap-2 sm:grid-cols-3 lg:grid-cols-6">
                  {STEP_ORDER.map((step, index) => {
                    const isCurrent = status === step;
                    const isDone = currentStepIndex > index;
                    return (
                      <div
                        key={step}
                        className={`rounded-md border px-3 py-2 text-xs font-semibold ${
                          isCurrent
                            ? "border-blue-600 bg-blue-600 text-white"
                            : isDone
                              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                              : "border-zinc-200 bg-zinc-50 text-zinc-500"
                        }`}
                      >
                        {WORK_ORDER_STATUS_LABELS[step]}
                      </div>
                    );
                  })}
                </div>

                {locationWarning ? (
                  <p className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">{locationWarning}</p>
                ) : null}
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <div className="modal-section">
                  <h3 className="section-title">Thông tin đi làm</h3>
                  <div className="mt-3 grid gap-3 text-sm text-zinc-700">
                    <p className="flex items-start gap-2">
                      <MapPinned size={15} className="mt-0.5 shrink-0 text-zinc-500" />
                      <span>{detail.workOrder.customer_address}</span>
                    </p>
                    <p className="flex items-center gap-2">
                      <CalendarClock size={15} className="shrink-0 text-zinc-500" />
                      <span>{dateTime(detail.workOrder.appointment_at)}</span>
                    </p>
                  </div>
                </div>

                <ValidatedForm onSubmit={onUpdate} aria-busy={pendingAction === "update"} className="modal-section">
                  <h3 className="section-title">Ghi chú hiện trường</h3>
                  <textarea
                    name="completionNote"
                    className="input mt-3 min-h-28"
                    defaultValue={detail.workOrder.completion_note ?? ""}
                    placeholder="Nội dung đã làm, phát sinh, lưu ý cho nghiệm thu"
                    disabled={pendingAction === "update" || status === "cancelled"}
                  />
                  <PendingButton className="btn-secondary mt-3 h-10" type="submit" pending={pendingAction === "update"} pendingLabel="Đang lưu...">
                    <Save size={15} />Lưu ghi chú
                  </PendingButton>
                </ValidatedForm>
              </div>

              {canCheckout ? (
                <ValidatedForm onSubmit={handleCheckout} aria-busy={pendingAction === "status"} className="modal-section">
                  <h3 className="section-title">Check-out</h3>
                  <div className="mt-3 grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
                    <select name="checkoutReason" className="input" defaultValue={CHECKOUT_REASONS[0]} disabled={pendingAction === "status"}>
                      {CHECKOUT_REASONS.map((reason) => (
                        <option key={reason} value={reason}>{reason}</option>
                      ))}
                    </select>
                    <PendingButton className="btn-secondary h-10" type="submit" pending={pendingAction === "status"} pendingLabel="Đang lưu...">
                      <PauseCircle size={15} />Check-out
                    </PendingButton>
                  </div>
                </ValidatedForm>
              ) : null}

              {!canMoveNext && !canSignAcceptance && status !== "completed" && !["awaiting_payment", "paid", "debt", "paused", "cancelled"].includes(status) ? (
                <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                  Phiếu chưa có thao tác kế tiếp cho kỹ thuật viên. Admin cần kiểm tra lại trạng thái hoặc phân công.
                </p>
              ) : null}
            </section>
          ) : null}

          {activeTab === "costs" ? (
            <section className="grid gap-4 lg:grid-cols-2">
              <FieldCostForm detail={detail} locked={fieldLocked} isSubmitting={pendingAction === "update"} onSubmit={onUpdate} />
              <MaterialsForm
                detail={detail}
                locked={fieldLocked}
                pendingAction={materialPendingAction}
                onCreate={onMaterialCreate}
                onUpdate={onMaterialUpdate}
                onDelete={onMaterialDelete}
              />
            </section>
          ) : null}

          {activeTab === "files" ? (
            <FieldDocumentUploadForm
              detail={detail}
              locked={fieldLocked}
              isUploading={pendingAction === "upload"}
              deletingFileId={deletingFileId}
              onSubmit={onUpload}
              onDelete={onFileDelete}
            />
          ) : null}

          {activeTab === "payment" ? (
            canCollectPayment ? (
              <PaymentForm detail={detail} onSubmit={onPayment} isSubmitting={pendingAction === "payment"} allowFieldPayment />
            ) : (
              <PaymentSummary detail={detail} />
            )
          ) : null}

          {activeTab === "acceptance" ? (
            canSignAcceptance ? (
              <SignatureAcceptanceForm detail={detail} onAcceptance={onAcceptance} isSubmitting={pendingAction === "acceptance"} />
            ) : (
              <div className="modal-section">
                <h3 className="section-title">Nghiệm thu</h3>
                <p className="mt-2 text-sm leading-6 text-zinc-600">
                  {status === "completed" || detail.workOrder.accepted_at
                    ? `Đã nghiệm thu: ${dateTime(detail.workOrder.accepted_at)}`
                    : "Hoàn tất xử lý xong thì nút nghiệm thu sẽ hiện tại đây để khách ký xác nhận."}
                </p>
              </div>
            )
          ) : null}
        </div>
      </div>
    </Modal>
  );
}
