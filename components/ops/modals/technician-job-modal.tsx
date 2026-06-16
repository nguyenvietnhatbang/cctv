"use client";

import { FormEvent, useMemo, useState } from "react";
import {
  CalendarClock,
  CheckCircle2,
  ClipboardCheck,
  MapPinned,
  Navigation,
  PauseCircle,
  Phone,
  Play,
  Save,
  type LucideIcon,
} from "lucide-react";
import {
  getAllowedWorkOrderTransitions,
  WORK_ORDER_STATUS_DESCRIPTIONS,
  WORK_ORDER_STATUS_LABELS,
  WORK_ORDER_TYPE_LABELS,
  type WorkOrderStatus,
} from "@/lib/types";
import { dateTime } from "@/components/ops/format";
import { mapSearchUrl } from "@/components/ops/app-utils";
import { DeadlineBadge, Modal, PendingButton, StageBadge, StatusBadge, ValidatedForm } from "@/components/ops/ui";
import type { Material, WorkFile, WorkOrderDetail } from "@/components/ops/types";
import { FileUploadForm } from "@/components/ops/modals/file-upload-form";
import { MaterialsForm } from "@/components/ops/modals/materials-form";
import { SignatureAcceptanceForm } from "@/components/ops/modals/signature-acceptance-form";

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

function stepIndex(status: WorkOrderStatus) {
  const index = STEP_ORDER.indexOf(status);
  if (index >= 0) return index;
  if (["awaiting_payment", "paid", "debt"].includes(status)) return STEP_ORDER.length;
  return -1;
}

export function TechnicianJobModal({
  detail,
  onClose,
  onStatus,
  onUpdate,
  onMaterialCreate,
  onMaterialUpdate,
  onMaterialDelete,
  onUpload,
  onFileDelete,
  onAcceptance,
  pendingAction = null,
  materialPendingAction = null,
  deletingFileId = null,
}: {
  detail: WorkOrderDetail;
  onClose: () => void;
  onStatus: (status: WorkOrderStatus, payload?: { checkInLat?: number; checkInLng?: number; note?: string | null }) => void | Promise<void>;
  onUpdate: (event: FormEvent<HTMLFormElement>) => void | Promise<void>;
  onMaterialCreate: (event: FormEvent<HTMLFormElement>) => void | Promise<void>;
  onMaterialUpdate: (material: Material, event: FormEvent<HTMLFormElement>) => void | Promise<void>;
  onMaterialDelete: (material: Material) => void | Promise<void>;
  onUpload: (event: FormEvent<HTMLFormElement>) => void | Promise<void>;
  onFileDelete: (file: WorkFile) => void | Promise<void>;
  onAcceptance: (payload: { acceptanceName: string; acceptancePhone: string | null; signatureDataUrl: string }) => void | Promise<void>;
  pendingAction?: string | null;
  materialPendingAction?: { type: "create" } | { type: "update" | "delete"; id: string } | null;
  deletingFileId?: string | null;
}) {
  const [preparingStatus, setPreparingStatus] = useState(false);
  const [locationWarning, setLocationWarning] = useState<string | null>(null);
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
  const fieldLocked = FIELD_LOCKED_STATUSES.includes(status);
  const currentStepIndex = stepIndex(status);
  const canSignAcceptance = status === "awaiting_acceptance";
  const canMoveNext = Boolean(nextFieldTransition);
  const canCheckout = Boolean(checkoutTransition);
  const canResume = Boolean(resumeTransition);
  const nextStatus = nextFieldTransition?.status ?? null;
  const NextIcon = nextStatus ? ACTION_ICONS[nextStatus] ?? Play : ClipboardCheck;

  async function handleNextStatus() {
    if (!nextFieldTransition) return;
    setPreparingStatus(true);
    setLocationWarning(null);
    try {
      const checkIn = nextFieldTransition.status === "working" ? await getCurrentPosition() : null;
      if (nextFieldTransition.status === "working" && !checkIn) {
        setLocationWarning("Không lấy được vị trí check-in. Hệ thống vẫn lưu trạng thái, nhưng chưa có tọa độ.");
      }
      await onStatus(nextFieldTransition.status, checkIn ?? undefined);
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

        <section className="modal-section">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="section-title">Bước hiện tại</h3>
              <p className="mt-1 text-sm leading-6 text-zinc-600">{WORK_ORDER_STATUS_DESCRIPTIONS[status]}</p>
            </div>
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

          <div className="mt-4 grid gap-2 sm:grid-cols-3 lg:grid-cols-6">
            {STEP_ORDER.map((step, index) => {
              const isCurrent = status === step;
              const isDone = currentStepIndex > index;
              return (
                <div
                  key={step}
                  className={`rounded-md border px-3 py-2 text-xs font-semibold ${
                    isCurrent
                      ? "border-zinc-900 bg-zinc-950 text-white"
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
        </section>

        <div className="grid gap-4 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
          <section className="grid gap-4">
            <div className="modal-section">
              <h3 className="section-title">Thông tin đi làm</h3>
              <div className="mt-3 grid gap-3 text-sm text-zinc-700">
                <p className="flex items-start gap-2">
                  <MapPinned size={15} className="mt-0.5 shrink-0 text-zinc-500" />
                  <span>{detail.workOrder.customer_address}</span>
                </p>
                <p className="flex items-center gap-2">
                  <CalendarClock size={15} className="shrink-0 text-zinc-500" />
                  <span>{dateTime(detail.workOrder.appointment_at ?? detail.workOrder.created_at)}</span>
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

            {canSignAcceptance ? (
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
            )}
          </section>

          <section className="grid gap-4">
            <FileUploadForm
              detail={detail}
              locked={fieldLocked}
              onSubmit={onUpload}
              onDelete={onFileDelete}
              isUploading={pendingAction === "upload"}
              deletingFileId={deletingFileId}
            />
            <MaterialsForm
              detail={detail}
              locked={fieldLocked}
              onCreate={onMaterialCreate}
              onUpdate={onMaterialUpdate}
              onDelete={onMaterialDelete}
              pendingAction={materialPendingAction}
            />
          </section>
        </div>

        {!canMoveNext && !canSignAcceptance && status !== "completed" && !["awaiting_payment", "paid", "debt", "paused", "cancelled"].includes(status) ? (
          <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
            Phiếu chưa có thao tác kế tiếp cho kỹ thuật viên. Admin cần kiểm tra lại trạng thái hoặc phân công.
          </p>
        ) : null}
      </div>
    </Modal>
  );
}
