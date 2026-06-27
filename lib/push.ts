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
  created_at: string;
  unread_count: number;
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
  const notificationTag = job.work_order_id
    ? `work-order-${job.work_order_id}`
    : `notification-${job.notification_id}`;

  return JSON.stringify({
    title: job.title,
    body: job.body,
    icon: "/pwa/icon-192.png",
    badge: "/pwa/icon-192.png",
    tag: notificationTag,
    notificationId: job.notification_id,
    workOrderId: job.work_order_id,
    url: job.work_order_id ? `/notifications?order=${encodeURIComponent(job.work_order_id)}` : "/notifications",
    timestamp: new Date(job.created_at).getTime(),
    unreadCount: job.unread_count,
    renotify: job.priority !== "normal",
    requireInteraction: job.priority === "urgent",
  });
}

function pushTopic(job: PushJob) {
  return (job.work_order_id ?? job.notification_id).replaceAll("-", "");
}

function collapsePushJobs(jobs: PushJob[]) {
  const latestBySubscriptionAndTopic = new Map<string, PushJob>();
  const supersededJobIds: string[] = [];

  for (const job of jobs) {
    const key = `${job.subscription_id}:${pushTopic(job)}`;
    const current = latestBySubscriptionAndTopic.get(key);
    if (!current) {
      latestBySubscriptionAndTopic.set(key, job);
      continue;
    }

    if (new Date(job.created_at).getTime() > new Date(current.created_at).getTime()) {
      supersededJobIds.push(current.id);
      latestBySubscriptionAndTopic.set(key, job);
    } else {
      supersededJobIds.push(job.id);
    }
  }

  return {
    jobsToSend: [...latestBySubscriptionAndTopic.values()],
    supersededJobIds,
  };
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
    `with selected_jobs as (
       select job.id, job.notification_id, job.subscription_id, job.attempt_count,
              subscription.endpoint, subscription.p256dh, subscription.auth,
              notification.user_id, notification.title, notification.body,
              notification.priority, notification.work_order_id,
              notification.created_at
       from notification_push_jobs job
       join push_subscriptions subscription on subscription.id = job.subscription_id
       join notifications notification on notification.id = job.notification_id
       where job.id = any($1::uuid[])
         and subscription.disabled_at is null
     ),
     unread_counts as (
       select notification.user_id, count(*)::integer as unread_count
       from notifications notification
       where notification.read_at is null
         and notification.user_id in (
           select distinct selected_job.user_id
           from selected_jobs selected_job
         )
       group by notification.user_id
     )
     select selected_job.id, selected_job.notification_id,
            selected_job.subscription_id, selected_job.attempt_count,
            selected_job.endpoint, selected_job.p256dh, selected_job.auth,
            selected_job.title, selected_job.body, selected_job.priority,
            selected_job.work_order_id,
            selected_job.created_at, coalesce(unread_count.unread_count, 0) as unread_count
     from selected_jobs selected_job
     left join unread_counts unread_count on unread_count.user_id = selected_job.user_id`,
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

async function markPushJobsSuperseded(jobIds: string[]) {
  if (jobIds.length === 0) return;

  await query(
    `update notification_push_jobs
     set status = 'sent',
         sent_at = now(),
         locked_at = null,
         last_error = null
     where id = any($1::uuid[])`,
    [jobIds],
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

export async function processPushJobs(limit = DEFAULT_BATCH_SIZE) {
  if (!isPushConfigured()) {
    return { configured: false, processed: 0, sent: 0, failed: 0 };
  }

  configureWebPush();
  const claimed = await claimPushJobs(limit);
  const jobs = await loadPushJobs(claimed);
  const { jobsToSend, supersededJobIds } = collapsePushJobs(jobs);
  await markPushJobsSuperseded(supersededJobIds);
  let sent = 0;
  let failed = 0;

  await Promise.all(
    jobsToSend.map(async (job) => {
      try {
        await webPush.sendNotification(
          {
            endpoint: job.endpoint,
            keys: { p256dh: job.p256dh, auth: job.auth },
          },
          pushPayload(job),
          {
            TTL: job.priority === "urgent" ? 60 * 60 : 60 * 30,
            urgency: job.priority === "normal" ? "normal" : "high",
            topic: pushTopic(job),
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
