import { requireUser } from "@/lib/auth";
import { query } from "@/lib/db";
import { handleRouteError, HttpError, jsonNoContent, jsonOk } from "@/lib/http";
import { parseUuidParam } from "@/lib/route-params";
import { OPS_MANAGER_ROLES } from "@/lib/types";
import { updateTechnicianSchema } from "@/lib/validators";

export const runtime = "nodejs";

type Context = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: Request, context: Context) {
  try {
    await requireUser(OPS_MANAGER_ROLES);
    const { id: rawId } = await context.params;
    const id = parseUuidParam(rawId, "Kỹ thuật viên không hợp lệ");
    const body = updateTechnicianSchema.parse(await request.json());

    const updateResult = await query(
      `update technicians
       set service_area = coalesce($2, service_area),
           status = coalesce($3, status)
       where id = $1
       returning id, user_id, service_area, status`,
      [id, body.serviceArea ?? null, body.status ?? null],
    );

    if (!updateResult.rows[0]) {
      return Response.json({ error: "Không tìm thấy kỹ thuật viên" }, { status: 404 });
    }

    const result = await query(
      `select t.id, t.user_id, u.full_name, u.phone, u.email, t.service_area, t.status,
              count(woa.id) filter (
                where wo.appointment_at is not null
                  and (wo.appointment_at at time zone 'Asia/Ho_Chi_Minh')::date = (timezone('Asia/Ho_Chi_Minh', now()))::date
                  and woa.unassigned_at is null
              ) as jobs_today
       from technicians t
       join users u on u.id = t.user_id
       left join work_order_assignments woa on woa.technician_id = t.id
       left join work_orders wo on wo.id = woa.work_order_id
       where t.id = $1
       group by t.id, u.id
       limit 1`,
      [id],
    );

    return jsonOk({ technician: result.rows[0] });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function DELETE(_request: Request, context: Context) {
  try {
    await requireUser(["admin"]);
    const { id: rawId } = await context.params;
    const id = parseUuidParam(rawId, "Kỹ thuật viên không hợp lệ");

    const activeAssignments = await query(
      "select id from work_order_assignments where technician_id = $1 and unassigned_at is null limit 1",
      [id],
    );

    if (activeAssignments.rows[0]) {
      throw new HttpError(409, "Kỹ thuật viên đang có phiếu active, không thể xóa");
    }

    const result = await query("delete from technicians where id = $1 returning id", [id]);
    if (!result.rows[0]) {
      throw new HttpError(404, "Không tìm thấy kỹ thuật viên");
    }

    return jsonNoContent();
  } catch (error) {
    return handleRouteError(error);
  }
}
