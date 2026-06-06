import { requireUser } from "@/lib/auth";
import { query } from "@/lib/db";
import { handleRouteError, jsonOk } from "@/lib/http";

export const runtime = "nodejs";

export async function GET() {
  try {
    const user = await requireUser();

    const result = await query(
      `select id, work_order_id, title, body, read_at, created_at
       from notifications
       where user_id = $1
       order by created_at desc
       limit 60`,
      [user.id],
    );

    return jsonOk({ notifications: result.rows });
  } catch (error) {
    return handleRouteError(error);
  }
}
