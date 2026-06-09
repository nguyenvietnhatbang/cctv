import { requireUser } from "@/lib/auth";
import { query } from "@/lib/db";
import { handleRouteError, HttpError, jsonOk } from "@/lib/http";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const user = await requireUser(["admin", "technician"]);
    const { searchParams } = new URL(request.url);
    const requestedTechnicianId = searchParams.get("technicianId");

    let technicianId = requestedTechnicianId;

    if (user.role === "technician") {
      const technicianResult = await query<{ id: string }>(
        "select id from technicians where user_id = $1 limit 1",
        [user.id],
      );
      technicianId = technicianResult.rows[0]?.id ?? null;

      if (!technicianId) {
        return jsonOk({ assignmentHistory: [] });
      }
    }

    if (user.role === "admin" && !technicianId) {
      throw new HttpError(422, "Cần chọn kỹ thuật viên");
    }

    const result = await query(
      `select woa.id,
              woa.work_order_id,
              wo.code,
              c.name as customer_name,
              c.phone as customer_phone,
              c.address as customer_address,
              wo.status as work_order_status,
              t.id as technician_id,
              tu.full_name as technician_name,
              au.full_name as assigned_by_name,
              woa.assigned_at,
              woa.unassigned_at,
              woa.note
       from work_order_assignments woa
       join work_orders wo on wo.id = woa.work_order_id
       join customers c on c.id = wo.customer_id
       join technicians t on t.id = woa.technician_id
       join users tu on tu.id = t.user_id
       left join users au on au.id = woa.assigned_by
       where woa.technician_id = $1
       order by woa.assigned_at desc
       limit 120`,
      [technicianId],
    );

    return jsonOk({ assignmentHistory: result.rows });
  } catch (error) {
    return handleRouteError(error);
  }
}
