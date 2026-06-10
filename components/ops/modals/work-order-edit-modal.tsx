"use client";

import { FormEvent, useState } from "react";
import { CalendarClock, CheckCircle2, ClipboardList, CreditCard, FileBox, MapPinned, Phone, ReceiptText, XCircle, type LucideIcon } from "lucide-react";
import { getAllowedWorkOrderTransitions, NEXT_STATUS_ACTIONS, WORK_ORDER_STATUS_DESCRIPTIONS, WORK_ORDER_STATUS_LABELS, WORK_ORDER_TYPE_LABELS } from "@/lib/types";
import { dateTime, inputDate } from "@/components/ops/format";
import { DeadlineBadge, Modal, PendingButton, StatusBadge, ValidatedForm } from "@/components/ops/ui";
import type { Material, Role, Technician, WorkFile, WorkOrderDetail, WorkOrderStatus } from "@/components/ops/types";
import { AssignmentForm } from "@/components/ops/modals/assignment-form";
import { CostNoteForm } from "@/components/ops/modals/cost-note-form";
import { FileUploadForm } from "@/components/ops/modals/file-upload-form";
import { MaterialsForm } from "@/components/ops/modals/materials-form";
import { PaymentForm } from "@/components/ops/modals/payment-form";
import { SignatureAcceptanceForm } from "@/components/ops/modals/signature-acceptance-form";

type EditTab = "basic" | "workflow" | "costs" | "resources" | "payment";

const tabs: ReadonlyArray<{ id: EditTab; label: string; icon: LucideIcon }> = [
  { id: "basic", label: "Cơ bản", icon: ClipboardList },
  { id: "workflow", label: "Điều phối", icon: MapPinned },
  { id: "costs", label: "Chi phí", icon: ReceiptText },
  { id: "resources", label: "Tệp & vật tư", icon: FileBox },
  { id: "payment", label: "Thanh toán", icon: CreditCard },
];

const technicianTabs: ReadonlyArray<{ id: EditTab; label: string; icon: LucideIcon }> = [
  { id: "basic", label: "Việc", icon: ClipboardList },
  { id: "workflow", label: "Tiến độ", icon: MapPinned },
  { id: "resources", label: "Ảnh & vật tư", icon: FileBox },
  { id: "costs", label: "Ghi chú/chi phí", icon: ReceiptText },
  { id: "payment", label: "Nghiệm thu", icon: CheckCircle2 },
];

const FINANCIAL_LOCKED_STATUSES: WorkOrderStatus[] = ["completed", "paid", "debt", "cancelled"];

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

export function WorkOrderEditModal({
  detail,
  role,
  technicians,
  onClose,
  onStatus,
  onCancel,
  onAssign,
  onUpdate,
  onMaterialCreate,
  onMaterialUpdate,
  onMaterialDelete,
  onUpload,
  onFileDelete,
  onPayment,
  onAcceptance,
  pendingAction = null,
  materialPendingAction = null,
  deletingFileId = null,
}: {
  detail: WorkOrderDetail;
  role: Role;
  technicians: Technician[];
  onClose: () => void;
  onStatus: (status: WorkOrderStatus, checkIn?: { checkInLat?: number; checkInLng?: number }) => void | Promise<void>;
  onCancel: (event: FormEvent<HTMLFormElement>) => void | Promise<void>;
  onAssign: (event: FormEvent<HTMLFormElement>) => void | Promise<void>;
  onUpdate: (event: FormEvent<HTMLFormElement>) => void | Promise<void>;
  onMaterialCreate: (event: FormEvent<HTMLFormElement>) => void | Promise<void>;
  onMaterialUpdate: (material: Material, event: FormEvent<HTMLFormElement>) => void | Promise<void>;
  onMaterialDelete: (material: Material) => void | Promise<void>;
  onUpload: (event: FormEvent<HTMLFormElement>) => void | Promise<void>;
  onFileDelete: (file: WorkFile) => void | Promise<void>;
  onPayment: (event: FormEvent<HTMLFormElement>) => void | Promise<void>;
  onAcceptance: (payload: { acceptanceName: string; acceptancePhone: string | null; signatureDataUrl: string }) => void | Promise<void>;
  pendingAction?: string | null;
  materialPendingAction?: { type: "create" } | { type: "update" | "delete"; id: string } | null;
  deletingFileId?: string | null;
}) {
  const [activeTab, setActiveTab] = useState<EditTab>("basic");
  const [preparingStatus, setPreparingStatus] = useState(false);
  const nextAction = NEXT_STATUS_ACTIONS[detail.workOrder.status] ?? null;
  const canNext = nextAction?.roles.includes(role) ?? false;
  const canAssign = ["admin", "dispatcher"].includes(role)
    && ["pending_assignment", "assigned", "accepted", "traveling", "working", "awaiting_acceptance"].includes(detail.workOrder.status);
  const canPay = ["admin", "dispatcher", "accountant"].includes(role);
  const allowedTransitions = getAllowedWorkOrderTransitions(detail.workOrder.status, role);
  const canCancel = allowedTransitions.some((transition) => transition.status === "cancelled");
  const financialLocked = FINANCIAL_LOCKED_STATUSES.includes(detail.workOrder.status) && role !== "admin";
  const signatureFile = detail.files.find((file) => file.purpose === "signature");
  const visibleTabs = role === "technician" ? technicianTabs : tabs;

  async function handleNextStatus() {
    if (!nextAction) return;
    setPreparingStatus(true);
    try {
      const checkIn = nextAction.status === "working" ? await getCurrentPosition() : null;
      setPreparingStatus(false);
      await onStatus(nextAction.status, checkIn ?? undefined);
    } finally {
      setPreparingStatus(false);
    }
  }

  return (
    <Modal title={`${role === "technician" ? "Xử lý phiếu" : "Sửa phiếu"} ${detail.workOrder.code}`} size="xl" onClose={onClose}>
      <div className="grid gap-4">
        <section className="modal-summary">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge order={detail.workOrder} />
            <DeadlineBadge order={detail.workOrder} />
            <span className="text-sm font-semibold text-zinc-500">{WORK_ORDER_TYPE_LABELS[detail.workOrder.type]}</span>
            <span className="text-sm font-semibold text-zinc-400">{detail.workOrder.code}</span>
          </div>
          <h3 className="mt-3 text-lg font-bold text-zinc-950">{detail.workOrder.customer_name}</h3>
          <p className="mt-2 text-sm text-zinc-500">Hẹn: {dateTime(detail.workOrder.appointment_at)}</p>
        </section>

        <nav className="modal-tabbar" aria-label={role === "technician" ? "Xử lý phiếu" : "Sửa phiếu"}>
          {visibleTabs.map((tab) => {
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

        <div className="modal-edit-shell">
          {activeTab === "basic" && role === "technician" ? (
            <section className="modal-section grid gap-4">
              <h3 className="section-title">Thông tin đi làm</h3>
              <div className="grid gap-3 rounded-md bg-zinc-50 p-3 text-sm text-zinc-700">
                <p className="font-semibold text-zinc-950">{detail.workOrder.description}</p>
                <p className="flex items-start gap-2">
                  <MapPinned size={15} className="mt-0.5 shrink-0 text-zinc-500" />
                  <span>{detail.workOrder.customer_address}</span>
                </p>
                <p className="flex items-center gap-2">
                  <CalendarClock size={15} className="shrink-0 text-zinc-500" />
                  <span>{dateTime(detail.workOrder.appointment_at ?? detail.workOrder.created_at)}</span>
                </p>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <a className="btn-primary h-11" href={`tel:${detail.workOrder.customer_phone}`}><Phone size={15} />Gọi khách</a>
                <a
                  className="btn-secondary h-11"
                  href={`https://maps.google.com/?q=${encodeURIComponent(detail.workOrder.customer_address)}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  <MapPinned size={15} />Bản đồ
                </a>
              </div>
              <ValidatedForm onSubmit={onUpdate} aria-busy={pendingAction === "update"} className="grid gap-3">
                <textarea
                  name="completionNote"
                  className="input min-h-28"
                  defaultValue={detail.workOrder.completion_note ?? ""}
                  placeholder="Ghi chú xử lý, phát sinh, nội dung đã làm"
                  disabled={pendingAction === "update"}
                />
                <div className="flex justify-end gap-2">
                  <button className="btn-secondary h-10" onClick={onClose} type="button">Đóng</button>
                  <PendingButton className="btn-primary h-10" type="submit" pending={pendingAction === "update"} pendingLabel="Đang lưu...">Lưu ghi chú</PendingButton>
                </div>
              </ValidatedForm>
            </section>
          ) : null}

          {activeTab === "basic" && role !== "technician" ? (
            <ValidatedForm onSubmit={onUpdate} aria-busy={pendingAction === "update"} className="modal-section grid gap-4">
              <h3 className="section-title">Thông tin cơ bản</h3>
              <fieldset disabled={pendingAction === "update"} className="contents">
                <div className="grid gap-3 md:grid-cols-2">
                  <textarea name="description" className="input min-h-24 md:col-span-2" defaultValue={detail.workOrder.description} placeholder="Mô tả" required />
                  <input name="appointmentAt" className="input" type="datetime-local" defaultValue={inputDate(detail.workOrder.appointment_at)} />
                  <input name="internalNote" className="input" defaultValue={detail.workOrder.internal_note ?? ""} placeholder="Ghi chú nội bộ" />
                  <textarea name="completionNote" className="input min-h-24 md:col-span-2" defaultValue={detail.workOrder.completion_note ?? ""} placeholder="Ghi chú hoàn thành" />
                </div>
                <div className="flex justify-end gap-2">
                  <button className="btn-secondary h-10" onClick={onClose} type="button">Đóng</button>
                  <PendingButton className="btn-primary h-10" type="submit" pending={pendingAction === "update"} pendingLabel="Đang lưu...">Lưu thông tin</PendingButton>
                </div>
              </fieldset>
            </ValidatedForm>
          ) : null}

          {activeTab === "workflow" ? (
            <section className="grid gap-4 lg:grid-cols-2">
              <div className="modal-section">
                <h3 className="section-title">Trạng thái hiện tại</h3>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <StatusBadge status={detail.workOrder.status} />
                  <span className="text-sm font-semibold text-zinc-900">{WORK_ORDER_STATUS_LABELS[detail.workOrder.status]}</span>
                </div>
                <p className="mt-2 text-sm leading-6 text-zinc-600">{WORK_ORDER_STATUS_DESCRIPTIONS[detail.workOrder.status]}</p>
              </div>
              {canNext && nextAction ? (
                <div className="modal-section">
                  <h3 className="section-title">Chuyển trạng thái</h3>
                  <p className="mt-2 text-sm leading-6 text-zinc-600">Thao tác tiếp theo theo đúng luồng xử lý của phiếu.</p>
                  <PendingButton className="btn-primary mt-3 h-10" onClick={handleNextStatus} type="button" pending={pendingAction === "status" || preparingStatus} pendingLabel={preparingStatus ? "Đang chuẩn bị..." : "Đang chuyển..."}>
                    <CheckCircle2 size={15} />{nextAction.label}
                  </PendingButton>
                </div>
              ) : null}
              {role === "technician" && !canNext ? (
                <div className="modal-section text-sm leading-6 text-zinc-600">
                  Phiếu hiện không có bước trạng thái tiếp theo cho kỹ thuật viên. Nếu đã xử lý xong, chuyển sang tab nghiệm thu để khách ký xác nhận.
                </div>
              ) : null}
              {canAssign ? <AssignmentForm detail={detail} technicians={technicians} onSubmit={onAssign} isSubmitting={pendingAction === "assign"} /> : null}
              {canCancel ? (
                <ValidatedForm onSubmit={onCancel} aria-busy={pendingAction === "cancel"} className="rounded-md border border-red-200 bg-red-50 p-4 lg:col-span-2">
                  <h3 className="section-title text-red-900">Hủy phiếu</h3>
                  <div className="mt-3 grid gap-2 md:grid-cols-[1fr_auto]">
                    <input name="note" className="input" placeholder="Lý do hủy phiếu" required disabled={pendingAction === "cancel"} />
                    <PendingButton className="btn-danger h-11" type="submit" pending={pendingAction === "cancel"} pendingLabel="Đang hủy..."><XCircle size={15} />Hủy phiếu</PendingButton>
                  </div>
                </ValidatedForm>
              ) : null}
            </section>
          ) : null}

          {activeTab === "costs" ? (
            <CostNoteForm detail={detail} financialLocked={financialLocked} onSubmit={onUpdate} isSubmitting={pendingAction === "update"} />
          ) : null}

          {activeTab === "resources" ? (
            <section className="grid gap-4 lg:grid-cols-2">
              <FileUploadForm detail={detail} locked={financialLocked} onSubmit={onUpload} onDelete={onFileDelete} isUploading={pendingAction === "upload"} deletingFileId={deletingFileId} />
              <MaterialsForm
                detail={detail}
                locked={financialLocked}
                onCreate={onMaterialCreate}
                onUpdate={onMaterialUpdate}
                onDelete={onMaterialDelete}
                pendingAction={materialPendingAction}
              />
            </section>
          ) : null}

          {activeTab === "payment" ? (
            <section className="grid gap-4 lg:grid-cols-2">
              {canPay ? <PaymentForm detail={detail} onSubmit={onPayment} isSubmitting={pendingAction === "payment"} /> : null}
              {detail.workOrder.status === "awaiting_acceptance" ? (
                <SignatureAcceptanceForm detail={detail} onAcceptance={onAcceptance} isSubmitting={pendingAction === "acceptance"} />
              ) : detail.workOrder.accepted_at ? (
                <div className="rounded-md border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
                  <p className="font-semibold">Đã nghiệm thu: {dateTime(detail.workOrder.accepted_at)}</p>
                  {signatureFile?.signed_url ? <a className="mt-2 inline-flex font-semibold underline" href={signatureFile.signed_url} target="_blank" rel="noreferrer">Xem chữ ký</a> : null}
                </div>
              ) : (
                <div className="modal-section text-sm text-zinc-600">
                  Phiếu chưa tới bước nghiệm thu.
                </div>
              )}
            </section>
          ) : null}
        </div>
      </div>
    </Modal>
  );
}
