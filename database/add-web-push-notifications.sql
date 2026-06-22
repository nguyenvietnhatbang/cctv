alter table public.notifications
  add column if not exists type text not null default 'general',
  add column if not exists priority text not null default 'normal',
  add column if not exists dedupe_key text;

alter table public.notifications
  drop constraint if exists notifications_priority_check,
  add constraint notifications_priority_check
    check (priority in ('normal', 'high', 'urgent'));

create unique index if not exists notifications_user_dedupe_idx
  on public.notifications(user_id, dedupe_key)
  where dedupe_key is not null;

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  device_name text,
  user_agent text,
  last_seen_at timestamptz not null default now(),
  disabled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists push_subscriptions_user_active_idx
  on public.push_subscriptions(user_id, last_seen_at desc)
  where disabled_at is null;

create table if not exists public.notification_push_jobs (
  id uuid primary key default gen_random_uuid(),
  notification_id uuid not null references public.notifications(id) on delete cascade,
  subscription_id uuid not null references public.push_subscriptions(id) on delete cascade,
  status text not null default 'pending',
  attempt_count integer not null default 0,
  available_at timestamptz not null default now(),
  locked_at timestamptz,
  sent_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint notification_push_jobs_status_check
    check (status in ('pending', 'processing', 'retry', 'sent', 'failed')),
  constraint notification_push_jobs_attempt_count_check
    check (attempt_count >= 0),
  unique(notification_id, subscription_id)
);

create index if not exists notification_push_jobs_pending_idx
  on public.notification_push_jobs(available_at, created_at)
  where status in ('pending', 'retry');

alter table public.push_subscriptions enable row level security;
alter table public.notification_push_jobs enable row level security;

revoke all on table public.push_subscriptions from anon, authenticated;
revoke all on table public.notification_push_jobs from anon, authenticated;

drop trigger if exists push_subscriptions_touch_updated_at on public.push_subscriptions;
create trigger push_subscriptions_touch_updated_at
before update on public.push_subscriptions
for each row execute function public.touch_updated_at();

drop trigger if exists notification_push_jobs_touch_updated_at on public.notification_push_jobs;
create trigger notification_push_jobs_touch_updated_at
before update on public.notification_push_jobs
for each row execute function public.touch_updated_at();
