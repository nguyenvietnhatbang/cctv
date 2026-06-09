"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Eye, MapPinned, Navigation, Phone, Play, Wrench, type LucideIcon } from "lucide-react";
import { apiFetch } from "@/components/ops/api";
import { AssignmentHistoryList } from "@/components/ops/assignment-history-list";
import { dateTime } from "@/components/ops/format";
import { EmptyState, PendingButton, StatusBadge } from "@/components/ops/ui";
import type { AssignmentHistoryItem, WorkOrderListItem } from "@/components/ops/types";
import type { WorkOrderStatus } from "@/lib/types";

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

  return (
    <article className={`mobile-job ${prominent ? "ring-2 ring-teal-500" : ""}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-zinc-500">{order.code}</p>
          <h2 className="mt-1 text-lg font-semibold">{order.customer_name}</h2>
        </div>
        <StatusBadge status={order.status} />
      </div>
      <p className="mt-3 text-sm leading-6 text-zinc-600">{order.description}</p>
      <div className="mt-4 grid gap-2 text-sm">
        <p>{order.customer_address}</p>
        <p>{dateTime(order.appointment_at ?? order.created_at)}</p>
      </div>
      <div className="mt-4 grid grid-cols-3 gap-2">
        <a className="btn-secondary h-11" href={`tel:${order.customer_phone}`}><Phone size={15} />Gọi</a>
        <a
          className="btn-secondary h-11"
          href={`https://maps.google.com/?q=${encodeURIComponent(order.customer_address)}`}
          target="_blank"
          rel="noreferrer"
        >
          <MapPinned size={15} />Bản đồ
        </a>
        <button className="btn-secondary h-11" onClick={() => onView(order.id)} type="button"><Eye size={15} />Xem</button>
      </div>
      <div className="mt-3 grid grid-cols-[1fr_auto] gap-2">
        <PendingButton
          className="btn-primary h-11"
          onClick={() => onNextAction(order)}
          type="button"
          pending={pending}
          pendingLabel="Đang lưu..."
        >
          <ActionIcon size={15} />{action?.label ?? "Xử lý"}
        </PendingButton>
        <button className="btn-secondary h-11 px-3" onClick={() => onEdit(order.id)} type="button">
          <Wrench size={15} />
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
  const [assignmentHistory, setAssignmentHistory] = useState<AssignmentHistoryItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [pendingStatusOrderId, setPendingStatusOrderId] = useState<string | null>(null);
  const [locationWarning, setLocationWarning] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setHistoryLoading(true);
    apiFetch<{ assignmentHistory: AssignmentHistoryItem[] }>("/api/assignment-history")
      .then((payload) => {
        if (!cancelled) setAssignmentHistory(payload.assignmentHistory);
      })
      .catch(() => {
        if (!cancelled) setAssignmentHistory([]);
      })
      .finally(() => {
        if (!cancelled) setHistoryLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [orders]);

  const activeOrders = orders.filter((order) => ACTIVE_STATUSES.has(order.status)).sort(sortByNextWork);
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
    <section className="grid gap-6">
      <div className="grid gap-3">
        <div>
          <h2 className="text-xl font-bold text-zinc-950">Công việc đang giao</h2>
          <p className="mt-1 text-xs text-zinc-500">Thao tác theo thứ tự ngoài hiện trường</p>
        </div>
        {locationWarning ? <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">{locationWarning}</p> : null}
        {nextOrder ? (
          <div className="grid gap-2">
            <p className="text-xs font-bold uppercase text-teal-700">Việc cần làm tiếp theo</p>
            <TechnicianWorkCard order={nextOrder} prominent pending={pendingStatusOrderId === nextOrder.id} onView={onView} onEdit={onEdit} onNextAction={runNextAction} />
          </div>
        ) : null}
        {Object.entries(groupedOrders).map(([title, groupOrders]) => (
          <div key={title} className="grid gap-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-zinc-800">{title}</h3>
              <span className="text-xs font-semibold text-zinc-500">{groupOrders.length} phiếu</span>
            </div>
            {groupOrders.map((order) => (
              <TechnicianWorkCard key={order.id} order={order} pending={pendingStatusOrderId === order.id} onView={onView} onEdit={onEdit} onNextAction={runNextAction} />
            ))}
          </div>
        ))}
        {activeOrders.length === 0 ? <EmptyState>Chưa có công việc đang xử lý.</EmptyState> : null}
      </div>

      <div className="grid gap-3">
        <div>
          <h2 className="text-xl font-bold text-zinc-950">Lịch sử phân công</h2>
          <p className="mt-1 text-xs text-zinc-500">Các phiếu đã từng được giao cho bạn</p>
        </div>
        <AssignmentHistoryList items={assignmentHistory} loading={historyLoading} />
      </div>
    </section>
  );
}
