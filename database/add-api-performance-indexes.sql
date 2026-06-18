-- This version is safe to run in SQL editors or migration runners that wrap
-- the script in a transaction. It may take short locks while indexes are built.

create extension if not exists pg_trgm;

create index if not exists users_email_lower_idx
  on users (lower(email));

create index if not exists work_orders_created_at_idx
  on work_orders (created_at desc);

create index if not exists work_orders_updated_at_idx
  on work_orders (updated_at desc);

create index if not exists work_orders_status_appointment_idx
  on work_orders (status, appointment_at desc);

create index if not exists work_orders_open_appointment_idx
  on work_orders (appointment_at desc, created_at desc)
  where status not in ('paid', 'cancelled');

create index if not exists work_orders_code_trgm_idx
  on work_orders using gin (code gin_trgm_ops);

create index if not exists work_orders_description_trgm_idx
  on work_orders using gin (description gin_trgm_ops);

create index if not exists customers_name_trgm_idx
  on customers using gin (name gin_trgm_ops);

create index if not exists customers_address_trgm_idx
  on customers using gin (address gin_trgm_ops);

create index if not exists work_order_assignments_technician_active_idx
  on work_order_assignments (technician_id, work_order_id)
  where unassigned_at is null;

create index if not exists work_order_assignments_order_active_assigned_idx
  on work_order_assignments (work_order_id, assigned_at)
  where unassigned_at is null;

create index if not exists work_order_materials_order_created_idx
  on work_order_materials (work_order_id, created_at desc);

create index if not exists work_order_files_order_uploaded_idx
  on work_order_files (work_order_id, uploaded_at desc);

create index if not exists payments_status_confirmed_idx
  on payments (status, confirmed_at desc);

create index if not exists notifications_user_created_idx
  on notifications (user_id, created_at desc);
