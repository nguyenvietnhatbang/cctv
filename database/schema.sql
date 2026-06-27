create extension if not exists pgcrypto;
create extension if not exists pg_trgm;

create type app_role as enum ('admin', 'dispatcher', 'team_lead', 'technician', 'accountant');
create type user_status as enum ('active', 'inactive');
create type technician_status as enum ('available', 'traveling', 'working', 'off');
create type work_order_type as enum ('warranty', 'maintenance', 'installation', 'add_on', 'maintenance_repair', 'relocation', 'other');
create type work_order_priority as enum ('normal', 'urgent');
create type work_order_status as enum (
  'pending_assignment',
  'assigned',
  'accepted',
  'traveling',
  'working',
  'awaiting_acceptance',
  'completed',
  'awaiting_payment',
  'paid',
  'debt',
  'paused',
  'cancelled'
);
create type payment_status as enum ('unpaid', 'paid', 'debt');
create type payment_method as enum ('cash', 'bank_transfer', 'debt');
create type work_order_file_purpose as enum ('initial', 'before', 'after', 'signature', 'bill', 'request_document', 'handover_document');

create table users (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  email text unique,
  phone text unique,
  password_hash text not null,
  role app_role not null,
  status user_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint users_login_identifier_required check (email is not null or phone is not null)
);

create index users_email_lower_idx on users(lower(email));

create table customers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text not null,
  address text not null,
  address_note text,
  lat numeric(10, 7),
  lng numeric(10, 7),
  location_pinned_at timestamptz,
  location_pinned_by uuid references users(id) on delete set null,
  created_by uuid references users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index customers_phone_idx on customers(phone);
create index customers_name_trgm_idx on customers using gin (name gin_trgm_ops);
create index customers_address_trgm_idx on customers using gin (address gin_trgm_ops);

create table customer_contacts (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references customers(id) on delete cascade,
  name text not null,
  phone text not null,
  note text,
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index customer_contacts_customer_idx on customer_contacts(customer_id);
create index customer_contacts_phone_idx on customer_contacts(phone);

create unique index customer_contacts_one_primary_idx
  on customer_contacts(customer_id)
  where is_primary;

create table technicians (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references users(id) on delete cascade,
  service_area text,
  status technician_status not null default 'available',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table work_orders (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  customer_id uuid not null references customers(id),
  type work_order_type not null,
  priority work_order_priority not null default 'normal',
  status work_order_status not null default 'pending_assignment',
  description text not null,
  appointment_at timestamptz,
  internal_note text,
  labor_cost numeric(12, 2) not null default 0,
  material_cost numeric(12, 2) not null default 0 check (material_cost >= 0),
  vat_rate numeric(5, 2) not null default 0,
  cancellation_reason text,
  check_in_at timestamptz,
  check_in_lat numeric(10, 7),
  check_in_lng numeric(10, 7),
  completion_note text,
  acceptance_name text,
  acceptance_phone text,
  accepted_at timestamptz,
  created_by uuid references users(id) on delete set null,
  updated_by uuid references users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index work_orders_status_idx on work_orders(status);
create index work_orders_customer_idx on work_orders(customer_id);
create index work_orders_appointment_idx on work_orders(appointment_at);
create index work_orders_created_at_idx on work_orders(created_at desc);
create index work_orders_updated_at_idx on work_orders(updated_at desc);
create index work_orders_status_appointment_idx on work_orders(status, appointment_at desc);
create index work_orders_open_appointment_idx on work_orders(appointment_at desc, created_at desc)
  where status not in ('paid', 'cancelled');
create index work_orders_code_trgm_idx on work_orders using gin (code gin_trgm_ops);
create index work_orders_description_trgm_idx on work_orders using gin (description gin_trgm_ops);

create table work_order_assignments (
  id uuid primary key default gen_random_uuid(),
  work_order_id uuid not null references work_orders(id) on delete cascade,
  technician_id uuid not null references technicians(id),
  assigned_by uuid references users(id) on delete set null,
  assigned_at timestamptz not null default now(),
  unassigned_at timestamptz,
  note text
);

create unique index work_order_active_assignment_idx
  on work_order_assignments(work_order_id, technician_id)
  where unassigned_at is null;

create index work_order_assignments_technician_active_idx
  on work_order_assignments(technician_id, work_order_id)
  where unassigned_at is null;

create index work_order_assignments_order_active_assigned_idx
  on work_order_assignments(work_order_id, assigned_at)
  where unassigned_at is null;

create table work_order_status_history (
  id uuid primary key default gen_random_uuid(),
  work_order_id uuid not null references work_orders(id) on delete cascade,
  from_status work_order_status,
  to_status work_order_status not null,
  changed_by uuid references users(id) on delete set null,
  changed_at timestamptz not null default now(),
  note text
);

create index work_order_status_history_order_idx on work_order_status_history(work_order_id, changed_at desc);

create table work_order_materials (
  id uuid primary key default gen_random_uuid(),
  work_order_id uuid not null references work_orders(id) on delete cascade,
  name text not null,
  quantity numeric(12, 2) not null check (quantity > 0),
  unit_price numeric(12, 2) not null default 0 check (unit_price >= 0),
  line_total numeric(12, 2) generated always as (quantity * unit_price) stored,
  created_by uuid references users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index work_order_materials_order_created_idx on work_order_materials(work_order_id, created_at desc);

create table work_order_files (
  id uuid primary key default gen_random_uuid(),
  work_order_id uuid not null references work_orders(id) on delete cascade,
  bucket text not null,
  path text not null,
  original_name text not null,
  mime_type text not null,
  size_bytes bigint not null,
  purpose work_order_file_purpose not null,
  uploaded_by uuid references users(id) on delete set null,
  uploaded_at timestamptz not null default now(),
  unique(bucket, path)
);

create index work_order_files_order_uploaded_idx on work_order_files(work_order_id, uploaded_at desc);

create table payments (
  id uuid primary key default gen_random_uuid(),
  work_order_id uuid not null unique references work_orders(id) on delete cascade,
  labor_amount numeric(12, 2) not null default 0,
  material_amount numeric(12, 2) not null default 0,
  vat_amount numeric(12, 2) not null default 0,
  total_amount numeric(12, 2) not null default 0,
  paid_amount numeric(12, 2) not null default 0,
  debt_amount numeric(12, 2) not null default 0,
  status payment_status not null default 'unpaid',
  method payment_method,
  transaction_ref text,
  debt_due_date date,
  note text,
  confirmed_by uuid references users(id) on delete set null,
  confirmed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint paid_requires_method check (status <> 'paid' or method is not null),
  constraint debt_requires_note_or_due_date check (status <> 'debt' or note is not null or debt_due_date is not null)
);

create index payments_status_confirmed_idx on payments(status, confirmed_at desc);

create table payment_transactions (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid not null references payments(id) on delete cascade,
  work_order_id uuid not null references work_orders(id) on delete cascade,
  amount numeric(12, 2) not null check (amount > 0),
  method payment_method not null check (method <> 'debt'),
  transaction_ref text not null unique,
  note text,
  collected_by uuid references users(id) on delete set null,
  collected_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index payment_transactions_work_order_idx on payment_transactions(work_order_id, collected_at desc);
create index payment_transactions_collected_idx on payment_transactions(collected_at desc);

create table notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  work_order_id uuid references work_orders(id) on delete cascade,
  type text not null default 'general',
  priority text not null default 'normal' check (priority in ('normal', 'high', 'urgent')),
  dedupe_key text,
  title text not null,
  body text not null,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index notifications_user_created_idx on notifications(user_id, created_at desc);
create index notifications_user_unread_idx
  on notifications(user_id)
  where read_at is null;
create unique index notifications_user_dedupe_idx
  on notifications(user_id, dedupe_key)
  where dedupe_key is not null;

create table push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  device_name text,
  user_agent text,
  display_mode text not null default 'browser'
    check (display_mode in ('browser', 'standalone')),
  last_seen_at timestamptz not null default now(),
  disabled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index push_subscriptions_user_active_idx
  on push_subscriptions(user_id, last_seen_at desc)
  where disabled_at is null;

create table notification_push_jobs (
  id uuid primary key default gen_random_uuid(),
  notification_id uuid not null references notifications(id) on delete cascade,
  subscription_id uuid not null references push_subscriptions(id) on delete cascade,
  status text not null default 'pending'
    check (status in ('pending', 'processing', 'retry', 'sent', 'failed')),
  attempt_count integer not null default 0 check (attempt_count >= 0),
  available_at timestamptz not null default now(),
  locked_at timestamptz,
  sent_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(notification_id, subscription_id)
);

create index notification_push_jobs_pending_idx
  on notification_push_jobs(available_at, created_at)
  where status in ('pending', 'retry');

alter table push_subscriptions enable row level security;
alter table notification_push_jobs enable row level security;
revoke all on table push_subscriptions from anon, authenticated;
revoke all on table notification_push_jobs from anon, authenticated;

create or replace function touch_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger users_touch_updated_at
before update on users
for each row execute function touch_updated_at();

create trigger customers_touch_updated_at
before update on customers
for each row execute function touch_updated_at();

create trigger customer_contacts_touch_updated_at
before update on customer_contacts
for each row execute function touch_updated_at();

create trigger technicians_touch_updated_at
before update on technicians
for each row execute function touch_updated_at();

create trigger push_subscriptions_touch_updated_at
before update on push_subscriptions
for each row execute function touch_updated_at();

create trigger notification_push_jobs_touch_updated_at
before update on notification_push_jobs
for each row execute function touch_updated_at();

create trigger work_orders_touch_updated_at
before update on work_orders
for each row execute function touch_updated_at();

create trigger payments_touch_updated_at
before update on payments
for each row execute function touch_updated_at();
