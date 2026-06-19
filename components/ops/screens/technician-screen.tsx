"use client";

import { useState } from "react";
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  Eye,
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
import { DeadlineBadge, PendingButton, StageBadge, StatusBadge } from "@/components/ops/ui";
import type { WorkOrderListItem } from "@/components/ops/types";
import {
  getAllowedWorkOrderTransitions,
  WORK_ORDER_STATUS_DESCRIPTIONS,
  WORK_ORDER_STATUS_ORDER,
  WORK_ORDER_TYPE_LABELS,
  type Role,
  type WorkOrderStatus,
} from "@/lib/types";

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
  onView,
  onEdit,
  onNextAction,
  onCheckIn,
  role,
}: {
  order: WorkOrderListItem;
  prominent?: boolean;
  pending?: boolean;
  actionError?: string | null;
  onView: (id: string) => void;
  onEdit: (id: string) => void;
  onNextAction: (order: WorkOrderListItem) => void;
  onCheckIn: (order: WorkOrderListItem) => void;
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
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        <a className="btn-primary h-12" href={`tel:${order.customer_phone}`}><Phone size={15} />Gọi</a>
        <a
          className="btn-secondary h-12"
          href={mapSearchUrl({ address: order.customer_address, lat: order.customer_lat, lng: order.customer_lng })}
          target="_blank"
          rel="noreferrer"
        >
          <MapPinned size={15} />Bản đồ
        </a>
        <button className="btn-secondary h-12" onClick={() => onView(order.id)} type="button"><Eye size={15} />Xem</button>
      </div>
      <div className={`grid grid-cols-1 gap-2 ${canQuickCheckIn ? "sm:grid-cols-3" : "sm:grid-cols-[minmax(0,1fr)_auto]"}`}>
        <PendingButton
          className="btn-primary h-12"
          onClick={() => onNextAction(order)}
          type="button"
          pending={pending && action.type === "status"}
          pendingLabel="Đang lưu..."
        >
          <ActionIcon size={15} />{action.label}
        </PendingButton>
        {canQuickCheckIn ? (
          <PendingButton
            className="btn-secondary h-12 px-4"
            onClick={() => onCheckIn(order)}
            type="button"
            pending={pending}
            pendingLabel="Đang lưu..."
          >
            <MapPinned size={15} />Check-in
          </PendingButton>
        ) : null}
        <button className="btn-secondary h-12 px-4" onClick={() => onEdit(order.id)} type="button">
          <Wrench size={15} />Chi tiết
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
  onStatus: (id: string, status: WorkOrderStatus, payload?: { checkInLat?: number; checkInLng?: number; note?: string | null }) => Promise<void>;
}) {
  const [pendingStatusOrderId, setPendingStatusOrderId] = useState<string | null>(null);
  const [locationWarning, setLocationWarning] = useState<string | null>(null);
  const [actionError, setActionError] = useState<{ orderId: string; message: string } | null>(null);

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

  async function runNextAction(order: WorkOrderListItem) {
    const action = getTechnicianPrimaryAction(order, role);
    if (action.type === "edit") {
      onEdit(order.id);
      return;
    }

    setPendingStatusOrderId(order.id);
    setLocationWarning(null);
    setActionError(null);
    try {
      const checkIn = action.status === "working" ? await getCurrentPosition() : null;
      if (action.status === "working" && !checkIn) {
        setLocationWarning("Không lấy được vị trí check-in. Hãy cho phép quyền vị trí và mở app qua HTTPS hoặc localhost rồi thử lại.");
        return;
      }
      await onStatus(order.id, action.status, checkIn ?? undefined);
    } catch (error) {
      const message = getErrorMessage(error, "Không cập nhật được trạng thái phiếu. Vui lòng thử lại.");
      setLocationWarning(message);
      setActionError({ orderId: order.id, message });
    } finally {
      setPendingStatusOrderId(null);
    }
  }

  async function runCheckIn(order: WorkOrderListItem) {
    setPendingStatusOrderId(order.id);
    setLocationWarning(null);
    setActionError(null);
    try {
      const checkIn = await getCurrentPosition();
      if (!checkIn) {
        setLocationWarning("Không lấy được vị trí check-in. Hãy cho phép quyền vị trí và mở app qua HTTPS hoặc localhost rồi thử lại.");
        return;
      }
      await onStatus(order.id, "working", checkIn);
    } catch (error) {
      const message = getErrorMessage(error, "Không check-in được. Vui lòng thử lại.");
      setLocationWarning(message);
      setActionError({ orderId: order.id, message });
    } finally {
      setPendingStatusOrderId(null);
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

      {locationWarning ? <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">{locationWarning}</p> : null}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_380px] lg:items-start">
        <div className="grid gap-5">
          {nextOrder ? (
            <div className="grid gap-2">
              <div className="flex items-center gap-2">
                <Clock3 size={15} className="text-zinc-500" />
                <p className="text-xs font-bold uppercase text-zinc-700">Việc cần làm tiếp theo</p>
              </div>
              <TechnicianWorkCard role={role} order={nextOrder} prominent pending={pendingStatusOrderId === nextOrder.id} actionError={actionError?.orderId === nextOrder.id ? actionError.message : null} onView={onView} onEdit={onEdit} onNextAction={runNextAction} onCheckIn={runCheckIn} />
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
                    <TechnicianWorkCard key={order.id} role={role} order={order} pending={pendingStatusOrderId === order.id} actionError={actionError?.orderId === order.id ? actionError.message : null} onView={onView} onEdit={onEdit} onNextAction={runNextAction} onCheckIn={runCheckIn} />
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
    </section>
  );
}
