"use client";

import { FormEvent, useState } from "react";
import { CheckCircle2, ClipboardList, CreditCard, FileBox, MapPinned, ReceiptText, XCircle, type LucideIcon } from "lucide-react";
import { NEXT_STATUS_ACTIONS, WORK_ORDER_TYPE_LABELS } from "@/lib/types";
import { dateTime, inputDate } from "@/components/ops/format";
import { Modal, StatusBadge } from "@/components/ops/ui";
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
}: {
  detail: WorkOrderDetail;
  role: Role;
  technicians: Technician[];
  onClose: () => void;
  onStatus: (status: WorkOrderStatus, checkIn?: { checkInLat?: number; checkInLng?: number }) => void;
  onCancel: (event: FormEvent<HTMLFormElement>) => void;
  onAssign: (event: FormEvent<HTMLFormElement>) => void;
  onUpdate: (event: FormEvent<HTMLFormElement>) => void;
  onMaterialCreate: (event: FormEvent<HTMLFormElement>) => void;
  onMaterialUpdate: (material: Material, event: FormEvent<HTMLFormElement>) => void;
  onMaterialDelete: (material: Material) => void;
  onUpload: (event: FormEvent<HTMLFormElement>) => void;
  onFileDelete: (file: WorkFile) => void;
  onPayment: (event: FormEvent<HTMLFormElement>) => void;
  onAcceptance: (payload: { acceptanceName: string; acceptancePhone: string | null; signatureDataUrl: string }) => void;
}) {
  const [activeTab, setActiveTab] = useState<EditTab>("basic");
  const nextAction = NEXT_STATUS_ACTIONS[detail.workOrder.status] ?? null;
  const canNext = nextAction?.roles.includes(role) ?? false;
  const canAssign = ["admin", "dispatcher"].includes(role);
  const canPay = ["admin", "dispatcher", "accountant"].includes(role);
  const canCancel = ["admin", "dispatcher"].includes(role)
    && !["completed", "paid", "debt", "cancelled"].includes(detail.workOrder.status);
  const financialLocked = FINANCIAL_LOCKED_STATUSES.includes(detail.workOrder.status) && role !== "admin";
  const signatureFile = detail.files.find((file) => file.purpose === "signature");

  async function handleNextStatus() {
    if (!nextAction) return;
    const checkIn = nextAction.status === "working" ? await getCurrentPosition() : null;
    onStatus(nextAction.status, checkIn ?? undefined);
  }

  return (
    <Modal title={`Sửa phiếu ${detail.workOrder.code}`} size="xl" onClose={onClose}>
      <div className="grid gap-4">
        <section className="rounded-md border border-zinc-200 p-4">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={detail.workOrder.status} />
            <span className="text-sm font-semibold text-zinc-500">{WORK_ORDER_TYPE_LABELS[detail.workOrder.type]}</span>
          </div>
          <h3 className="mt-3 text-lg font-bold text-zinc-950">{detail.workOrder.customer_name}</h3>
          <p className="mt-2 text-sm text-zinc-500">Hẹn: {dateTime(detail.workOrder.appointment_at)}</p>
        </section>

        <nav className="flex gap-2 overflow-x-auto" aria-label="Sửa phiếu">
          {tabs.map((tab) => {
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

        {activeTab === "basic" ? (
          <form onSubmit={onUpdate} className="grid gap-4 rounded-md border border-zinc-200 p-4">
            <h3 className="section-title">Thông tin cơ bản</h3>
            <div className="grid gap-3 md:grid-cols-2">
              <textarea name="description" className="input min-h-24 md:col-span-2" defaultValue={detail.workOrder.description} placeholder="Mô tả" required />
              <input name="appointmentAt" className="input" type="datetime-local" defaultValue={inputDate(detail.workOrder.appointment_at)} />
              <input name="internalNote" className="input" defaultValue={detail.workOrder.internal_note ?? ""} placeholder="Ghi chú nội bộ" />
              <textarea name="completionNote" className="input min-h-24 md:col-span-2" defaultValue={detail.workOrder.completion_note ?? ""} placeholder="Ghi chú hoàn thành" />
            </div>
            <div className="flex justify-end gap-2">
              <button className="btn-secondary h-10" onClick={onClose} type="button">Đóng</button>
              <button className="btn-primary h-10" type="submit">Lưu thông tin</button>
            </div>
          </form>
        ) : null}

        {activeTab === "workflow" ? (
          <section className="grid gap-4 lg:grid-cols-2">
            {canNext && nextAction ? (
              <div className="rounded-md border border-zinc-200 p-4">
                <h3 className="section-title">Chuyển trạng thái</h3>
                <p className="mt-2 text-sm leading-6 text-zinc-600">Thao tác tiếp theo theo đúng luồng xử lý của phiếu.</p>
                <button className="btn-primary mt-3 h-10" onClick={handleNextStatus} type="button">
                  <CheckCircle2 size={15} />{nextAction.label}
                </button>
              </div>
            ) : null}
            {canAssign ? <AssignmentForm detail={detail} technicians={technicians} onSubmit={onAssign} /> : null}
            {canCancel ? (
              <form onSubmit={onCancel} className="rounded-md border border-red-200 bg-red-50 p-4 lg:col-span-2">
                <h3 className="section-title text-red-900">Hủy phiếu</h3>
                <div className="mt-3 grid gap-2 md:grid-cols-[1fr_auto]">
                  <input name="note" className="input" placeholder="Lý do hủy phiếu" required />
                  <button className="btn-danger h-11" type="submit"><XCircle size={15} />Hủy phiếu</button>
                </div>
              </form>
            ) : null}
          </section>
        ) : null}

        {activeTab === "costs" ? (
          <CostNoteForm detail={detail} financialLocked={financialLocked} onSubmit={onUpdate} />
        ) : null}

        {activeTab === "resources" ? (
          <section className="grid gap-4 lg:grid-cols-2">
            <FileUploadForm detail={detail} locked={financialLocked} onSubmit={onUpload} onDelete={onFileDelete} />
            <MaterialsForm
              detail={detail}
              locked={financialLocked}
              onCreate={onMaterialCreate}
              onUpdate={onMaterialUpdate}
              onDelete={onMaterialDelete}
            />
          </section>
        ) : null}

        {activeTab === "payment" ? (
          <section className="grid gap-4 lg:grid-cols-2">
            {canPay ? <PaymentForm detail={detail} onSubmit={onPayment} /> : null}
            {detail.workOrder.status === "awaiting_acceptance" ? (
              <SignatureAcceptanceForm detail={detail} onAcceptance={onAcceptance} />
            ) : detail.workOrder.accepted_at ? (
              <div className="rounded-md border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
                <p className="font-semibold">Đã nghiệm thu: {dateTime(detail.workOrder.accepted_at)}</p>
                {signatureFile?.signed_url ? <a className="mt-2 inline-flex font-semibold underline" href={signatureFile.signed_url} target="_blank" rel="noreferrer">Xem chữ ký</a> : null}
              </div>
            ) : (
              <div className="rounded-md border border-zinc-200 p-4 text-sm text-zinc-600">
                Phiếu chưa tới bước nghiệm thu.
              </div>
            )}
          </section>
        ) : null}
      </div>
    </Modal>
  );
}
