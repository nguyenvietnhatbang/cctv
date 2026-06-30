import { requireUser } from "@/lib/auth";
import { query } from "@/lib/db";
import { handleRouteError, HttpError, jsonOk } from "@/lib/http";
import { z } from "zod";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const user = await requireUser(["admin", "technician", "team_lead"]);
    const { searchParams } = new URL(request.url);
    const requestedTechnicianId = searchParams.get("technicianId");
    const pageParam = searchParams.get("page");
    const pageSizeParam = searchParams.get("pageSize");
    const limitParam = searchParams.get("limit");
    const page = pageParam ? Number(pageParam) : 1;
    const limit = pageSizeParam ? Number(pageSizeParam) : limitParam ? Number(limitParam) : 120;
    if (!Number.isInteger(limit) || limit < 1 || limit > 500) {
      throw new HttpError(422, "Giới hạn lịch sử phân công không hợp lệ");
    }
    if (!Number.isInteger(page) || page < 1) {
      throw new HttpError(422, "Trang lịch sử phân công không hợp lệ");
    }
    const offset = pageSizeParam || pageParam ? (page - 1) * limit : 0;

    let technicianId = requestedTechnicianId;

    if (user.role === "technician" || (user.role === "team_lead" && !technicianId)) {
      const technicianResult = await query<{ id: string }>(
        "select id from technicians where user_id = $1 limit 1",
        [user.id],
      );
      technicianId = technicianResult.rows[0]?.id ?? null;

      if (!technicianId) {
        return jsonOk({
          assignmentHistory: [],
          total: 0,
          page,
          pageSize: limit,
          totalPages: 1,
        });
      }
    }

    if (user.role === "admin" && !technicianId) {
      throw new HttpError(422, "Cần chọn kỹ thuật viên");
    }

    const parsedTechnicianId = z.string().uuid().safeParse(technicianId);
    if (!parsedTechnicianId.success) {
      throw new HttpError(422, "Kỹ thuật viên không hợp lệ");
    }
    technicianId = parsedTechnicianId.data;

    const countResult = await query<{ total: string }>(
      `select count(*)::text as total
       from work_order_assignments woa
       where woa.technician_id = $1`,
      [technicianId],
    );

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
       limit $2 offset $3`,
      [technicianId, limit, offset],
    );

    const total = Number(countResult.rows[0]?.total ?? 0);
    return jsonOk({
      assignmentHistory: result.rows,
      total,
      page,
      pageSize: limit,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
