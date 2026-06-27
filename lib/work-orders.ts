import "server-only";

import type { PoolClient } from "pg";
import { query } from "@/lib/db";
import { HttpError } from "@/lib/http";
import { createNotifications } from "@/lib/notifications";
import {
  canTransitionWorkOrderStatus,
  isFieldRole,
  isOpsManagerRole,
  ROLE_LABELS,
  WORK_ORDER_STATUS_LABELS,
  type PaymentMethod,
  type PaymentStatus,
  type SessionUser,
  type WorkOrderStatus,
} from "@/lib/types";

const FINANCIAL_LOCKED_STATUSES = new Set<WorkOrderStatus>(["completed", "awaiting_payment", "paid", "debt", "cancelled"]);
const CHECK_IN_RADIUS_METERS = 300;
const FIELD_PROGRESS_STATUSES: WorkOrderStatus[] = ["assigned", "accepted", "traveling", "working"];
const ASSIGNMENT_FIELD_STATUSES = new Set<WorkOrderStatus>(["assigned", "accepted", "traveling", "working", "paused", "awaiting_acceptance"]);

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
         where woa.technician_id = t.id
           and woa.unassigned_at is null
           and woa.field_status in ('working', 'awaiting_acceptance')
       ) then 'working'::technician_status
       when exists (
         select 1
         from work_order_assignments woa
         where woa.technician_id = t.id
           and woa.unassigned_at is null
           and woa.field_status = 'traveling'
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

async function getAssignedTechnicianIdForFieldUser(client: PoolClient, user: SessionUser, workOrderId: string) {
  if (user.role !== "technician") return null;
  const technicianId = await requireTechnicianIdForUser(user.id);
  const result = await client.query<{ technician_id: string }>(
    `select technician_id
     from work_order_assignments
     where work_order_id = $1
       and technician_id = $2
       and unassigned_at is null
     limit 1`,
    [workOrderId, technicianId],
  );

  if (!result.rows[0]) {
    throw new HttpError(403, "Bạn không còn được phân công phiếu này");
  }

  return technicianId;
}

async function updateAssignmentFieldProgress(
  client: PoolClient,
  workOrderId: string,
  technicianId: string | null,
  nextStatus: WorkOrderStatus,
  user: SessionUser,
  checkIn: { lat?: number; lng?: number } | undefined,
) {
  if (!technicianId || !ASSIGNMENT_FIELD_STATUSES.has(nextStatus)) return null;

  const assignmentResult = await client.query<{
    field_status: WorkOrderStatus;
    check_in_at: string | null;
  }>(
    `select field_status, check_in_at
     from work_order_assignments
     where work_order_id = $1
       and technician_id = $2
       and unassigned_at is null
     for update`,
    [workOrderId, technicianId],
  );

  const assignment = assignmentResult.rows[0];
  if (!assignment) {
    throw new HttpError(403, "Bạn không còn được phân công phiếu này");
  }

  const firstCheckIn = nextStatus === "working" && !assignment.check_in_at;
  if (firstCheckIn && (checkIn?.lat === undefined || checkIn.lng === undefined)) {
    throw new HttpError(422, "Check-in cần lấy được vị trí GPS. Hãy mở quyền vị trí trên trình duyệt và thử lại.");
  }

  await client.query(
    `update work_order_assignments
     set field_status = $3,
         check_in_at = case when $4 then now() else check_in_at end,
         check_in_lat = case when $4 then $5 else check_in_lat end,
         check_in_lng = case when $4 then $6 else check_in_lng end
     where work_order_id = $1
       and technician_id = $2
       and unassigned_at is null`,
    [
      workOrderId,
      technicianId,
      nextStatus,
      firstCheckIn,
      checkIn?.lat ?? null,
      checkIn?.lng ?? null,
    ],
  );

  return {
    previousStatus: assignment.field_status,
    firstCheckIn,
    changed: assignment.field_status !== nextStatus || firstCheckIn,
    changedBy: user.id,
  };
}

export async function changeWorkOrderStatus(
  client: PoolClient,
  workOrderId: string,
  nextStatus: WorkOrderStatus,
  user: SessionUser,
  note: string | null,
  checkIn?: { lat?: number; lng?: number; updateCustomerLocation?: boolean },
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

  const assignedTechnicianId = await getAssignedTechnicianIdForFieldUser(client, user, workOrderId);
  const shouldValidateCheckInLocation = assignedTechnicianId !== null && nextStatus === "working" && checkIn?.lat !== undefined && checkIn.lng !== undefined;
  if (shouldValidateCheckInLocation) {
    const customerLat = current.customer_lat === null ? null : Number(current.customer_lat);
    const customerLng = current.customer_lng === null ? null : Number(current.customer_lng);
    if (customerLat !== null && customerLng !== null) {
      const distance = distanceInMeters(
        { lat: checkIn.lat!, lng: checkIn.lng! },
        { lat: customerLat, lng: customerLng },
      );
      if (distance > CHECK_IN_RADIUS_METERS) {
        if (!checkIn.updateCustomerLocation) {
          throw new HttpError(
            422,
            `Vị trí check-in đang cách tọa độ khách hàng khoảng ${Math.round(distance)}m. Cần xác nhận cập nhật tọa độ khách hàng trước khi check-in.`,
          );
        }

        await client.query(
          `update customers
           set lat = $2,
               lng = $3,
               location_pinned_at = now(),
               location_pinned_by = $4
           where id = $1`,
          [current.customer_id, checkIn.lat, checkIn.lng, user.id],
        );
      }
    }
  }

  if (isStaleFieldProgression(current.status, nextStatus, user)) {
    await updateAssignmentFieldProgress(client, workOrderId, assignedTechnicianId, nextStatus, user, checkIn);
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
        if (!checkIn.updateCustomerLocation) {
          throw new HttpError(
            422,
            `Vị trí check-in đang cách tọa độ khách hàng khoảng ${Math.round(distance)}m. Cần xác nhận cập nhật tọa độ khách hàng trước khi check-in.`,
          );
        }

        await client.query(
          `update customers
           set lat = $2,
               lng = $3,
               location_pinned_at = now(),
               location_pinned_by = $4
           where id = $1`,
          [current.customer_id, checkedInLat, checkedInLng, user.id],
        );
      }
    }
  }

  await updateAssignmentFieldProgress(client, workOrderId, assignedTechnicianId, nextStatus, user, checkIn);

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
         set material_amount = wo.material_cost,
             labor_amount = wo.labor_cost,
             vat_amount = round((wo.labor_cost + wo.material_cost) * wo.vat_rate / 100, 2),
             total_amount = wo.labor_cost + wo.material_cost
               + round((wo.labor_cost + wo.material_cost) * wo.vat_rate / 100, 2),
             debt_amount = greatest(
               wo.labor_cost + wo.material_cost
                 + round((wo.labor_cost + wo.material_cost) * wo.vat_rate / 100, 2)
                 - p.paid_amount,
               0
             ),
             status = case
               when p.paid_amount <= 0 and p.status = 'unpaid' then 'unpaid'
               when p.paid_amount >= wo.labor_cost + wo.material_cost
                 + round((wo.labor_cost + wo.material_cost) * wo.vat_rate / 100, 2)
                 and p.method is not null then 'paid'
               when p.status in ('paid', 'debt') then 'debt'
               else p.status
             end,
             note = case
               when p.status in ('paid', 'debt')
                 and p.paid_amount < wo.labor_cost + wo.material_cost
                   + round((wo.labor_cost + wo.material_cost) * wo.vat_rate / 100, 2)
                 and p.note is null
                 and p.debt_due_date is null
               then 'Phát sinh công nợ do cập nhật chi phí'
               else p.note
             end
     from work_orders wo
     where p.work_order_id = wo.id and wo.id = $1`,
    [workOrderId],
  );
}

export async function assertWorkOrderTotalCoversPaidAmount(client: PoolClient, workOrderId: string) {
  const result = await client.query<{
    total_amount: string;
    paid_amount: string;
  }>(
    `select wo.labor_cost + wo.material_cost
              + round((wo.labor_cost + wo.material_cost) * wo.vat_rate / 100, 2) as total_amount,
            p.paid_amount
     from work_orders wo
     join payments p on p.work_order_id = wo.id
     where wo.id = $1
     for update of wo, p`,
    [workOrderId],
  );
  const amounts = result.rows[0];
  if (!amounts) {
    throw new HttpError(404, "Không tìm thấy phiếu hoặc thanh toán");
  }
  if (Number(amounts.total_amount) < Number(amounts.paid_amount)) {
    throw new HttpError(422, "Không thể giảm tổng chi phí thấp hơn số tiền đã thu");
  }
}

export async function syncClosedWorkOrderStatusFromPayment(
  client: PoolClient,
  workOrderId: string,
  user: SessionUser,
) {
  const result = await client.query<{
    work_order_status: WorkOrderStatus;
    payment_status: PaymentStatus;
  }>(
    `select wo.status as work_order_status, p.status as payment_status
     from work_orders wo
     join payments p on p.work_order_id = wo.id
     where wo.id = $1
     for update of wo, p`,
    [workOrderId],
  );
  const current = result.rows[0];
  if (!current || !["paid", "debt"].includes(current.work_order_status)) {
    return;
  }

  const nextStatus = current.payment_status === "paid" ? "paid" : "debt";
  if (current.work_order_status === nextStatus) {
    return;
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
     values ($1, $2, $3, $4, 'Tự đồng bộ sau khi admin điều chỉnh chi phí đã chốt')`,
    [workOrderId, current.work_order_status, nextStatus, user.id],
  );
}

export type WorkOrderPaymentInput = {
  status: PaymentStatus;
  method?: PaymentMethod | null;
  amount?: number | null;
  debtDueDate?: string | null;
  note?: string | null;
};

const FIELD_PAYMENT_STATUSES = new Set<WorkOrderStatus>(["working", "awaiting_acceptance"]);
const PAYMENT_SETTLEMENT_STATUSES = new Set<WorkOrderStatus>(["completed", "awaiting_payment", "debt"]);

export async function recordWorkOrderPayment(
  client: PoolClient,
  workOrderId: string,
  input: WorkOrderPaymentInput,
  user: SessionUser,
) {
  await syncWorkOrderPaymentAmounts(client, workOrderId);

  const paymentResult = await client.query<{
    id: string;
    code: string;
    current_status: WorkOrderStatus;
    total_amount: string;
    paid_amount: string;
  }>(
    `select p.id, wo.code, wo.status as current_status, p.total_amount, p.paid_amount
     from payments p
     join work_orders wo on wo.id = p.work_order_id
     where p.work_order_id = $1
     for update of p, wo`,
    [workOrderId],
  );

  const payment = paymentResult.rows[0];
  if (!payment) {
    throw new HttpError(404, "Không tìm thấy thanh toán");
  }

  const isFieldPayment = FIELD_PAYMENT_STATUSES.has(payment.current_status);
  const isSettlementPayment = PAYMENT_SETTLEMENT_STATUSES.has(payment.current_status);
  if (!isFieldPayment && !isSettlementPayment) {
    throw new HttpError(
      422,
      "Chỉ ghi nhận thanh toán khi phiếu đang xử lý hiện trường, chờ nghiệm thu, đã nghiệm thu, chờ thu tiền hoặc đang công nợ",
    );
  }

  const totalAmount = Number(payment.total_amount);
  const paidBefore = Number(payment.paid_amount);
  const remainingBefore = Math.max(totalAmount - paidBefore, 0);
  const collectionAmount = input.amount ?? (input.status === "paid" ? remainingBefore : 0);

  if (collectionAmount < 0) {
    throw new HttpError(422, "Số tiền thu không hợp lệ");
  }
  if (input.status === "paid" && collectionAmount <= 0 && remainingBefore > 0) {
    throw new HttpError(422, "Cần nhập số tiền đã thu");
  }
  if (collectionAmount > 0 && (!input.method || input.method === "debt")) {
    throw new HttpError(422, "Cần nhập hình thức thanh toán tiền đã thu");
  }
  if (collectionAmount > remainingBefore) {
    throw new HttpError(422, "Số tiền thu vượt quá số còn lại");
  }

  const paidAfter = paidBefore + collectionAmount;
  const debtAfter = Math.max(totalAmount - paidAfter, 0);
  const nextPaymentStatus = debtAfter > 0 ? "debt" : "paid";
  const transactionRef = collectionAmount > 0 ? makePaymentTransactionRef(payment.code) : null;

  if (debtAfter > 0 && !input.note && !input.debtDueDate) {
    throw new HttpError(422, "Cần ghi chú hoặc ngày hẹn cho số tiền còn công nợ");
  }

  if (collectionAmount > 0 && transactionRef && input.method && input.method !== "debt") {
    await client.query(
      `insert into payment_transactions
         (payment_id, work_order_id, amount, method, transaction_ref, note, collected_by)
       values ($1, $2, $3, $4, $5, $6, $7)`,
      [payment.id, workOrderId, collectionAmount, input.method, transactionRef, input.note, user.id],
    );
  }

  await client.query(
    `update payments
     set paid_amount = $2,
         debt_amount = $3,
         status = $4,
         method = $5,
         transaction_ref = coalesce($6, transaction_ref),
         debt_due_date = $7,
         note = $8,
         confirmed_by = $9,
         confirmed_at = now()
     where work_order_id = $1`,
    [
      workOrderId,
      paidAfter,
      debtAfter,
      nextPaymentStatus,
      debtAfter > 0 && collectionAmount === 0 ? "debt" : collectionAmount > 0 ? input.method : "cash",
      transactionRef,
      input.debtDueDate,
      input.note,
      user.id,
    ],
  );

  if (isFieldPayment) {
    const historyNote = collectionAmount > 0
      ? `Ghi nhận thanh toán hiện trường ${collectionAmount.toLocaleString("vi-VN")}đ, còn công nợ ${debtAfter.toLocaleString("vi-VN")}đ`
      : `Ghi nhận công nợ hiện trường ${debtAfter.toLocaleString("vi-VN")}đ`;
    await client.query(
      `insert into work_order_status_history
         (work_order_id, from_status, to_status, changed_by, note)
       values ($1, $2, $2, $3, $4)`,
      [workOrderId, payment.current_status, user.id, input.note ? `${historyNote}. ${input.note}` : historyNote],
    );
  } else if (nextPaymentStatus === "paid") {
    await changeWorkOrderPaymentStatus(client, workOrderId, "paid", user, `Xác nhận đã thu đủ ${totalAmount.toLocaleString("vi-VN")}đ`);
  } else {
    const note = collectionAmount > 0
      ? `Thu ${collectionAmount.toLocaleString("vi-VN")}đ, còn công nợ ${debtAfter.toLocaleString("vi-VN")}đ`
      : `Chuyển công nợ ${debtAfter.toLocaleString("vi-VN")}đ`;
    await changeWorkOrderPaymentStatus(client, workOrderId, "debt", user, note);
  }

  const recipients = await client.query<{ id: string }>(
    `select id
     from users
     where role in ('admin', 'dispatcher', 'accountant') and status = 'active'`,
  );
  await createNotifications(
    client,
    recipients.rows.map((recipient) => ({
      userId: recipient.id,
      workOrderId,
      type: "payment_updated",
      priority: "normal",
      title: "Thanh toán đã cập nhật",
      body: nextPaymentStatus === "paid" ? "Phiếu đã thu đủ tiền." : "Phiếu còn công nợ.",
    })),
  );

  return { nextPaymentStatus, paidAfter, debtAfter };
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
