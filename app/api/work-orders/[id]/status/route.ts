import { requireUser } from "@/lib/auth";
import { withTransaction } from "@/lib/db";
import { handleRouteError, HttpError, jsonOk } from "@/lib/http";
import { isOpsManagerRole, OPS_MANAGER_ROLES, WORK_ORDER_STATUS_LABELS } from "@/lib/types";
import { changeStatusSchema } from "@/lib/validators";
import { assertCanMutateFieldWork, changeWorkOrderStatus } from "@/lib/work-orders";

export const runtime = "nodejs";

type Context = {
  params: Promise<{ id: string }>;
};

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
      });
      await client.query(
        `insert into notifications (user_id, work_order_id, title, body)
         select u.id, $1, 'Phiếu đã đổi trạng thái', $2
         from users u
         where u.role in ('admin', 'dispatcher', 'team_lead') and u.status = 'active'`,
        [id, `Trạng thái mới: ${WORK_ORDER_STATUS_LABELS[body.status]}`],
      );
    });

    return jsonOk({ ok: true });
  } catch (error) {
    return handleRouteError(error);
  }
}
