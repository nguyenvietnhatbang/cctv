import { requireUser } from "@/lib/auth";
import { withTransaction } from "@/lib/db";
import { handleRouteError, HttpError, jsonOk } from "@/lib/http";
import type { WorkOrderStatus } from "@/lib/types";
import { assignWorkOrderSchema } from "@/lib/validators";
import { changeWorkOrderStatus, syncTechnicianStatuses } from "@/lib/work-orders";

export const runtime = "nodejs";

type Context = {
  params: Promise<{ id: string }>;
};

export async function POST(request: Request, context: Context) {
  try {
    const user = await requireUser(["admin", "dispatcher"]);
    const { id } = await context.params;
    const body = assignWorkOrderSchema.parse(await request.json());

    await withTransaction(async (client) => {
      const statusResult = await client.query<{ status: WorkOrderStatus }>(
        "select status from work_orders where id = $1 for update",
        [id],
      );
      const current = statusResult.rows[0];
      if (!current) {
        throw new HttpError(404, "Không tìm thấy phiếu");
      }
      if (["completed", "awaiting_payment", "paid", "debt", "cancelled"].includes(current.status)) {
        throw new HttpError(422, "Không thể đổi phân công sau khi phiếu đã khóa");
      }

      const oldAssignments = await client.query<{ technician_id: string }>(
        `update work_order_assignments
         set unassigned_at = now()
         where work_order_id = $1 and unassigned_at is null
         returning technician_id`,
        [id],
      );
      await client.query(
        `insert into work_order_assignments (work_order_id, technician_id, assigned_by, note)
         values ($1, $2, $3, $4)`,
        [id, body.technicianId, user.id, body.note],
      );
      await client.query(
        `insert into notifications (user_id, work_order_id, title, body)
         select t.user_id, $1, 'Bạn được giao phiếu mới', 'Mở phiếu để xem địa chỉ, liên hệ khách và nhận việc.'
         from technicians t
         where t.id = $2`,
        [id, body.technicianId],
      );

      if (current.status === "pending_assignment") {
        await changeWorkOrderStatus(client, id, "assigned", user, body.note ?? "Phân công kỹ thuật viên");
        await syncTechnicianStatuses(client, [
          ...oldAssignments.rows.map((assignment) => assignment.technician_id),
          body.technicianId,
        ]);
        return;
      }

      await client.query(
        `insert into work_order_status_history
           (work_order_id, from_status, to_status, changed_by, note)
        values ($1, $2, $2, $3, $4)`,
        [id, current.status, user.id, body.note ?? "Đổi kỹ thuật viên phụ trách"],
      );
      await syncTechnicianStatuses(client, [
        ...oldAssignments.rows.map((assignment) => assignment.technician_id),
        body.technicianId,
      ]);
    });

    return jsonOk({ ok: true });
  } catch (error) {
    return handleRouteError(error);
  }
}
