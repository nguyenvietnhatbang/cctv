create table if not exists public.work_order_field_sessions (
  id uuid primary key default gen_random_uuid(),
  work_order_id uuid not null references public.work_orders(id) on delete cascade,
  assignment_id uuid not null references public.work_order_assignments(id) on delete cascade,
  technician_id uuid not null references public.technicians(id),
  check_in_at timestamptz not null default now(),
  check_out_at timestamptz,
  ended_by_status work_order_status,
  created_at timestamptz not null default now(),
  constraint work_order_field_sessions_time_check check (check_out_at is null or check_out_at >= check_in_at)
);

create unique index if not exists work_order_field_sessions_one_open_idx
  on public.work_order_field_sessions(assignment_id)
  where check_out_at is null;

create index if not exists work_order_field_sessions_technician_time_idx
  on public.work_order_field_sessions(technician_id, check_in_at desc);

create index if not exists work_order_field_sessions_order_time_idx
  on public.work_order_field_sessions(work_order_id, check_in_at desc);
