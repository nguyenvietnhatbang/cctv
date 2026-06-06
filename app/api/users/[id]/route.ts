import { requireUser } from "@/lib/auth";
import { query } from "@/lib/db";
import { handleRouteError, HttpError, jsonNoContent, jsonOk } from "@/lib/http";
import { updateUserSchema } from "@/lib/validators";

export const runtime = "nodejs";

type Context = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: Request, context: Context) {
  try {
    await requireUser(["admin"]);
    const { id } = await context.params;
    const body = updateUserSchema.parse(await request.json());

    const updateResult = await query(
      `update users
       set full_name = coalesce($2, full_name),
           email = coalesce($3, email),
           phone = coalesce($4, phone),
           role = coalesce($5, role),
           status = coalesce($6, status)
       where id = $1
       returning id, full_name, email, phone, role, status`,
      [id, body.fullName ?? null, body.email ?? null, body.phone ?? null, body.role ?? null, body.status ?? null],
    );

    if (!updateResult.rows[0]) {
      return Response.json({ error: "Không tìm thấy nhân viên" }, { status: 404 });
    }

    const result = await query(
      `select u.id, u.full_name, u.email, u.phone, u.role, u.status,
              t.id as technician_id, t.service_area, t.status as technician_status
       from users u
       left join technicians t on t.user_id = u.id
       where u.id = $1
       limit 1`,
      [id],
    );

    return jsonOk({ user: result.rows[0] });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function DELETE(_request: Request, context: Context) {
  try {
    await requireUser(["admin"]);
    const { id } = await context.params;

    const result = await query(
      "update users set status = 'inactive' where id = $1 returning id",
      [id],
    );

    if (!result.rows[0]) {
      throw new HttpError(404, "Không tìm thấy nhân viên");
    }

    return jsonNoContent();
  } catch (error) {
    return handleRouteError(error);
  }
}
