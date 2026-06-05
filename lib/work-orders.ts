import "server-only";

import type { PoolClient } from "pg";
import { query } from "@/lib/db";
import { HttpError } from "@/lib/http";
import type { SessionUser, WorkOrderStatus } from "@/lib/types";

const ALLOWED_TRANSITIONS: Partial<Record<WorkOrderStatus, WorkOrderStatus[]>> = {
  pending_assignment: ["assigned", "cancelled"],
  assigned: ["accepted", "pending_assignment", "cancelled"],
  accepted: ["traveling", "cancelled"],
  traveling: ["working", "cancelled"],
  working: ["awaiting_acceptance", "cancelled"],
  awaiting_acceptance: ["completed", "working", "cancelled"],
  completed: ["awaiting_payment", "paid", "debt", "cancelled"],
  awaiting_payment: ["paid", "debt"],
  debt: ["paid"],
};

const FINANCIAL_LOCKED_STATUSES = new Set<WorkOrderStatus>(["completed", "paid", "debt", "cancelled"]);

export async function getTechnicianIdForUser(userId: string) {
  const result = await query<{ id: string }>(
    "select id from technicians where user_id = $1 limit 1",
    [userId],
  );

  return result.rows[0]?.id ?? null;
}

export async function assertCanReadWorkOrder(user: SessionUser, workOrderId: string) {
  if (user.role !== "technician") {
    return;
  }

  const result = await query<{ id: string }>(
    `select woa.id
     from work_order_assignments woa
     join technicians t on t.id = woa.technician_id
     where woa.work_order_id = $1
       and woa.unassigned_at is null
       and t.user_id = $2
     limit 1`,
    [workOrderId, user.id],
  );

  if (!result.rows[0]) {
    throw new HttpError(403, "Bạn không có quyền xem phiếu này");
  }
}

export async function assertCanMutateFieldWork(user: SessionUser, workOrderId: string) {
  if (["admin", "dispatcher"].includes(user.role)) {
    return;
  }

  if (user.role === "technician") {
    await assertCanReadWorkOrder(user, workOrderId);
    return;
  }

  throw new HttpError(403, "Bạn không có quyền cập nhật hiện trường");
}

export async function assertCanEditFinancials(user: SessionUser, workOrderId: string) {
  const result = await query<{ status: WorkOrderStatus }>(
    "select status from work_orders where id = $1",
    [workOrderId],
  );

  const workOrder = result.rows[0];
  if (!workOrder) {
    throw new HttpError(404, "Không tìm thấy phiếu");
  }

  if (user.role !== "admin" && FINANCIAL_LOCKED_STATUSES.has(workOrder.status)) {
    throw new HttpError(403, "Phiếu đã khóa chi phí sau nghiệm thu/thanh toán");
  }
}

export function isFinancialLockedStatus(status: WorkOrderStatus) {
  return FINANCIAL_LOCKED_STATUSES.has(status);
}

export function assertStatusTransition(from: WorkOrderStatus, to: WorkOrderStatus) {
  if (from === to) {
    return;
  }

  const allowed = ALLOWED_TRANSITIONS[from] ?? [];
  if (!allowed.includes(to)) {
    throw new HttpError(422, "Trạng thái không đúng thứ tự xử lý");
  }
}

export async function changeWorkOrderStatus(
  client: PoolClient,
  workOrderId: string,
  nextStatus: WorkOrderStatus,
  user: SessionUser,
  note: string | null,
  checkIn?: { lat?: number; lng?: number },
) {
  const currentResult = await client.query<{ status: WorkOrderStatus }>(
    "select status from work_orders where id = $1 for update",
    [workOrderId],
  );

  const current = currentResult.rows[0];
  if (!current) {
    throw new HttpError(404, "Không tìm thấy phiếu");
  }

  assertStatusTransition(current.status, nextStatus);

  const setCheckIn = nextStatus === "working";
  const acceptedAt = nextStatus === "completed" ? ", accepted_at = coalesce(accepted_at, now())" : "";

  await client.query(
    `update work_orders
     set status = $2,
         updated_by = $3,
         check_in_at = case when $4 then coalesce(check_in_at, now()) else check_in_at end,
         check_in_lat = case when $4 then coalesce($5, check_in_lat) else check_in_lat end,
         check_in_lng = case when $4 then coalesce($6, check_in_lng) else check_in_lng end
         ${acceptedAt}
     where id = $1`,
    [workOrderId, nextStatus, user.id, setCheckIn, checkIn?.lat ?? null, checkIn?.lng ?? null],
  );

  await client.query(
    `insert into work_order_status_history
       (work_order_id, from_status, to_status, changed_by, note)
     values ($1, $2, $3, $4, $5)`,
    [workOrderId, current.status, nextStatus, user.id, note],
  );
}

export async function syncWorkOrderPaymentAmounts(client: PoolClient, workOrderId: string) {
  await client.query(
    `update payments p
     set material_amount = coalesce(m.total, 0),
         labor_amount = wo.labor_cost,
         vat_amount = round((wo.labor_cost + coalesce(m.total, 0)) * wo.vat_rate / 100, 2),
         total_amount = wo.labor_cost + coalesce(m.total, 0)
           + round((wo.labor_cost + coalesce(m.total, 0)) * wo.vat_rate / 100, 2)
     from work_orders wo
     left join (
       select work_order_id, sum(line_total) as total
       from work_order_materials
       where work_order_id = $1
       group by work_order_id
     ) m on m.work_order_id = wo.id
     where p.work_order_id = wo.id and wo.id = $1`,
    [workOrderId],
  );
}

export function makeWorkOrderCode() {
  const now = new Date();
  const date = now.toISOString().slice(0, 10).replaceAll("-", "");
  const random = Math.random().toString(36).slice(2, 7).toUpperCase();
  return `CV-${date}-${random}`;
}
