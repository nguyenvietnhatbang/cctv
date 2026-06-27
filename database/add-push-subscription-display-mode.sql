alter table public.push_subscriptions
  add column if not exists display_mode text not null default 'browser';

alter table public.push_subscriptions
  drop constraint if exists push_subscriptions_display_mode_check,
  add constraint push_subscriptions_display_mode_check
    check (display_mode in ('browser', 'standalone'));

update public.push_subscriptions
set disabled_at = coalesce(disabled_at, now())
where display_mode = 'browser'
  and disabled_at is null;
