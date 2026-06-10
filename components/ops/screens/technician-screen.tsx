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
  type LucideIcon,
} from "lucide-react";
import { dateTime } from "@/components/ops/format";
import { PendingButton, StatusBadge } from "@/components/ops/ui";
import type { WorkOrderListItem } from "@/components/ops/types";
import { WORK_ORDER_TYPE_LABELS, type WorkOrderStatus } from "@/lib/types";

const ACTIVE_STATUSES = new Set<WorkOrderStatus>(["assigned", "accepted", "traveling", "working", "awaiting_acceptance"]);

const technicianNextActions: Partial<Record<WorkOrderStatus, { status: WorkOrderStatus; label: string; icon: LucideIcon }>> = {
  assigned: { status: "accepted", label: "Nhận việc", icon: Play },
  accepted: { status: "traveling", label: "Đang đi", icon: Navigation },
  traveling: { status: "working", label: "Check-in", icon: MapPinned },
  working: { status: "awaiting_acceptance", label: "Hoàn tất", icon: CheckCircle2 },
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

function sortByNextWork(left: WorkOrderListItem, right: WorkOrderListItem) {
  const leftTime = new Date(left.appointment_at ?? left.created_at).getTime();
  const rightTime = new Date(right.appointment_at ?? right.created_at).getTime();
  return leftTime - rightTime;
}

function groupTitle(status: WorkOrderStatus) {
  if (status === "assigned") return "Cần nhận việc";
  if (status === "accepted") return "Chuẩn bị di chuyển";
  if (status === "traveling") return "Đang di chuyển";
  if (status === "working") return "Đang thi công";
  if (status === "awaiting_acceptance") return "Chờ nghiệm thu";
  return "Công việc khác";
}

function formatAddress(address: string) {
  const parts = address.split(",").map((part) => part.trim()).filter(Boolean);
  if (parts.length <= 2) return address;
  return parts.slice(0, 2).join(", ");
}

function statusPriority(status: WorkOrderStatus) {
  if (status === "working") return 1;
  if (status === "traveling") return 2;
  if (status === "accepted") return 3;
  if (status === "assigned") return 4;
  if (status === "awaiting_acceptance") return 5;
  return 6;
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
        <StatusBadge status={order.status} />
      </div>
      <p className="truncate text-sm font-semibold text-zinc-950">{order.customer_name}</p>
      <p className="truncate text-xs text-zinc-500">{dateTime(order.appointment_at ?? order.created_at)}</p>
    </button>
  );
}

function TechnicianWorkCard({
  order,
  prominent = false,
  pending = false,
  onView,
  onEdit,
  onNextAction,
}: {
  order: WorkOrderListItem;
  prominent?: boolean;
  pending?: boolean;
  onView: (id: string) => void;
  onEdit: (id: string) => void;
  onNextAction: (order: WorkOrderListItem) => void;
}) {
  const action = technicianNextActions[order.status];
  const ActionIcon = action?.icon ?? Wrench;
  const appointmentLabel = dateTime(order.appointment_at ?? order.created_at);

  return (
    <article className={`mobile-job grid gap-4 ${prominent ? "border-zinc-900 ring-2 ring-zinc-900" : ""}`}>
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
        <StatusBadge status={order.status} />
      </div>
      <div className="grid gap-2 rounded-md bg-zinc-50 p-3 text-sm text-zinc-700">
        <p className="line-clamp-2 font-medium text-zinc-900">{order.description}</p>
        <p className="flex items-start gap-2">
          <MapPinned size={15} className="mt-0.5 shrink-0 text-zinc-500" />
          <span>{formatAddress(order.customer_address)}</span>
        </p>
        <p className="flex items-center gap-2">
          <CalendarClock size={15} className="shrink-0 text-zinc-500" />
          <span>{appointmentLabel}</span>
        </p>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <a className="btn-primary h-12" href={`tel:${order.customer_phone}`}><Phone size={15} />Gọi</a>
        <a
          className="btn-secondary h-12"
          href={`https://maps.google.com/?q=${encodeURIComponent(order.customer_address)}`}
          target="_blank"
          rel="noreferrer"
        >
          <MapPinned size={15} />Bản đồ
        </a>
        <button className="btn-secondary h-12" onClick={() => onView(order.id)} type="button"><Eye size={15} />Xem</button>
      </div>
      <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
        <PendingButton
          className="btn-primary h-12"
          onClick={() => onNextAction(order)}
          type="button"
          pending={pending}
          pendingLabel="Đang lưu..."
        >
          <ActionIcon size={15} />{action?.label ?? "Xử lý"}
        </PendingButton>
        <button className="btn-secondary h-12 px-4" onClick={() => onEdit(order.id)} type="button">
          <Wrench size={15} />Chi tiết
        </button>
      </div>
    </article>
  );
}

export function TechnicianScreen({
  orders,
  onView,
  onEdit,
  onStatus,
}: {
  orders: WorkOrderListItem[];
  onView: (id: string) => void;
  onEdit: (id: string) => void;
  onStatus: (id: string, status: WorkOrderStatus, checkIn?: { checkInLat?: number; checkInLng?: number }) => Promise<void>;
}) {
  const [pendingStatusOrderId, setPendingStatusOrderId] = useState<string | null>(null);
  const [locationWarning, setLocationWarning] = useState<string | null>(null);

  const activeOrders = orders
    .filter((order) => ACTIVE_STATUSES.has(order.status))
    .sort((left, right) => statusPriority(left.status) - statusPriority(right.status) || sortByNextWork(left, right));
  const doneOrders = orders.filter((order) => ["completed", "awaiting_payment", "paid", "debt"].includes(order.status));
  const waitingSignatureOrders = orders.filter((order) => order.status === "awaiting_acceptance");
  const movingOrders = orders.filter((order) => ["accepted", "traveling"].includes(order.status));
  const workingOrders = orders.filter((order) => order.status === "working");
  const nextOrder = activeOrders[0] ?? null;
  const groupedOrders = activeOrders.filter((order) => order.id !== nextOrder?.id).reduce<Record<string, WorkOrderListItem[]>>((groups, order) => {
    const title = groupTitle(order.status);
    groups[title] = [...(groups[title] ?? []), order];
    return groups;
  }, {});

  async function runNextAction(order: WorkOrderListItem) {
    const action = technicianNextActions[order.status];
    if (!action) {
      onEdit(order.id);
      return;
    }

    setPendingStatusOrderId(order.id);
    setLocationWarning(null);
    try {
      const checkIn = action.status === "working" ? await getCurrentPosition() : null;
      if (action.status === "working" && !checkIn) {
        setLocationWarning("Không lấy được vị trí check-in. Hệ thống vẫn lưu trạng thái, nhưng chưa có tọa độ.");
      }
      await onStatus(order.id, action.status, checkIn ?? undefined);
    } finally {
      setPendingStatusOrderId(null);
    }
  }

  return (
    <section className="mx-auto grid w-full max-w-7xl gap-5">
      <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm lg:p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase text-zinc-500">Kỹ thuật viên</p>
            <h2 className="mt-1 text-2xl font-extrabold tracking-tight text-zinc-950 lg:text-3xl">Việc ngoài hiện trường</h2>
            <p className="mt-1 text-sm text-zinc-500">Theo dõi tuyến việc, thao tác nhanh và đối chiếu lịch sử trong cùng một màn.</p>
          </div>
          <Route className="mt-1 text-zinc-400" size={24} />
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:gap-3">
          <div className="rounded-md border border-zinc-200 bg-zinc-50 p-3">
            <p className="text-[11px] font-bold uppercase text-zinc-500">Đang xử lý</p>
            <p className="mt-1 text-2xl font-black text-zinc-950">{activeOrders.length}</p>
          </div>
          <div className="rounded-md border border-zinc-200 bg-zinc-50 p-3">
            <p className="text-[11px] font-bold uppercase text-zinc-500">Đang đi/làm</p>
            <p className="mt-1 text-2xl font-black text-zinc-950">{movingOrders.length + workingOrders.length}</p>
          </div>
          <div className="rounded-md border border-zinc-200 bg-zinc-50 p-3">
            <p className="text-[11px] font-bold uppercase text-zinc-500">Chờ ký</p>
            <p className="mt-1 text-2xl font-black text-zinc-950">{waitingSignatureOrders.length}</p>
          </div>
          <div className="rounded-md border border-zinc-200 bg-zinc-50 p-3">
            <p className="text-[11px] font-bold uppercase text-zinc-500">Đã xong</p>
            <p className="mt-1 text-2xl font-black text-zinc-950">{doneOrders.length}</p>
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
              <TechnicianWorkCard order={nextOrder} prominent pending={pendingStatusOrderId === nextOrder.id} onView={onView} onEdit={onEdit} onNextAction={runNextAction} />
            </div>
          ) : null}

          {Object.entries(groupedOrders).map(([title, groupOrders]) => (
            <div key={title} className="grid gap-2">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-zinc-800">{title}</h3>
                <span className="text-xs font-semibold text-zinc-500">{groupOrders.length} phiếu</span>
              </div>
              <div className="grid gap-3 xl:grid-cols-2">
                {groupOrders.map((order) => (
                  <TechnicianWorkCard key={order.id} order={order} pending={pendingStatusOrderId === order.id} onView={onView} onEdit={onEdit} onNextAction={runNextAction} />
                ))}
              </div>
            </div>
          ))}
          {activeOrders.length === 0 ? (
            <div className="rounded-lg border border-dashed border-zinc-300 bg-white p-6 text-center">
              <ClipboardCheck className="mx-auto text-zinc-400" size={28} />
              <p className="mt-3 text-sm font-semibold text-zinc-800">Chưa có việc cần xử lý</p>
              <p className="mt-1 text-sm text-zinc-500">Khi điều phối giao phiếu, công việc sẽ xuất hiện ở đây.</p>
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
              <div className="flex items-center justify-between rounded-md bg-zinc-50 px-3 py-2 text-sm">
                <span className="text-zinc-600">Cần nhận / di chuyển</span>
                <strong className="text-zinc-950">{orders.filter((order) => ["assigned", "accepted", "traveling"].includes(order.status)).length}</strong>
              </div>
              <div className="flex items-center justify-between rounded-md bg-zinc-50 px-3 py-2 text-sm">
                <span className="text-zinc-600">Đang thi công</span>
                <strong className="text-zinc-950">{workingOrders.length}</strong>
              </div>
              <div className="flex items-center justify-between rounded-md bg-zinc-50 px-3 py-2 text-sm">
                <span className="text-zinc-600">Chờ nghiệm thu</span>
                <strong className="text-zinc-950">{waitingSignatureOrders.length}</strong>
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
