import "server-only";

import type { PoolClient } from "pg";
import { query } from "@/lib/db";
import { HttpError } from "@/lib/http";
import {
  canTransitionWorkOrderStatus,
  isFieldRole,
  isOpsManagerRole,
  ROLE_LABELS,
  WORK_ORDER_STATUS_LABELS,
  type SessionUser,
  type WorkOrderStatus,
} from "@/lib/types";

const FINANCIAL_LOCKED_STATUSES = new Set<WorkOrderStatus>(["completed", "paid", "debt", "cancelled"]);
const CHECK_IN_RADIUS_METERS = 300;
const FIELD_PROGRESS_STATUSES: WorkOrderStatus[] = ["assigned", "accepted", "traveling", "working"];

function distanceInMeters(left: { lat: number; lng: number }, right: { lat: number; lng: number }) {
  const toRadians = (degrees: number) => degrees * Math.PI / 180;
  const earthRadiusMeters = 6371000;
  const latDelta = toRadians(right.lat - left.lat);
  const lngDelta = toRadians(right.lng - left.lng);
  const leftLat = toRadians(left.lat);
  const rightLat = toRadians(right.lat);
  const haversine = Math.sin(latDelta / 2) ** 2
    + Math.cos(leftLat) * Math.cos(rightLat) * Math.sin(lngDelta / 2) ** 2;

  return earthRadiusMeters * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
}

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

  if (to === "working" && ["assigned", "accepted", "traveling"].includes(from) && isFieldRole(user.role)) {
    return;
  }

  if (!canTransitionWorkOrderStatus(from, to, user.role)) {
    throw new HttpError(
      422,
      `${ROLE_LABELS[user.role]} không được chuyển phiếu từ "${WORK_ORDER_STATUS_LABELS[from]}" sang "${WORK_ORDER_STATUS_LABELS[to]}".`,
    );
  }
}

function isStaleFieldProgression(from: WorkOrderStatus, to: WorkOrderStatus, user: SessionUser) {
  if (!isFieldRole(user.role)) {
    return false;
  }

  const currentIndex = FIELD_PROGRESS_STATUSES.indexOf(from);
  const nextIndex = FIELD_PROGRESS_STATUSES.indexOf(to);

  return currentIndex >= 0 && nextIndex >= 0 && currentIndex > nextIndex;
}

export async function changeWorkOrderStatus(
  client: PoolClient,
  workOrderId: string,
  nextStatus: WorkOrderStatus,
  user: SessionUser,
  note: string | null,
  checkIn?: { lat?: number; lng?: number },
) {
  const currentResult = await client.query<{
    status: WorkOrderStatus;
    customer_id: string;
    customer_lat: string | null;
    customer_lng: string | null;
  }>(
    `select wo.status, wo.customer_id, c.lat as customer_lat, c.lng as customer_lng
     from work_orders wo
     join customers c on c.id = wo.customer_id
     where wo.id = $1
     for update of wo`,
    [workOrderId],
  );

  const current = currentResult.rows[0];
  if (!current) {
    throw new HttpError(404, "Không tìm thấy phiếu");
  }

  if (isStaleFieldProgression(current.status, nextStatus, user)) {
    await client.query(
      `insert into work_order_status_history
         (work_order_id, from_status, to_status, changed_by, note)
       values ($1, $2, $2, $3, $4)`,
      [
        workOrderId,
        current.status,
        user.id,
        note ?? `Bỏ qua thao tác cũ "${WORK_ORDER_STATUS_LABELS[nextStatus]}" vì phiếu đã ở bước "${WORK_ORDER_STATUS_LABELS[current.status]}".`,
      ],
    );
    return;
  }

  assertStatusTransition(current.status, nextStatus, user);

  const setCheckIn = ["assigned", "accepted", "traveling"].includes(current.status) && nextStatus === "working";
  const acceptedAt = nextStatus === "completed" ? ", accepted_at = coalesce(accepted_at, now())" : "";
  let checkedInLat: number | null = null;
  let checkedInLng: number | null = null;

  if (setCheckIn) {
    if (checkIn?.lat === undefined || checkIn.lng === undefined) {
      throw new HttpError(422, "Check-in cần lấy được vị trí GPS. Hãy mở quyền vị trí trên trình duyệt và thử lại.");
    }

    checkedInLat = checkIn.lat;
    checkedInLng = checkIn.lng;
    const customerLat = current.customer_lat === null ? null : Number(current.customer_lat);
    const customerLng = current.customer_lng === null ? null : Number(current.customer_lng);
    if (customerLat !== null && customerLng !== null) {
      const distance = distanceInMeters(
        { lat: checkedInLat, lng: checkedInLng },
        { lat: customerLat, lng: customerLng },
      );
      if (distance > CHECK_IN_RADIUS_METERS) {
        throw new HttpError(
          422,
          `Vị trí check-in đang cách tọa độ khách hàng khoảng ${Math.round(distance)}m. Cần trong phạm vi ${CHECK_IN_RADIUS_METERS}m hoặc cập nhật lại tọa độ khách hàng.`,
        );
      }
    }
  }

  await client.query(
    `update work_orders
     set status = $2,
         updated_by = $3,
         check_in_at = case when $4 then coalesce(check_in_at, now()) else check_in_at end,
         check_in_lat = case when $4 then coalesce($5, check_in_lat) else check_in_lat end,
         check_in_lng = case when $4 then coalesce($6, check_in_lng) else check_in_lng end
         ${acceptedAt}
     where id = $1`,
    [workOrderId, nextStatus, user.id, setCheckIn, checkedInLat, checkedInLng],
  );

  if (setCheckIn) {
    await client.query(
      `update customers
       set lat = $2,
           lng = $3,
           location_pinned_at = now(),
           location_pinned_by = $4
       where id = $1
         and (lat is null or lng is null)`,
      [current.customer_id, checkedInLat, checkedInLng, user.id],
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

export async function changeWorkOrderPaymentStatus(
  client: PoolClient,
  workOrderId: string,
  nextStatus: Extract<WorkOrderStatus, "paid" | "debt">,
  user: SessionUser,
  note: string | null,
) {
  const currentResult = await client.query<{
    status: WorkOrderStatus;
  }>(
    `select status
     from work_orders
     where id = $1
     for update`,
    [workOrderId],
  );

  const current = currentResult.rows[0];
  if (!current) {
    throw new HttpError(404, "Không tìm thấy phiếu");
  }

  if (!["completed", "awaiting_payment", "debt"].includes(current.status)) {
    throw new HttpError(422, "Chỉ cập nhật thanh toán khi phiếu đã nghiệm thu, chờ thu tiền hoặc đang công nợ");
  }

  await client.query(
    `update work_orders
     set status = $2,
         updated_by = $3
     where id = $1`,
    [workOrderId, nextStatus, user.id],
  );

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
               + round((wo.labor_cost + coalesce(m.total, 0)) * wo.vat_rate / 100, 2),
             debt_amount = greatest(
               wo.labor_cost + coalesce(m.total, 0)
                 + round((wo.labor_cost + coalesce(m.total, 0)) * wo.vat_rate / 100, 2)
                 - p.paid_amount,
               0
             ),
             status = case
               when p.paid_amount <= 0 and p.status = 'unpaid' then 'unpaid'
               when p.paid_amount >= wo.labor_cost + coalesce(m.total, 0)
                 + round((wo.labor_cost + coalesce(m.total, 0)) * wo.vat_rate / 100, 2)
                 and p.method is not null then 'paid'
               when p.status in ('paid', 'debt') then 'debt'
               else p.status
             end,
             note = case
               when p.status in ('paid', 'debt')
                 and p.paid_amount < wo.labor_cost + coalesce(m.total, 0)
                   + round((wo.labor_cost + coalesce(m.total, 0)) * wo.vat_rate / 100, 2)
                 and p.note is null
                 and p.debt_due_date is null
               then 'Phát sinh công nợ do cập nhật chi phí'
               else p.note
             end
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

export function makePaymentTransactionRef(workOrderCode: string) {
  const normalizedCode = workOrderCode.replace(/[^A-Z0-9]/gi, "").slice(-10).toUpperCase() || "PAY";
  const stamp = new Date().toISOString().replace(/[-:TZ.]/g, "").slice(0, 14);
  const random = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `TT-${normalizedCode}-${stamp}-${random}`;
}

export function makeWorkOrderCode() {
  const now = new Date();
  const date = now.toISOString().slice(0, 10).replaceAll("-", "");
  const random = Math.random().toString(36).slice(2, 7).toUpperCase();
  return `CV-${date}-${random}`;
}
