create index if not exists notifications_user_unread_idx
  on public.notifications(user_id)
  where read_at is null;
