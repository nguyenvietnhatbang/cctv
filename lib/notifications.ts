import "server-only";

import { after } from "next/server";
import type { PoolClient } from "pg";
import { processPushJobs } from "@/lib/push";

export type NotificationPriority = "normal" | "high" | "urgent";

export type CreateNotificationInput = {
  userId: string;
  workOrderId?: string | null;
  type: string;
  priority?: NotificationPriority;
  dedupeKey?: string | null;
  title: string;
  body: string;
};

type CreatedNotification = {
  id: string;
};

export async function createNotifications(
  client: PoolClient,
  notifications: CreateNotificationInput[],
) {
  const created: CreatedNotification[] = [];

  for (const notification of notifications) {
    const result = await client.query<CreatedNotification>(
      `insert into notifications
         (user_id, work_order_id, type, priority, dedupe_key, title, body)
       values ($1, $2, $3, $4, $5, $6, $7)
       on conflict (user_id, dedupe_key) where dedupe_key is not null
       do nothing
       returning id`,
      [
        notification.userId,
        notification.workOrderId ?? null,
        notification.type,
        notification.priority ?? "normal",
        notification.dedupeKey ?? null,
        notification.title,
        notification.body,
      ],
    );

    if (result.rows[0]) {
      created.push(result.rows[0]);
    }
  }

  if (created.length > 0) {
    await client.query(
      `insert into notification_push_jobs (notification_id, subscription_id)
       select pending.notification_id, subscription.id
       from unnest($1::uuid[]) as pending(notification_id)
       join notifications notification on notification.id = pending.notification_id
       join push_subscriptions subscription
         on subscription.user_id = notification.user_id
        and subscription.disabled_at is null
       on conflict (notification_id, subscription_id) do nothing`,
      [created.map((notification) => notification.id)],
    );
  }

  return created.map((notification) => notification.id);
}

export function schedulePushProcessing() {
  after(async () => {
    try {
      await processPushJobs();
    } catch (error) {
      console.error("Không thể xử lý Web Push sau request", error);
    }
  });
}
