alter table public.push_subscriptions
  add column if not exists display_mode text not null default 'browser';

alter table public.push_subscriptions
  drop constraint if exists push_subscriptions_display_mode_check,
  add constraint push_subscriptions_display_mode_check
    check (display_mode in ('browser', 'standalone'));

update public.push_subscriptions browser_subscription
set disabled_at = coalesce(browser_subscription.disabled_at, now())
where browser_subscription.display_mode = 'browser'
  and browser_subscription.disabled_at is null
  and exists (
    select 1
    from public.push_subscriptions app_subscription
    where app_subscription.user_id = browser_subscription.user_id
      and app_subscription.endpoint <> browser_subscription.endpoint
      and app_subscription.display_mode = 'standalone'
      and app_subscription.disabled_at is null
      and coalesce(app_subscription.user_agent, '') = coalesce(browser_subscription.user_agent, '')
  );
