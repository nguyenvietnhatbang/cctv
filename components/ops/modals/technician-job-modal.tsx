"use client";

import { FormEvent, useMemo, useState } from "react";
import {
  CalendarClock,
  CheckCircle2,
  ClipboardCheck,
  FileBox,
  MapPinned,
  Navigation,
  PauseCircle,
  Phone,
  Play,
  ReceiptText,
  Save,
  Upload,
  Wrench,
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
const CHECK_IN_RADIUS_METERS = 300;

type TechnicianModalTab = "progress" | "costs" | "files" | "acceptance";
type CheckInPayload = {
  checkInLat: number;
  checkInLng: number;
  updateCustomerLocation?: boolean;
  note?: string | null;
};

const TECHNICIAN_MODAL_TABS: ReadonlyArray<{ id: TechnicianModalTab; label: string; icon: LucideIcon }> = [
  { id: "progress", label: "Tiến độ", icon: ClipboardCheck },
  { id: "costs", label: "Chi phí", icon: ReceiptText },
  { id: "files", label: "Ảnh", icon: FileBox },
  { id: "acceptance", label: "Nghiệm thu & TT", icon: CheckCircle2 },
];

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

function distanceInMeters(
  from: { lat: number; lng: number },
  to: { lat: number; lng: number },
) {
  const earthRadius = 6_371_000;
  const toRadians = (value: number) => value * Math.PI / 180;
  const latitudeDistance = toRadians(to.lat - from.lat);
  const longitudeDistance = toRadians(to.lng - from.lng);
  const fromLatitude = toRadians(from.lat);
  const toLatitude = toRadians(to.lat);
  const haversine = Math.sin(latitudeDistance / 2) ** 2
    + Math.cos(fromLatitude) * Math.cos(toLatitude) * Math.sin(longitudeDistance / 2) ** 2;
  return earthRadius * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
}

function stepIndex(status: WorkOrderStatus) {
  const index = STEP_ORDER.indexOf(status);
  if (index >= 0) return index;
  if (["awaiting_payment", "paid", "debt"].includes(status)) return STEP_ORDER.length;
  return -1;
}

function FieldCostForm({
  detail,
  locked,
  isSubmitting,
  onSubmit,
  onOpenMaterials,
}: {
  detail: WorkOrderDetail;
  locked: boolean;
  isSubmitting: boolean;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void | Promise<void>;
  onOpenMaterials: () => void;
}) {
  const materialAmount = Number(detail.workOrder.material_amount);
  const vatAmount = Number(detail.workOrder.vat_amount);
  const totalAmount = Number(detail.workOrder.total_amount);
  const laborAmount = Number(detail.workOrder.labor_cost);

  return (
    <ValidatedForm onSubmit={onSubmit} aria-busy={isSubmitting} className="modal-section">
      <h3 className="section-title">Chi phí</h3>
      {locked ? (
        <p className="mt-2 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">Chi phí đã khóa sau nghiệm thu/thanh toán.</p>
      ) : null}
      <div className="mt-3 grid gap-3">
        <label className="grid gap-1 text-xs font-semibold text-zinc-600">
          Chi phí vật tư đã chốt
          <MoneyInput name="materialCost" className="input" defaultValue={Number(detail.workOrder.material_amount)} placeholder="VD: 500.000" disabled={locked || isSubmitting} />
        </label>
        <label className="grid gap-1 text-xs font-semibold text-zinc-600">
          Chi phí nhân công
          <MoneyInput name="laborCost" className="input" defaultValue={Number(detail.workOrder.labor_cost)} placeholder="VD: 200.000" disabled={locked || isSubmitting} />
        </label>
        <label className="grid gap-1 text-xs font-semibold text-zinc-600">
          VAT (%) — không bắt buộc
          <input name="vatRate" className="input" type="number" min="0" max="100" step="0.1" defaultValue={Number(detail.workOrder.vat_rate) || undefined} placeholder="Để trống nếu không có VAT" disabled={locked || isSubmitting} />
        </label>
      </div>
      <div className="flex gap-2">
        <PendingButton className="btn-primary mt-3 h-10 flex-1" type="submit" disabled={locked} pending={isSubmitting} pendingLabel="Đang lưu...">
          <Save size={15} />Lưu chi phí
        </PendingButton>
        <button
          className="btn-secondary mt-3 h-10 flex-1 flex items-center justify-center gap-1.5"
          onClick={onOpenMaterials}
          type="button"
        >
          <Wrench size={15} />Chi tiết vật tư
        </button>
      </div>
      <div className="mt-3 grid gap-2 rounded-md bg-zinc-50 p-3 text-sm text-zinc-700">
        <div className="flex items-center justify-between gap-3">
          <span>Chi phí vật tư</span>
          <strong className="text-zinc-950">{money(materialAmount)}</strong>
        </div>
        <div className="flex items-center justify-between gap-3">
          <span>Chi phí nhân công</span>
          <strong className="text-zinc-950">{money(laborAmount)}</strong>
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
  onAcceptance,
  pendingAction = null,
  materialPendingAction = null,
  deletingFileId = null,
}: {
  detail: WorkOrderDetail;
  onClose: () => void;
  onStatus: (status: WorkOrderStatus, payload?: Partial<CheckInPayload>) => void | Promise<void>;
  onUpdate: (event: FormEvent<HTMLFormElement>) => void | Promise<void>;
  onUpload: (event: FormEvent<HTMLFormElement>) => void | Promise<void>;
  onFileDelete: (file: WorkFile) => void | Promise<void>;
  onMaterialCreate: (event: FormEvent<HTMLFormElement>) => void | Promise<void>;
  onMaterialUpdate: (material: Material, event: FormEvent<HTMLFormElement>) => void | Promise<void>;
  onMaterialDelete: (material: Material) => void | Promise<void>;
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
  pendingAction?: string | null;
  materialPendingAction?: { type: "create" } | { type: "update" | "delete"; id: string } | null;
  deletingFileId?: string | null;
}) {
  const [preparingStatus, setPreparingStatus] = useState(false);
  const [locationWarning, setLocationWarning] = useState<string | null>(null);
  const [pendingLocationUpdate, setPendingLocationUpdate] = useState<{
    status: WorkOrderStatus;
    checkIn: CheckInPayload;
    distance: number;
  } | null>(null);
  const [activeTab, setActiveTab] = useState<TechnicianModalTab>("progress");
  const [showMaterialsModal, setShowMaterialsModal] = useState(false);
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
  const nextStatus = nextFieldTransition?.status ?? null;
  const NextIcon = nextStatus ? ACTION_ICONS[nextStatus] ?? Play : ClipboardCheck;

  async function checkInOrRequestLocationUpdate(nextCheckInStatus: WorkOrderStatus, checkIn: CheckInPayload) {
    const customerLat = detail.workOrder.customer_lat === null ? null : Number(detail.workOrder.customer_lat);
    const customerLng = detail.workOrder.customer_lng === null ? null : Number(detail.workOrder.customer_lng);

    if (customerLat !== null && customerLng !== null) {
      const distance = distanceInMeters(
        { lat: checkIn.checkInLat, lng: checkIn.checkInLng },
        { lat: customerLat, lng: customerLng },
      );
      if (distance > CHECK_IN_RADIUS_METERS) {
        setLocationWarning(
          `Vị trí hiện tại cách tọa độ khách hàng khoảng ${Math.round(distance)}m. Cần xác nhận cập nhật vị trí mới để tiếp tục check-in.`,
        );
        setPendingLocationUpdate({ status: nextCheckInStatus, checkIn, distance });
        return;
      }
    }

    await onStatus(nextCheckInStatus, checkIn);
  }

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
      if (checkIn) {
        await checkInOrRequestLocationUpdate(nextFieldTransition.status, checkIn);
      } else {
        await onStatus(nextFieldTransition.status);
      }
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
      await checkInOrRequestLocationUpdate("working", checkIn);
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

  async function confirmLocationUpdateAndCheckIn() {
    if (!pendingLocationUpdate) return;
    setPreparingStatus(true);
    setLocationWarning(null);
    try {
      await onStatus(pendingLocationUpdate.status, {
        ...pendingLocationUpdate.checkIn,
        updateCustomerLocation: true,
        note: `Xác nhận cập nhật tọa độ khách hàng khi check-in, lệch vị trí cũ khoảng ${Math.round(pendingLocationUpdate.distance)}m.`,
      });
      setPendingLocationUpdate(null);
    } catch (error) {
      setLocationWarning(getErrorMessage(error, "Không cập nhật được vị trí và check-in. Vui lòng thử lại."));
    } finally {
      setPreparingStatus(false);
    }
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
            <section className="max-w-xl mx-auto w-full">
              <FieldCostForm
                detail={detail}
                locked={fieldLocked}
                isSubmitting={pendingAction === "update"}
                onSubmit={onUpdate}
                onOpenMaterials={() => setShowMaterialsModal(true)}
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

          {activeTab === "acceptance" ? (
            canSignAcceptance ? (
              <SignatureAcceptanceForm detail={detail} allowPayment onAcceptance={onAcceptance} isSubmitting={pendingAction === "acceptance"} />
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
      {showMaterialsModal && (
        <Modal title="Chi tiết vật tư sử dụng" size="lg" onClose={() => setShowMaterialsModal(false)}>
          <div className="p-1">
            <MaterialsForm
              detail={detail}
              locked={fieldLocked}
              pendingAction={materialPendingAction}
              onCreate={onMaterialCreate}
              onUpdate={onMaterialUpdate}
              onDelete={onMaterialDelete}
            />
          </div>
        </Modal>
      )}
      {pendingLocationUpdate ? (
        <Modal title="Xác nhận thay đổi vị trí khách hàng" size="sm" onClose={() => setPendingLocationUpdate(null)}>
          <p className="text-sm leading-6 text-zinc-700">
            Vị trí hiện tại cách tọa độ khách hàng khoảng <strong>{Math.round(pendingLocationUpdate.distance)}m</strong>, vượt quá giới hạn {CHECK_IN_RADIUS_METERS}m.
          </p>
          <p className="mt-2 text-sm leading-6 text-zinc-600">
            Xác nhận sẽ thay tọa độ khách hàng bằng vị trí hiện tại và thực hiện check-in. Nếu hủy, tọa độ cũ được giữ nguyên và phiếu không được check-in.
          </p>
          <div className="mt-5 flex justify-end gap-2">
            <button className="btn-secondary h-10" type="button" onClick={() => setPendingLocationUpdate(null)} disabled={preparingStatus}>
              Không thay đổi
            </button>
            <PendingButton className="btn-primary h-10" type="button" onClick={confirmLocationUpdateAndCheckIn} pending={preparingStatus} pendingLabel="Đang cập nhật...">
              Cập nhật vị trí & check-in
            </PendingButton>
          </div>
        </Modal>
      ) : null}
    </Modal>
  );
}
