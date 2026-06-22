import { requireUser } from "@/lib/auth";
import { withTransaction } from "@/lib/db";
import { handleRouteError, HttpError, jsonOk } from "@/lib/http";
import { createNotifications, schedulePushProcessing } from "@/lib/notifications";
import { isOpsManagerRole, OPS_MANAGER_ROLES, WORK_ORDER_STATUS_LABELS } from "@/lib/types";
import { changeStatusSchema } from "@/lib/validators";
import { assertCanMutateFieldWork, changeWorkOrderStatus } from "@/lib/work-orders";

export const runtime = "nodejs";

type Context = {
  params: Promise<{ id: string }>;
};

const MANAGER_NOTIFICATION_STATUSES = new Set(["awaiting_acceptance", "paused", "cancelled"]);

function managerNotificationBody(status: string) {
  if (status === "awaiting_acceptance") return "Kỹ thuật đã hoàn tất xử lý, cần kiểm tra nghiệm thu.";
  if (status === "paused") return "Phiếu đang tạm dừng, cần theo dõi điều phối tiếp.";
  if (status === "cancelled") return "Phiếu đã bị hủy.";
  return `Trạng thái mới: ${WORK_ORDER_STATUS_LABELS[status as keyof typeof WORK_ORDER_STATUS_LABELS]}`;
}

export async function POST(request: Request, context: Context) {
  try {
    const user = await requireUser([...OPS_MANAGER_ROLES, "technician", "accountant"]);
    const { id } = await context.params;
    const body = changeStatusSchema.parse(await request.json());

    if (body.status === "paid" || body.status === "debt") {
      throw new HttpError(422, "Cập nhật đã thu/công nợ phải đi qua form thanh toán");
    }

    if (body.status === "cancelled") {
      if (!isOpsManagerRole(user.role)) {
        throw new HttpError(403, "Chỉ admin, điều phối hoặc trưởng nhóm được hủy phiếu");
      }
      if (!body.note) {
        throw new HttpError(422, "Cần nhập lý do hủy phiếu");
      }
    }

    if (user.role === "technician") {
      await assertCanMutateFieldWork(user, id);
    }

    await withTransaction(async (client) => {
      await changeWorkOrderStatus(client, id, body.status, user, body.note, {
        lat: body.checkInLat,
        lng: body.checkInLng,
        updateCustomerLocation: body.updateCustomerLocation,
      });
      if (MANAGER_NOTIFICATION_STATUSES.has(body.status)) {
        const managers = await client.query<{ id: string }>(
          `select id
           from users
           where role in ('admin', 'dispatcher', 'team_lead') and status = 'active'`,
        );
        const technicians = body.status === "cancelled"
          ? await client.query<{ id: string }>(
              `select technician.user_id as id
               from work_order_assignments assignment
               join technicians technician on technician.id = assignment.technician_id
               join users technician_user on technician_user.id = technician.user_id
               where assignment.work_order_id = $1
                 and assignment.unassigned_at is null
                 and technician_user.status = 'active'`,
              [id],
            )
          : { rows: [] as Array<{ id: string }> };
        const recipients = [...new Set([
          ...managers.rows.map((recipient) => recipient.id),
          ...technicians.rows.map((recipient) => recipient.id),
        ])];

        await createNotifications(
          client,
          recipients.map((userId) => ({
            userId,
            workOrderId: id,
            type: `work_order_${body.status}`,
            priority: body.status === "cancelled" ? "urgent" : "high",
            title: WORK_ORDER_STATUS_LABELS[body.status],
            body: managerNotificationBody(body.status),
          })),
        );
      }
    });

    schedulePushProcessing();
    return jsonOk({ ok: true });
  } catch (error) {
    return handleRouteError(error);
  }
}
