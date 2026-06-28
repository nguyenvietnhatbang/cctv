"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  History,
  MapPinned,
  Navigation,
  Phone,
  Play,
  Route,
  ShieldCheck,
  Wrench,
} from "lucide-react";
import { dateTime } from "@/components/ops/format";
import { mapSearchUrl } from "@/components/ops/app-utils";
import { DeadlineBadge, PendingButton, StageBadge, StatusBadge, Modal } from "@/components/ops/ui";
import type { WorkFile, WorkOrderListItem } from "@/components/ops/types";
import { WorkFileGallery } from "@/components/ops/work-file-gallery";
import {
  getAllowedWorkOrderTransitions,
  WORK_ORDER_STATUS_DESCRIPTIONS,
  WORK_ORDER_STATUS_ORDER,
  WORK_ORDER_TYPE_LABELS,
  type Role,
  type WorkOrderStatus,
  type WorkOrderType,
} from "@/lib/types";
import { apiFetch } from "@/components/ops/api";
import {
  CHECK_IN_RADIUS_METERS,
  checkInDistanceFromCustomer,
  getCurrentCheckInPosition,
  type CheckInCoordinates,
  type CheckInPayload,
} from "@/components/ops/check-in";
import { CheckInLocationModal } from "@/components/ops/check-in-location-modal";


const TECHNICIAN_WORK_STAGES: ReadonlyArray<{
  id: string;
  title: string;
  description: string;
  statuses: readonly WorkOrderStatus[];
}> = [
  { id: "assigned", title: "Cần nhận việc", description: "Phiếu đã giao, kỹ thuật viên cần xác nhận.", statuses: ["assigned"] },
  { id: "accepted", title: "Chuẩn bị di chuyển", description: "Đã nhận việc, chuẩn bị tới địa điểm khách.", statuses: ["accepted"] },
  { id: "traveling", title: "Đang di chuyển", description: "Đang tới địa điểm khách hàng.", statuses: ["traveling"] },
  { id: "working", title: "Đang thi công", description: "Đã check-in và đang xử lý tại hiện trường.", statuses: ["working"] },
  { id: "paused", title: "Tạm dừng", description: "Đã check-out, chờ tiếp tục xử lý.", statuses: ["paused"] },
  { id: "awaiting_acceptance", title: "Chờ nghiệm thu", description: "Đã xử lý xong, cần khách ký nghiệm thu.", statuses: ["awaiting_acceptance"] },
];

const ACTIVE_STATUSES = new Set<WorkOrderStatus>(TECHNICIAN_WORK_STAGES.flatMap((stage) => stage.statuses));
const DONE_STATUSES = new Set<WorkOrderStatus>(["completed", "awaiting_payment", "paid", "debt"]);
const TODO_STATUSES = new Set<WorkOrderStatus>(["pending_assignment", "assigned", "accepted", "traveling"]);

const TECHNICIAN_ACTION_ICONS: Partial<Record<WorkOrderStatus, typeof Play>> = {
  accepted: Navigation,
  traveling: MapPinned,
  working: CheckCircle2,
};

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function sortByNextWork(left: WorkOrderListItem, right: WorkOrderListItem) {
  const leftTime = left.appointment_at ? new Date(left.appointment_at).getTime() : Number.MAX_SAFE_INTEGER;
  const rightTime = right.appointment_at ? new Date(right.appointment_at).getTime() : Number.MAX_SAFE_INTEGER;
  return leftTime - rightTime || new Date(left.created_at).getTime() - new Date(right.created_at).getTime();
}

function formatAddress(address: string) {
  const parts = address.split(",").map((part) => part.trim()).filter(Boolean);
  if (parts.length <= 2) return address;
  return parts.slice(0, 2).join(", ");
}

function technicianStageIndex(status: WorkOrderStatus) {
  const index = TECHNICIAN_WORK_STAGES.findIndex((stage) => stage.statuses.includes(status));
  return index >= 0 ? index : WORK_ORDER_STATUS_ORDER[status];
}

function getTechnicianPrimaryAction(order: WorkOrderListItem, role: Role) {
  if (order.status === "working" && !order.own_assignment_check_in_at) {
    return { type: "status" as const, status: "working" as const, label: "Check-in", icon: MapPinned };
  }

  if (order.status === "awaiting_acceptance") {
    return { type: "edit" as const, label: "Nghiệm thu", icon: ClipboardCheck };
  }

  const transition = getAllowedWorkOrderTransitions(order.status, role)
    .find((item) => item.intent === "field");
  if (!transition) {
    return { type: "edit" as const, label: "Chi tiết", icon: Wrench };
  }

  return {
    type: "status" as const,
    status: transition.status,
    label: transition.label,
    icon: TECHNICIAN_ACTION_ICONS[transition.status] ?? Play,
  };
}

function MiniOrderRow({
  order,
  onView,
}: {
  order: WorkOrderListItem;
  onView: (id: string) => void;
}) {
  return (
    <button
      className="grid w-full gap-1 rounded-md border border-zinc-200 bg-white p-3 text-left transition hover:border-zinc-300 hover:bg-zinc-50"
      onClick={() => onView(order.id)}
      type="button"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-bold uppercase text-zinc-500">{order.code}</span>
        <div className="flex flex-wrap justify-end gap-1.5">
          <StageBadge status={order.status} />
          <StatusBadge order={order} />
          <DeadlineBadge order={order} />
        </div>
      </div>
      <p className="truncate text-sm font-semibold text-zinc-950">{order.customer_name}</p>
      <p className="truncate text-xs text-zinc-500">Hẹn: {dateTime(order.appointment_at)}</p>
    </button>
  );
}

function TechnicianWorkCard({
  order,
  prominent = false,
  pending = false,
  actionError = null,
  onEdit,
  onNextAction,
  onCheckIn,
  onHistory,
  role,
}: {
  order: WorkOrderListItem;
  prominent?: boolean;
  pending?: boolean;
  actionError?: string | null;
  onEdit: (id: string) => void;
  onNextAction: (order: WorkOrderListItem) => void;
  onCheckIn: (order: WorkOrderListItem) => void;
  onHistory: (customerId: string, customerName: string) => void;
  role: Role;
}) {
  const action = getTechnicianPrimaryAction(order, role);
  const ActionIcon = action.icon;
  const appointmentLabel = dateTime(order.appointment_at);
  const canQuickCheckIn = order.status === "assigned" || order.status === "accepted";

  return (
    <article className={`mobile-job grid min-w-0 gap-4 overflow-hidden ${prominent ? "border-blue-300 ring-2 ring-blue-600" : ""}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-xs font-bold uppercase text-zinc-500">{order.code}</p>
            <span className="rounded bg-zinc-100 px-2 py-0.5 text-[11px] font-semibold text-zinc-700">
              {WORK_ORDER_TYPE_LABELS[order.type]}
            </span>
            {order.priority === "urgent" ? (
              <span className="inline-flex items-center gap-1 rounded bg-red-50 px-2 py-0.5 text-[11px] font-bold text-red-700 ring-1 ring-red-200">
                <AlertTriangle size={12} />Gấp
              </span>
            ) : null}
          </div>
          <h2 className="mt-1 truncate text-xl font-bold text-zinc-950">{order.customer_name}</h2>
        </div>
        <div className="flex flex-wrap justify-end gap-1.5">
          <StageBadge status={order.status} />
          <StatusBadge order={order} />
          <DeadlineBadge order={order} />
        </div>
      </div>
      <div className="grid gap-2 rounded-md bg-zinc-50 p-3 text-sm text-zinc-700">
        <p className="line-clamp-2 font-medium text-zinc-900">{order.description}</p>
        <p className="text-xs font-medium text-zinc-500">{WORK_ORDER_STATUS_DESCRIPTIONS[order.status]}</p>
        <p className="flex items-start gap-2">
          <MapPinned size={15} className="mt-0.5 shrink-0 text-zinc-500" />
          <span>{formatAddress(order.customer_address)}</span>
        </p>
        <p className="flex items-center gap-2">
          <CalendarClock size={15} className="shrink-0 text-zinc-500" />
          <span>{appointmentLabel}</span>
        </p>
      </div>

      <div className="mobile-job-actions">
        <PendingButton
          className="btn-primary mobile-job-primary-action"
          onClick={() => onNextAction(order)}
          type="button"
          pending={pending && action.type === "status"}
          pendingLabel="..."
        >
          <ActionIcon size={14} className="shrink-0" />
          <span className="truncate">{action.label}</span>
        </PendingButton>

        {canQuickCheckIn ? (
          <PendingButton
            className="btn-secondary"
            onClick={() => onCheckIn(order)}
            type="button"
            pending={pending}
            pendingLabel="..."
          >
            <MapPinned size={14} className="shrink-0" />
            <span className="truncate">Check-in</span>
          </PendingButton>
        ) : null}

        <button
          className="btn-secondary"
          onClick={() => onEdit(order.id)}
          type="button"
        >
          <Wrench size={14} className="shrink-0" />
          <span className="truncate">Chi tiết</span>
        </button>

        <a
          className="btn-primary"
          href={`tel:${order.customer_phone}`}
        >
          <Phone size={14} className="shrink-0" />
          <span className="truncate">Gọi</span>
        </a>

        <a
          className="btn-secondary"
          href={mapSearchUrl({ address: order.customer_address, lat: order.customer_lat, lng: order.customer_lng })}
          target="_blank"
          rel="noreferrer"
        >
          <MapPinned size={14} className="shrink-0" />
          <span className="truncate">Bản đồ</span>
        </a>

        <button
          className="btn-secondary"
          onClick={() => onHistory(order.customer_id, order.customer_name)}
          type="button"
        >
          <History size={14} className="shrink-0" />
          <span className="truncate">Lịch sử</span>
        </button>
      </div>

      {actionError ? (
        <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-medium leading-6 text-amber-900" role="alert">
          {actionError}
        </p>
      ) : null}
    </article>
  );
}

export function TechnicianScreen({
  role,
  orders,
  onView,
  onEdit,
  onStatus,
}: {
  role: Role;
  orders: WorkOrderListItem[];
  onView: (id: string) => void;
  onEdit: (id: string) => void;
  onStatus: (id: string, status: WorkOrderStatus, payload?: Partial<CheckInPayload>) => Promise<void>;
}) {
  const statusOperationRef = useRef(false);
  const [pendingStatusOrderId, setPendingStatusOrderId] = useState<string | null>(null);
  const [locationWarning, setLocationWarning] = useState<string | null>(null);
  const [statusSuccess, setStatusSuccess] = useState<string | null>(null);
  const [actionError, setActionError] = useState<{ orderId: string; message: string } | null>(null);
  const [pendingLocationUpdate, setPendingLocationUpdate] = useState<{
    order: WorkOrderListItem;
    checkIn: CheckInCoordinates;
    distance: number;
  } | null>(null);
  const [historyCustomer, setHistoryCustomer] = useState<{ id: string; name: string } | null>(null);

  const activeOrders = orders
    .filter((order) => ACTIVE_STATUSES.has(order.status))
    .sort((left, right) => technicianStageIndex(left.status) - technicianStageIndex(right.status) || sortByNextWork(left, right));
  const doneOrders = orders.filter((order) => DONE_STATUSES.has(order.status));
  const stageOrders = TECHNICIAN_WORK_STAGES.map((stage) => ({
    ...stage,
    orders: activeOrders.filter((order) => stage.statuses.includes(order.status)),
  }));
  const waitingSignatureOrders = orders.filter((order) => order.status === "awaiting_acceptance");
  const movingOrders = orders.filter((order) => ["accepted", "traveling"].includes(order.status));
  const workingOrders = orders.filter((order) => order.status === "working");
  const pausedOrders = orders.filter((order) => order.status === "paused");
  const todoOrders = orders.filter((order) => TODO_STATUSES.has(order.status));
  const assignedOrders = orders.filter((order) => order.status === "assigned");
  const nextOrder = activeOrders[0] ?? null;
  const isTeamLead = role === "team_lead";

  function startStatusOperation(orderId: string) {
    if (statusOperationRef.current) return false;
    statusOperationRef.current = true;
    setPendingStatusOrderId(orderId);
    setLocationWarning(null);
    setStatusSuccess(null);
    setActionError(null);
    return true;
  }

  function finishStatusOperation() {
    statusOperationRef.current = false;
    setPendingStatusOrderId(null);
  }

  async function performCheckIn(order: WorkOrderListItem) {
    if (!startStatusOperation(order.id)) return;
    try {
      const checkIn = await getCurrentCheckInPosition();
      const distance = checkInDistanceFromCustomer(order, checkIn);
      if (distance !== null && distance > CHECK_IN_RADIUS_METERS) {
        setPendingLocationUpdate({ order, checkIn, distance });
        return;
      }

      await onStatus(order.id, "working", checkIn);
      setStatusSuccess(`Đã check-in thành công phiếu ${order.code}.`);
    } catch (error) {
      const message = getErrorMessage(error, "Không check-in được. Vui lòng thử lại.");
      setLocationWarning(message);
      setActionError({ orderId: order.id, message });
    } finally {
      finishStatusOperation();
    }
  }

  async function runNextAction(order: WorkOrderListItem) {
    const action = getTechnicianPrimaryAction(order, role);
    if (action.type === "edit") {
      onEdit(order.id);
      return;
    }
    if (action.status === "working") {
      await performCheckIn(order);
      return;
    }

    if (!startStatusOperation(order.id)) return;
    try {
      await onStatus(order.id, action.status);
      setStatusSuccess(`Đã chuyển phiếu ${order.code} sang “${action.label}”.`);
    } catch (error) {
      const message = getErrorMessage(error, "Không cập nhật được trạng thái phiếu. Vui lòng thử lại.");
      setLocationWarning(message);
      setActionError({ orderId: order.id, message });
    } finally {
      finishStatusOperation();
    }
  }

  async function runCheckIn(order: WorkOrderListItem) {
    await performCheckIn(order);
  }

  async function confirmLocationUpdateAndCheckIn() {
    if (!pendingLocationUpdate || !startStatusOperation(pendingLocationUpdate.order.id)) return;
    const { order, checkIn, distance } = pendingLocationUpdate;
    try {
      await onStatus(order.id, "working", {
        ...checkIn,
        updateCustomerLocation: true,
        note: `Xác nhận cập nhật tọa độ khách hàng khi check-in, lệch vị trí cũ khoảng ${Math.round(distance)}m.`,
      });
      setPendingLocationUpdate(null);
      setStatusSuccess(`Đã cập nhật vị trí khách hàng và check-in thành công phiếu ${order.code}.`);
    } catch (error) {
      const message = getErrorMessage(error, "Không cập nhật được vị trí và check-in. Vui lòng thử lại.");
      setLocationWarning(message);
      setActionError({ orderId: order.id, message });
    } finally {
      finishStatusOperation();
    }
  }

  return (
    <section className="mx-auto grid w-full max-w-7xl gap-5">
      <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm lg:p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase text-zinc-500">{isTeamLead ? "Trưởng nhóm" : "Kỹ thuật viên"}</p>
            <h2 className="mt-1 text-2xl font-extrabold tracking-normal text-zinc-950 lg:text-3xl">Công việc</h2>
            <p className="mt-1 text-sm text-zinc-500">Theo dõi đúng luồng: nhận việc, di chuyển, check-in, hoàn tất và nghiệm thu.</p>
          </div>
          <Route className="mt-1 text-zinc-400" size={24} />
        </div>
        <div className={`mt-4 grid grid-cols-2 gap-2 ${isTeamLead ? "sm:grid-cols-3 xl:grid-cols-6" : "sm:grid-cols-5"} lg:gap-3`}>
          {isTeamLead ? (
            <div className="rounded-md border border-zinc-200 bg-zinc-50 p-3">
              <p className="text-[11px] font-bold uppercase text-zinc-500">Chưa làm</p>
              <p className="mt-1 text-2xl font-black text-zinc-950">{todoOrders.length}</p>
            </div>
          ) : null}
          <div className="rounded-md border border-zinc-200 bg-zinc-50 p-3">
            <p className="text-[11px] font-bold uppercase text-zinc-500">Cần nhận</p>
            <p className="mt-1 text-2xl font-black text-zinc-950">{assignedOrders.length}</p>
          </div>
          <div className="rounded-md border border-zinc-200 bg-zinc-50 p-3">
            <p className="text-[11px] font-bold uppercase text-zinc-500">Đã nhận/đang đi</p>
            <p className="mt-1 text-2xl font-black text-zinc-950">{movingOrders.length}</p>
          </div>
          <div className="rounded-md border border-zinc-200 bg-zinc-50 p-3">
            <p className="text-[11px] font-bold uppercase text-zinc-500">Thi công</p>
            <p className="mt-1 text-2xl font-black text-zinc-950">{workingOrders.length}</p>
          </div>
          <div className="rounded-md border border-zinc-200 bg-zinc-50 p-3">
            <p className="text-[11px] font-bold uppercase text-zinc-500">Chờ ký</p>
            <p className="mt-1 text-2xl font-black text-zinc-950">{waitingSignatureOrders.length}</p>
          </div>
          <div className="rounded-md border border-zinc-200 bg-zinc-50 p-3">
            <p className="text-[11px] font-bold uppercase text-zinc-500">{isTeamLead ? "Việc tạm dừng" : "Tạm dừng"}</p>
            <p className="mt-1 text-2xl font-black text-zinc-950">{pausedOrders.length}</p>
          </div>
        </div>
      </div>

      {statusSuccess ? (
        <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-800" role="status" aria-live="polite">
          {statusSuccess}
        </p>
      ) : null}
      {locationWarning ? (
        <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800" role="alert">
          {locationWarning}
        </p>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_380px] lg:items-start">
        <div className="grid gap-5">
          {nextOrder ? (
            <div className="grid gap-2">
              <div className="flex items-center gap-2">
                <Clock3 size={15} className="text-zinc-500" />
                <p className="text-xs font-bold uppercase text-zinc-700">Việc cần làm tiếp theo</p>
              </div>
              <TechnicianWorkCard role={role} order={nextOrder} prominent pending={pendingStatusOrderId === nextOrder.id} actionError={actionError?.orderId === nextOrder.id ? actionError.message : null} onEdit={onEdit} onNextAction={runNextAction} onCheckIn={runCheckIn} onHistory={(customerId, customerName) => setHistoryCustomer({ id: customerId, name: customerName })} />
            </div>
          ) : null}

          {stageOrders.map(({ id, title, description, orders: groupOrders }) => {
            const visibleOrders = groupOrders.filter((order) => order.id !== nextOrder?.id);
            if (visibleOrders.length === 0) return null;

            return (
              <div key={id} className="grid gap-2">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-zinc-800">{title}</h3>
                    <p className="mt-0.5 text-xs text-zinc-500">{description}</p>
                  </div>
                  <span className="text-xs font-semibold text-zinc-500">{visibleOrders.length} phiếu</span>
                </div>
                <div className="grid gap-3">
                  {visibleOrders.map((order) => (
                    <TechnicianWorkCard key={order.id} role={role} order={order} pending={pendingStatusOrderId === order.id} actionError={actionError?.orderId === order.id ? actionError.message : null} onEdit={onEdit} onNextAction={runNextAction} onCheckIn={runCheckIn} onHistory={(customerId, customerName) => setHistoryCustomer({ id: customerId, name: customerName })} />
                  ))}
                </div>
              </div>
            );
          })}
          {activeOrders.length === 0 ? (
            <div className="rounded-lg border border-dashed border-zinc-300 bg-white p-6 text-center">
              <ClipboardCheck className="mx-auto text-zinc-400" size={28} />
              <p className="mt-3 text-sm font-semibold text-zinc-800">Chưa có việc cần xử lý</p>
              <p className="mt-1 text-sm text-zinc-500">
                {orders.length === 0
                  ? "Khi admin hoặc điều phối giao phiếu cho đúng hồ sơ kỹ thuật viên của bạn, công việc sẽ xuất hiện ở đây."
                  : "Các phiếu đã xong vẫn nằm trong phần việc đã xong để tra cứu lại."}
              </p>
            </div>
          ) : null}
        </div>

        <aside className="grid gap-5">
          <section className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <h3 className="inline-flex items-center gap-2 text-sm font-bold text-zinc-950">
                <ShieldCheck size={16} />Tổng quan ca làm
              </h3>
              <span className="text-xs font-semibold text-zinc-500">{orders.length} phiếu</span>
            </div>
            <div className="mt-3 grid gap-2">
              {isTeamLead ? (
                <div className="flex items-center justify-between rounded-md bg-zinc-50 px-3 py-2 text-sm">
                  <span className="text-zinc-600">Chưa làm</span>
                  <strong className="text-zinc-950">{todoOrders.length}</strong>
                </div>
              ) : null}
              <div className="flex items-center justify-between rounded-md bg-zinc-50 px-3 py-2 text-sm">
                <span className="text-zinc-600">Cần nhận</span>
                <strong className="text-zinc-950">{assignedOrders.length}</strong>
              </div>
              <div className="flex items-center justify-between rounded-md bg-zinc-50 px-3 py-2 text-sm">
                <span className="text-zinc-600">Đã nhận / đang đi</span>
                <strong className="text-zinc-950">{movingOrders.length}</strong>
              </div>
              <div className="flex items-center justify-between rounded-md bg-zinc-50 px-3 py-2 text-sm">
                <span className="text-zinc-600">Đang thi công</span>
                <strong className="text-zinc-950">{workingOrders.length}</strong>
              </div>
              <div className="flex items-center justify-between rounded-md bg-zinc-50 px-3 py-2 text-sm">
                <span className="text-zinc-600">Chờ nghiệm thu</span>
                <strong className="text-zinc-950">{waitingSignatureOrders.length}</strong>
              </div>
              <div className="flex items-center justify-between rounded-md bg-zinc-50 px-3 py-2 text-sm">
                <span className="text-zinc-600">{isTeamLead ? "Việc tạm dừng" : "Tạm dừng"}</span>
                <strong className="text-zinc-950">{pausedOrders.length}</strong>
              </div>
            </div>
          </section>

          <section className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <h3 className="inline-flex items-center gap-2 text-sm font-bold text-zinc-950">
                <CheckCircle2 size={16} />Việc đã xong
              </h3>
              <span className="text-xs font-semibold text-zinc-500">{doneOrders.length}</span>
            </div>
            <div className="mt-3 grid gap-2">
              {doneOrders.slice(0, 5).map((order) => (
                <MiniOrderRow key={order.id} order={order} onView={onView} />
              ))}
              {doneOrders.length === 0 ? <p className="rounded-md bg-zinc-50 px-3 py-6 text-center text-sm text-zinc-500">Chưa có phiếu hoàn tất.</p> : null}
            </div>
          </section>

        </aside>
      </div>

      {historyCustomer && (
        <CustomerHistoryModal
          customerId={historyCustomer.id}
          customerName={historyCustomer.name}
          onClose={() => setHistoryCustomer(null)}
        />
      )}
      {pendingLocationUpdate ? (
        <CheckInLocationModal
          distance={pendingLocationUpdate.distance}
          pending={pendingStatusOrderId === pendingLocationUpdate.order.id}
          onCancel={() => setPendingLocationUpdate(null)}
          onConfirm={confirmLocationUpdateAndCheckIn}
        />
      ) : null}
    </section>
  );
}

type HistoryWorkOrder = {
  id: string;
  code: string;
  type: WorkOrderType;
  status: WorkOrderStatus;
  description: string;
  appointment_at: string | null;
  created_at: string;
  completion_note: string | null;
  internal_note: string | null;
  cancellation_reason: string | null;
  acceptance_name: string | null;
  acceptance_phone: string | null;
  accepted_at: string | null;
  technician_name: string;
  materials: Array<{ name: string; quantity: number | string }>;
  files: WorkFile[];
};

type CustomerHistoryResponse = {
  history: HistoryWorkOrder[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

const CUSTOMER_HISTORY_PAGE_SIZE = 80;

function CustomerHistoryModal({
  customerId,
  customerName,
  onClose,
}: {
  customerId: string;
  customerName: string;
  onClose: () => void;
}) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [historyList, setHistoryList] = useState<HistoryWorkOrder[]>([]);
  const [historyPage, setHistoryPage] = useState(1);
  const [historyTotal, setHistoryTotal] = useState(0);
  const [historyTotalPages, setHistoryTotalPages] = useState(1);
  const [loadingMore, setLoadingMore] = useState(false);
  const mountedRef = useRef(false);
  const requestIdRef = useRef(0);

  const loadHistoryPage = useCallback(async (page: number, append = false) => {
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    if (append) {
      setLoadingMore(true);
    } else {
      setLoading(true);
      setHistoryList([]);
    }
    setError(null);

    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(CUSTOMER_HISTORY_PAGE_SIZE),
      });
      const data = await apiFetch<CustomerHistoryResponse>(`/api/customers/${customerId}/history?${params.toString()}`);
      if (!mountedRef.current || requestId !== requestIdRef.current) return;
      setHistoryList((current) => append ? [...current, ...data.history] : data.history);
      setHistoryPage(data.page);
      setHistoryTotal(data.total);
      setHistoryTotalPages(data.totalPages);
    } catch (err) {
      if (!mountedRef.current || requestId !== requestIdRef.current) return;
      setError(err instanceof Error ? err.message : "Không tải được lịch sử khách hàng");
    } finally {
      if (!mountedRef.current || requestId !== requestIdRef.current) return;
      if (append) {
        setLoadingMore(false);
      } else {
        setLoading(false);
      }
    }
  }, [customerId]);

  useEffect(() => {
    mountedRef.current = true;
    void loadHistoryPage(1);
    return () => {
      mountedRef.current = false;
    };
  }, [loadHistoryPage]);

  const hasMoreHistory = historyPage < historyTotalPages;

  return (
    <Modal title={`Lịch sử kỹ thuật - ${customerName}`} onClose={onClose} size="lg">
      {loading ? (
        <div className="flex h-48 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-zinc-200 border-t-zinc-800" />
        </div>
      ) : error ? (
        <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          {error}
        </div>
      ) : historyList.length === 0 ? (
        <div className="p-8 text-center text-zinc-500 text-sm">
          Chưa có lịch sử công việc nào trước đây cho khách hàng này.
        </div>
      ) : (
        <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
          <div className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-2 border-b border-zinc-200 bg-white/95 py-2 text-xs font-semibold text-zinc-500 backdrop-blur">
            <span>Đã hiển thị {historyList.length} / {historyTotal} phiếu</span>
            {hasMoreHistory ? (
              <button
                className="btn-secondary h-8 px-2.5 text-xs"
                type="button"
                disabled={loadingMore}
                onClick={() => void loadHistoryPage(historyPage + 1, true)}
              >
                {loadingMore ? "Đang tải..." : "Tải thêm"}
              </button>
            ) : null}
          </div>
          {historyList.map((item) => (
            <div key={item.id} className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm transition hover:shadow-md">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-100 pb-2">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-extrabold uppercase tracking-wider text-blue-600">{item.code}</span>
                  <span className="rounded bg-blue-50 px-2 py-0.5 text-xs font-semibold text-blue-700 ring-1 ring-blue-100">
                    {WORK_ORDER_TYPE_LABELS[item.type]}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-xs text-zinc-500">
                  <span>Ngày: {dateTime(item.appointment_at || item.created_at)}</span>
                  <StageBadge status={item.status} />
                </div>
              </div>
              <div className="mt-3 space-y-3 text-sm">
                {(item.technician_name || item.acceptance_name) && (
                  <div className="grid gap-2 border-b border-zinc-100 pb-2.5 text-xs text-zinc-500 sm:grid-cols-2">
                    {item.technician_name && (
                      <div>
                        <span className="font-semibold text-zinc-700">Kỹ thuật thực hiện: </span>
                        <span className="text-zinc-900">{item.technician_name}</span>
                      </div>
                    )}
                    {item.acceptance_name && (
                      <div>
                        <span className="font-semibold text-zinc-700">Khách ký nghiệm thu: </span>
                        <span className="text-zinc-900">
                          {item.acceptance_name} {item.acceptance_phone ? `(${item.acceptance_phone})` : ""}
                        </span>
                      </div>
                    )}
                  </div>
                )}

                <div>
                  <h4 className="font-semibold text-zinc-800 flex items-center gap-1.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-zinc-400"></span>
                    Mô tả công việc
                  </h4>
                  <p className="mt-1 pl-3 text-zinc-600 whitespace-pre-wrap leading-relaxed">{item.description || "Không có mô tả"}</p>
                </div>

                {item.internal_note && (
                  <div>
                    <h4 className="font-semibold text-zinc-800 flex items-center gap-1.5">
                      <span className="h-1.5 w-1.5 rounded-full bg-blue-400"></span>
                      Ghi chú nội bộ
                    </h4>
                    <p className="mt-1 pl-3 text-zinc-600 whitespace-pre-wrap leading-relaxed">{item.internal_note}</p>
                  </div>
                )}

                {item.completion_note && (
                  <div>
                    <h4 className="font-semibold text-zinc-800 flex items-center gap-1.5">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
                      Ghi chú hoàn thành
                    </h4>
                    <p className="mt-1 pl-3 text-zinc-600 whitespace-pre-wrap leading-relaxed">{item.completion_note}</p>
                  </div>
                )}

                {item.cancellation_reason && (
                  <div>
                    <h4 className="font-semibold text-red-800 flex items-center gap-1.5">
                      <span className="h-1.5 w-1.5 rounded-full bg-red-600"></span>
                      Lý do hủy
                    </h4>
                    <p className="mt-1 pl-3 text-red-600 whitespace-pre-wrap leading-relaxed">{item.cancellation_reason}</p>
                  </div>
                )}

                <div>
                  <h4 className="font-semibold text-zinc-800 flex items-center gap-1.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-orange-400"></span>
                    Vật tư kỹ thuật đã lắp
                  </h4>
                  <div className="pl-3 mt-1.5">
                    {item.materials && item.materials.length > 0 ? (
                      <div className="overflow-hidden rounded-md border border-zinc-200 bg-zinc-50">
                        <table className="min-w-full divide-y divide-zinc-200 text-left text-xs">
                          <thead className="bg-zinc-100 text-zinc-600 font-semibold">
                            <tr>
                              <th className="px-3 py-2">Tên vật tư</th>
                              <th className="px-3 py-2 text-right">Số lượng</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-zinc-200 text-zinc-700 bg-white">
                            {item.materials.map((mat, idx) => (
                              <tr key={idx} className="hover:bg-zinc-50">
                                <td className="px-3 py-1.5 font-medium">{mat.name}</td>
                                <td className="px-3 py-1.5 text-right font-semibold text-zinc-900">{mat.quantity}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <p className="text-xs text-zinc-400 italic">Không sử dụng vật tư chi tiết</p>
                    )}
                  </div>
                </div>

                {item.files && item.files.length > 0 && (
                  <div>
                    <h4 className="font-semibold text-zinc-800 flex items-center gap-1.5 mb-2">
                      <span className="h-1.5 w-1.5 rounded-full bg-indigo-500"></span>
                      Ảnh & Tài liệu hiện trường
                    </h4>
                    <div className="pl-3">
                      <WorkFileGallery files={item.files} />
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
          {hasMoreHistory ? (
            <div className="flex justify-center pb-2">
              <button
                className="btn-secondary h-9 px-3 text-xs"
                type="button"
                disabled={loadingMore}
                onClick={() => void loadHistoryPage(historyPage + 1, true)}
              >
                {loadingMore ? "Đang tải thêm..." : `Tải thêm (${historyList.length}/${historyTotal})`}
              </button>
            </div>
          ) : null}
        </div>
      )}
    </Modal>
  );
}
