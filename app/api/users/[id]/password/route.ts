import { hashPassword, requireUser } from "@/lib/auth";
import { query } from "@/lib/db";
import { handleRouteError, HttpError, jsonOk } from "@/lib/http";
import { parseUuidParam } from "@/lib/route-params";
import { adminResetPasswordSchema } from "@/lib/validators";

export const runtime = "nodejs";

type Context = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: Request, context: Context) {
  try {
    await requireUser(["admin"]);
    const { id: rawId } = await context.params;
    const id = parseUuidParam(rawId, "Nhân viên không hợp lệ");
    const body = adminResetPasswordSchema.parse(await request.json());
    const passwordHash = await hashPassword(body.newPassword);

    const result = await query(
      "update users set password_hash = $2 where id = $1 returning id",
      [id, passwordHash],
    );

    if (!result.rows[0]) {
      throw new HttpError(404, "Không tìm thấy nhân viên");
    }

    return jsonOk({ ok: true });
  } catch (error) {
    return handleRouteError(error);
  }
}
