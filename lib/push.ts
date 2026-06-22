import "server-only";

import webPush, { WebPushError } from "web-push";
import { query, withTransaction } from "@/lib/db";

const MAX_ATTEMPTS = 5;
const DEFAULT_BATCH_SIZE = 50;

type ClaimedJob = {
  id: string;
  notification_id: string;
  subscription_id: string;
  attempt_count: number;
};

type PushJob = ClaimedJob & {
  endpoint: string;
  p256dh: string;
  auth: string;
  title: string;
  body: string;
  priority: "normal" | "high" | "urgent";
  work_order_id: string | null;
};

export function isPushConfigured() {
  return Boolean(
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
      && process.env.VAPID_PRIVATE_KEY
      && process.env.VAPID_SUBJECT,
  );
}

function configureWebPush() {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT;

  if (!publicKey || !privateKey || !subject) {
    throw new Error("Web Push chưa được cấu hình VAPID");
  }

  webPush.setVapidDetails(subject, publicKey, privateKey);
}

function pushPayload(job: PushJob) {
  const url = job.work_order_id
    ? `/notifications?order=${encodeURIComponent(job.work_order_id)}`
    : "/notifications";

  return JSON.stringify({
    title: job.title,
    body: job.body,
    icon: "/pwa/icon-192.png",
    badge: "/pwa/icon-192.png",
    tag: job.notification_id,
    url,
    notificationId: job.notification_id,
    requireInteraction: job.priority === "urgent",
  });
}

async function claimPushJobs(limit: number) {
  return withTransaction(async (client) => {
    const result = await client.query<ClaimedJob>(
      `with candidates as (
         select id
         from notification_push_jobs
         where (
             status in ('pending', 'retry')
             and available_at <= now()
           )
           or (
             status = 'processing'
             and locked_at < now() - interval '5 minutes'
           )
         order by available_at, created_at
         limit $1
         for update skip locked
       )
       update notification_push_jobs job
       set status = 'processing',
           attempt_count = job.attempt_count + 1,
           locked_at = now(),
           last_error = null
       from candidates
       where job.id = candidates.id
       returning job.id, job.notification_id, job.subscription_id, job.attempt_count`,
      [limit],
    );

    return result.rows;
  });
}

async function loadPushJobs(claimed: ClaimedJob[]) {
  if (claimed.length === 0) return [];

  const result = await query<PushJob>(
    `select job.id, job.notification_id, job.subscription_id, job.attempt_count,
            subscription.endpoint, subscription.p256dh, subscription.auth,
            notification.title, notification.body, notification.priority,
            notification.work_order_id
     from notification_push_jobs job
     join push_subscriptions subscription on subscription.id = job.subscription_id
     join notifications notification on notification.id = job.notification_id
     where job.id = any($1::uuid[])
       and subscription.disabled_at is null`,
    [claimed.map((job) => job.id)],
  );

  const loadedIds = new Set(result.rows.map((job) => job.id));
  const missingIds = claimed.filter((job) => !loadedIds.has(job.id)).map((job) => job.id);
  if (missingIds.length > 0) {
    await query(
      `update notification_push_jobs
       set status = 'failed',
           last_error = 'Subscription không còn hoạt động',
           locked_at = null
       where id = any($1::uuid[])`,
      [missingIds],
    );
  }

  return result.rows;
}

function retryDelaySeconds(attemptCount: number) {
  return Math.min(60 * 2 ** Math.max(attemptCount - 1, 0), 60 * 60);
}

async function markPushSent(jobId: string) {
  await query(
    `update notification_push_jobs
     set status = 'sent',
         sent_at = now(),
         locked_at = null,
         last_error = null
     where id = $1`,
    [jobId],
  );
}

async function markPushFailed(job: PushJob, error: unknown) {
  const statusCode = error instanceof WebPushError ? error.statusCode : null;
  const message = error instanceof Error ? error.message.slice(0, 1000) : "Lỗi gửi Web Push";
  const subscriptionExpired = statusCode === 404 || statusCode === 410;
  const exhausted = job.attempt_count >= MAX_ATTEMPTS;

  await withTransaction(async (client) => {
    if (subscriptionExpired) {
      await client.query(
        `update push_subscriptions
         set disabled_at = coalesce(disabled_at, now())
         where id = $1`,
        [job.subscription_id],
      );
      await client.query(
        `update notification_push_jobs
         set status = 'failed',
             locked_at = null,
             last_error = $2
         where subscription_id = $1
           and status in ('pending', 'processing', 'retry')`,
        [job.subscription_id, message],
      );
      return;
    }

    await client.query(
      `update notification_push_jobs
       set status = $2,
           available_at = case
             when $2 = 'retry' then now() + make_interval(secs => $3)
             else available_at
           end,
           locked_at = null,
           last_error = $4
       where id = $1`,
      [
        job.id,
        exhausted ? "failed" : "retry",
        retryDelaySeconds(job.attempt_count),
        message,
      ],
    );
  });
}

export async function sendTestPush(subscription: {
  endpoint: string;
  p256dh: string;
  auth: string;
}) {
  configureWebPush();
  return webPush.sendNotification(
    {
      endpoint: subscription.endpoint,
      keys: {
        p256dh: subscription.p256dh,
        auth: subscription.auth,
      },
    },
    JSON.stringify({
      title: "Thông báo thử thành công",
      body: "Thiết bị này đã sẵn sàng nhận cập nhật công việc.",
      icon: "/pwa/icon-192.png",
      badge: "/pwa/icon-192.png",
      tag: `push-test-${Date.now()}`,
      url: "/notifications",
    }),
    { TTL: 60 },
  );
}

export async function processPushJobs(limit = DEFAULT_BATCH_SIZE) {
  if (!isPushConfigured()) {
    return { configured: false, processed: 0, sent: 0, failed: 0 };
  }

  configureWebPush();
  const claimed = await claimPushJobs(limit);
  const jobs = await loadPushJobs(claimed);
  let sent = 0;
  let failed = 0;

  await Promise.all(
    jobs.map(async (job) => {
      try {
        await webPush.sendNotification(
          {
            endpoint: job.endpoint,
            keys: { p256dh: job.p256dh, auth: job.auth },
          },
          pushPayload(job),
          {
            TTL: job.priority === "urgent" ? 60 * 60 : 60 * 30,
            urgency: job.priority === "urgent" ? "high" : "normal",
          },
        );
        await markPushSent(job.id);
        sent += 1;
      } catch (error) {
        await markPushFailed(job, error);
        failed += 1;
      }
    }),
  );

  return { configured: true, processed: jobs.length, sent, failed };
}
