import "server-only";

import type { PoolClient } from "pg";
import { query } from "@/lib/db";
import { HttpError } from "@/lib/http";
import {
  canTransitionWorkOrderStatus,
  isOpsManagerRole,
  ROLE_LABELS,
  WORK_ORDER_STATUS_LABELS,
  type SessionUser,
  type WorkOrderStatus,
} from "@/lib/types";

const FINANCIAL_LOCKED_STATUSES = new Set<WorkOrderStatus>(["completed", "paid", "debt", "cancelled"]);

export async function getTechnicianIdForUser(userId: string) {
  const result = await query<{ id: string }>(
    "select id from technicians where user_id = $1 limit 1",
    [userId],
  );

  return result.rows[0]?.id ?? null;
}

export async function requireTechnicianIdForUser(userId: string) {
  const technicianId = await getTechnicianIdForUser(userId);
  if (!technicianId) {
    throw new HttpError(403, "Tài khoản kỹ thuật chưa được liên kết với hồ sơ kỹ thuật viên. Admin cần tạo hoặc gắn hồ sơ kỹ thuật trước khi giao việc.");
  }

  return technicianId;
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
  if (isOpsManagerRole(user.role)) {
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

export async function syncTechnicianStatuses(client: PoolClient, technicianIds: string[]) {
  const uniqueIds = [...new Set(technicianIds.filter(Boolean))];
  if (uniqueIds.length === 0) return;

  await client.query(
    `update technicians t
     set status = case
       when exists (
         select 1
         from work_order_assignments woa
         join work_orders wo on wo.id = woa.work_order_id
         where woa.technician_id = t.id
           and woa.unassigned_at is null
           and wo.status in ('working', 'awaiting_acceptance')
       ) then 'working'::technician_status
       when exists (
         select 1
         from work_order_assignments woa
         join work_orders wo on wo.id = woa.work_order_id
         where woa.technician_id = t.id
           and woa.unassigned_at is null
           and wo.status = 'traveling'
       ) then 'traveling'::technician_status
       when t.status = 'off' then 'off'::technician_status
       else 'available'::technician_status
     end
     where t.id = any($1::uuid[])`,
    [uniqueIds],
  );
}

export function assertStatusTransition(from: WorkOrderStatus, to: WorkOrderStatus, user: SessionUser) {
  if (from === to) {
    return;
  }

  if (!canTransitionWorkOrderStatus(from, to, user.role)) {
    throw new HttpError(
      422,
      `${ROLE_LABELS[user.role]} không được chuyển phiếu từ "${WORK_ORDER_STATUS_LABELS[from]}" sang "${WORK_ORDER_STATUS_LABELS[to]}".`,
    );
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
  const currentResult = await client.query<{ status: WorkOrderStatus; customer_id: string }>(
    "select status, customer_id from work_orders where id = $1 for update",
    [workOrderId],
  );

  const current = currentResult.rows[0];
  if (!current) {
    throw new HttpError(404, "Không tìm thấy phiếu");
  }

  assertStatusTransition(current.status, nextStatus, user);

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

  if (setCheckIn && checkIn?.lat !== undefined && checkIn.lng !== undefined) {
    await client.query(
      `update customers
       set lat = $2,
           lng = $3,
           location_pinned_at = now(),
           location_pinned_by = $4
       where id = $1
         and lat is null
         and lng is null`,
      [current.customer_id, checkIn.lat, checkIn.lng, user.id],
    );
  }

  await client.query(
    `insert into work_order_status_history
       (work_order_id, from_status, to_status, changed_by, note)
     values ($1, $2, $3, $4, $5)`,
    [workOrderId, current.status, nextStatus, user.id, note],
  );

  const assignmentResult = await client.query<{ technician_id: string }>(
    `select technician_id
     from work_order_assignments
     where work_order_id = $1 and unassigned_at is null`,
    [workOrderId],
  );
  await syncTechnicianStatuses(client, assignmentResult.rows.map((row) => row.technician_id));
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
