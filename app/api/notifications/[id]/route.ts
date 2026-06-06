import { requireUser } from "@/lib/auth";
import { query } from "@/lib/db";
import { handleRouteError, jsonOk } from "@/lib/http";
import { notificationReadSchema } from "@/lib/validators";

export const runtime = "nodejs";

type Context = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: Request, context: Context) {
  try {
    const user = await requireUser();
    const { id } = await context.params;
    const body = notificationReadSchema.parse(await request.json());

    await query(
      `update notifications
       set read_at = case when $3 then coalesce(read_at, now()) else null end
       where id = $1 and user_id = $2`,
      [id, user.id, body.read],
    );

    return jsonOk({ ok: true });
  } catch (error) {
    return handleRouteError(error);
  }
}
