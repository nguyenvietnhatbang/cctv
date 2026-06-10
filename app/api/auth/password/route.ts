import { hashPassword, requireUser, verifyPassword } from "@/lib/auth";
import { query } from "@/lib/db";
import { handleRouteError, HttpError, jsonOk } from "@/lib/http";
import { changeOwnPasswordSchema } from "@/lib/validators";

export const runtime = "nodejs";

export async function PATCH(request: Request) {
  try {
    const user = await requireUser();
    const body = changeOwnPasswordSchema.parse(await request.json());

    const result = await query<{ password_hash: string }>(
      "select password_hash from users where id = $1 limit 1",
      [user.id],
    );
    const row = result.rows[0];
    if (!row) {
      throw new HttpError(404, "Không tìm thấy tài khoản");
    }

    const currentMatches = await verifyPassword(body.currentPassword, row.password_hash);
    if (!currentMatches) {
      throw new HttpError(422, "Mật khẩu hiện tại chưa đúng");
    }

    const passwordHash = await hashPassword(body.newPassword);
    await query("update users set password_hash = $2 where id = $1", [user.id, passwordHash]);

    return jsonOk({ ok: true });
  } catch (error) {
    return handleRouteError(error);
  }
}
