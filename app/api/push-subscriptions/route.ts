import { headers } from "next/headers";
import { requireUser } from "@/lib/auth";
import { query } from "@/lib/db";
import { handleRouteError, jsonCreated, jsonOk } from "@/lib/http";
import { isPushConfigured } from "@/lib/push";
import { pushSubscriptionSchema, pushUnsubscribeSchema } from "@/lib/validators";

export const runtime = "nodejs";

export async function GET() {
  try {
    const user = await requireUser();
    const result = await query(
      `select endpoint, device_name, last_seen_at, created_at
       from push_subscriptions
       where user_id = $1 and disabled_at is null
       order by last_seen_at desc`,
      [user.id],
    );

    return jsonOk({
      configured: isPushConfigured(),
      subscriptions: result.rows,
    });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const body = pushSubscriptionSchema.parse(await request.json());
    const requestHeaders = await headers();
    const userAgent = requestHeaders.get("user-agent");

    const result = await query(
      `insert into push_subscriptions
         (user_id, endpoint, p256dh, auth, device_name, user_agent)
       values ($1, $2, $3, $4, $5, $6)
       on conflict (endpoint)
       do update set
         user_id = excluded.user_id,
         p256dh = excluded.p256dh,
         auth = excluded.auth,
         device_name = excluded.device_name,
         user_agent = excluded.user_agent,
         last_seen_at = now(),
         disabled_at = null
       returning endpoint, device_name, last_seen_at, created_at`,
      [
        user.id,
        body.endpoint,
        body.keys.p256dh,
        body.keys.auth,
        body.deviceName ?? null,
        userAgent,
      ],
    );

    return jsonCreated({ subscription: result.rows[0] });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function DELETE(request: Request) {
  try {
    const user = await requireUser();
    const body = pushUnsubscribeSchema.parse(await request.json());

    await query(
      `update push_subscriptions
       set disabled_at = coalesce(disabled_at, now())
       where user_id = $1 and endpoint = $2`,
      [user.id, body.endpoint],
    );

    return jsonOk({ ok: true });
  } catch (error) {
    return handleRouteError(error);
  }
}
