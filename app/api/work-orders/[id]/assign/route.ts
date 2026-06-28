import { requireUser } from "@/lib/auth";
import { withTransaction } from "@/lib/db";
import { handleRouteError, HttpError, jsonOk } from "@/lib/http";
import { createNotifications, schedulePushProcessing } from "@/lib/notifications";
import { parseUuidParam } from "@/lib/route-params";
import { OPS_MANAGER_ROLES, type WorkOrderStatus } from "@/lib/types";
import { assignWorkOrderSchema } from "@/lib/validators";
import { changeWorkOrderStatus, syncTechnicianStatuses } from "@/lib/work-orders";

export const runtime = "nodejs";

type Context = {
  params: Promise<{ id: string }>;
};

function uniqueIds(ids: Array<string | null | undefined>) {
  return [...new Set(ids.filter((id): id is string => Boolean(id)))];
}

export async function POST(request: Request, context: Context) {
  try {
    const user = await requireUser(OPS_MANAGER_ROLES);
    const { id: rawId } = await context.params;
    const id = parseUuidParam(rawId, "Phiếu không hợp lệ");
    const body = assignWorkOrderSchema.parse(await request.json());
    const nextTechnicianIds = uniqueIds([...(body.technicianIds ?? []), body.technicianId]);

    await withTransaction(async (client) => {
      const statusResult = await client.query<{ status: WorkOrderStatus; code: string }>(
        "select status, code from work_orders where id = $1 for update",
        [id],
      );
      const current = statusResult.rows[0];
      if (!current) {
        throw new HttpError(404, "Không tìm thấy phiếu");
      }
      if (["completed", "awaiting_payment", "paid", "debt", "cancelled"].includes(current.status)) {
        throw new HttpError(422, "Không thể đổi phân công sau khi phiếu đã khóa");
      }

      const activeAssignments = await client.query<{ technician_id: string; user_id: string }>(
        `select assignment.technician_id, technician.user_id
         from work_order_assignments assignment
         join technicians technician on technician.id = assignment.technician_id
         where assignment.work_order_id = $1 and assignment.unassigned_at is null`,
        [id],
      );
      const oldTechnicianIds = activeAssignments.rows.map((assignment) => assignment.technician_id);
      const removedTechnicianIds = oldTechnicianIds.filter((technicianId) => !nextTechnicianIds.includes(technicianId));
      const addedTechnicianIds = nextTechnicianIds.filter((technicianId) => !oldTechnicianIds.includes(technicianId));

      const technicianResult = await client.query<{ id: string; user_id: string }>(
        `select t.id, t.user_id
         from technicians t
         join users u on u.id = t.user_id
         where t.id = any($1::uuid[]) and u.status = 'active'`,
        [nextTechnicianIds],
      );
      if (technicianResult.rows.length !== nextTechnicianIds.length) {
        throw new HttpError(422, "Danh sách kỹ thuật viên không hợp lệ hoặc có người đã ngưng hoạt động");
      }

      if (removedTechnicianIds.length > 0) {
        await client.query(
          `update work_order_assignments
           set unassigned_at = now()
           where work_order_id = $1
             and unassigned_at is null
             and technician_id = any($2::uuid[])`,
          [id, removedTechnicianIds],
        );
      }

      if (addedTechnicianIds.length > 0) {
        await client.query(
          `insert into work_order_assignments (work_order_id, technician_id, assigned_by, note)
           select $1, id, $3, $4
           from technicians
           where id = any($2::uuid[])`,
          [id, addedTechnicianIds, user.id, body.note],
        );
      }

      const addedUsers = technicianResult.rows
        .filter((technician) => addedTechnicianIds.includes(technician.id))
        .map((technician) => technician.user_id);
      const removedUsers = activeAssignments.rows
        .filter((assignment) => removedTechnicianIds.includes(assignment.technician_id))
        .map((assignment) => assignment.user_id);

      await createNotifications(client, [
        ...addedUsers.map((userId) => ({
          userId,
          workOrderId: id,
          type: "work_order_assigned",
          priority: "high" as const,
          title: "Bạn được giao phiếu mới",
          body: "Mở phiếu để xem lịch hẹn và nhận việc.",
        })),
        ...removedUsers.map((userId) => ({
          userId,
          workOrderId: null,
          type: "work_order_unassigned",
          priority: "high" as const,
          title: `Bạn đã được rút khỏi phiếu ${current.code}`,
          body: "Phiếu này không còn nằm trong danh sách công việc được giao cho bạn.",
        })),
      ]);

      if (current.status === "pending_assignment") {
        await changeWorkOrderStatus(client, id, "assigned", user, body.note ?? `Phân công ${nextTechnicianIds.length} kỹ thuật viên`);
        await syncTechnicianStatuses(client, [...oldTechnicianIds, ...nextTechnicianIds]);
        return;
      }

      await client.query(
        `insert into work_order_status_history
           (work_order_id, from_status, to_status, changed_by, note)
        values ($1, $2, $2, $3, $4)`,
        [id, current.status, user.id, body.note ?? `Cập nhật phân công ${nextTechnicianIds.length} kỹ thuật viên`],
      );

      await syncTechnicianStatuses(client, [...oldTechnicianIds, ...nextTechnicianIds]);
    });

    schedulePushProcessing();
    return jsonOk({ ok: true });
  } catch (error) {
    return handleRouteError(error);
  }
}
