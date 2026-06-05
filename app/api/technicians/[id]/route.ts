import { requireUser } from "@/lib/auth";
import { query } from "@/lib/db";
import { handleRouteError, HttpError, jsonNoContent, jsonOk } from "@/lib/http";
import { isMockMode, mockStore } from "@/lib/mock-store";
import { updateTechnicianSchema } from "@/lib/validators";

export const runtime = "nodejs";

type Context = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: Request, context: Context) {
  try {
    await requireUser(["admin", "dispatcher"]);
    const { id } = await context.params;
    const body = updateTechnicianSchema.parse(await request.json());
    if (isMockMode()) {
      return jsonOk({ technician: mockStore.updateTechnician(id, body) });
    }

    const result = await query(
      `update technicians
       set service_area = coalesce($2, service_area),
           status = coalesce($3, status)
       where id = $1
       returning id, user_id, service_area, status`,
      [id, body.serviceArea ?? null, body.status ?? null],
    );

    if (!result.rows[0]) {
      return Response.json({ error: "Không tìm thấy kỹ thuật viên" }, { status: 404 });
    }

    return jsonOk({ technician: result.rows[0] });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function DELETE(_request: Request, context: Context) {
  try {
    await requireUser(["admin"]);
    const { id } = await context.params;
    if (isMockMode()) {
      mockStore.updateTechnician(id, { status: "off" });
      return jsonNoContent();
    }

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
