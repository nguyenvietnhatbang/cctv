import { requireUser } from "@/lib/auth";
import { query } from "@/lib/db";
import { handleRouteError, jsonOk } from "@/lib/http";
import { notificationCursorSchema, notificationReadSchema } from "@/lib/validators";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const user = await requireUser();
    const url = new URL(request.url);
    const cursor = notificationCursorSchema.parse({
      after: url.searchParams.get("after") || undefined,
    });
    const snapshotResult = await query<{ snapshot_at: string }>(
      "select clock_timestamp() as snapshot_at",
    );
    const snapshotAt = snapshotResult.rows[0].snapshot_at;
    const params: unknown[] = [user.id, snapshotAt];
    const cursorFilter = cursor.after
      ? `and created_at > $3::timestamptz`
      : "";
    if (cursor.after) params.push(cursor.after);

    const result = await query(
      `select id, work_order_id, type, priority, title, body, read_at, created_at
       from notifications
       where user_id = $1
         and created_at <= $2::timestamptz
         ${cursorFilter}
       order by created_at desc
       limit 60`,
      params,
    );

    return jsonOk({ notifications: result.rows, snapshotAt });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const user = await requireUser();
    const body = notificationReadSchema.parse(await request.json());

    await query(
      `update notifications
       set read_at = coalesce(read_at, now())
       where user_id = $1
         and read_at is null
         and created_at <= $2::timestamptz`,
      [user.id, body.readBefore],
    );

    return jsonOk({ ok: true, readBefore: body.readBefore });
  } catch (error) {
    return handleRouteError(error);
  }
}
