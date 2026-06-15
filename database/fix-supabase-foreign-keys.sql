-- Align an existing Supabase database with database/schema.sql foreign key actions.
-- Run this once in Supabase SQL Editor if the exported schema shows missing ON DELETE actions.

alter table public.customers
  drop constraint if exists customers_created_by_fkey,
  add constraint customers_created_by_fkey
    foreign key (created_by) references public.users(id) on delete set null;

alter table public.customers
  drop constraint if exists customers_location_pinned_by_fkey,
  add constraint customers_location_pinned_by_fkey
    foreign key (location_pinned_by) references public.users(id) on delete set null;

alter table public.technicians
  drop constraint if exists technicians_user_id_fkey,
  add constraint technicians_user_id_fkey
    foreign key (user_id) references public.users(id) on delete cascade;

alter table public.work_orders
  drop constraint if exists work_orders_created_by_fkey,
  add constraint work_orders_created_by_fkey
    foreign key (created_by) references public.users(id) on delete set null;

alter table public.work_orders
  drop constraint if exists work_orders_updated_by_fkey,
  add constraint work_orders_updated_by_fkey
    foreign key (updated_by) references public.users(id) on delete set null;

alter table public.work_order_assignments
  drop constraint if exists work_order_assignments_work_order_id_fkey,
  add constraint work_order_assignments_work_order_id_fkey
    foreign key (work_order_id) references public.work_orders(id) on delete cascade;

alter table public.work_order_assignments
  drop constraint if exists work_order_assignments_assigned_by_fkey,
  add constraint work_order_assignments_assigned_by_fkey
    foreign key (assigned_by) references public.users(id) on delete set null;

alter table public.work_order_status_history
  drop constraint if exists work_order_status_history_work_order_id_fkey,
  add constraint work_order_status_history_work_order_id_fkey
    foreign key (work_order_id) references public.work_orders(id) on delete cascade;

alter table public.work_order_status_history
  drop constraint if exists work_order_status_history_changed_by_fkey,
  add constraint work_order_status_history_changed_by_fkey
    foreign key (changed_by) references public.users(id) on delete set null;

alter table public.work_order_materials
  drop constraint if exists work_order_materials_work_order_id_fkey,
  add constraint work_order_materials_work_order_id_fkey
    foreign key (work_order_id) references public.work_orders(id) on delete cascade;

alter table public.work_order_materials
  drop constraint if exists work_order_materials_created_by_fkey,
  add constraint work_order_materials_created_by_fkey
    foreign key (created_by) references public.users(id) on delete set null;

alter table public.work_order_files
  drop constraint if exists work_order_files_work_order_id_fkey,
  add constraint work_order_files_work_order_id_fkey
    foreign key (work_order_id) references public.work_orders(id) on delete cascade;

alter table public.work_order_files
  drop constraint if exists work_order_files_uploaded_by_fkey,
  add constraint work_order_files_uploaded_by_fkey
    foreign key (uploaded_by) references public.users(id) on delete set null;

alter table public.payments
  drop constraint if exists payments_work_order_id_fkey,
  add constraint payments_work_order_id_fkey
    foreign key (work_order_id) references public.work_orders(id) on delete cascade;

alter table public.payments
  drop constraint if exists payments_confirmed_by_fkey,
  add constraint payments_confirmed_by_fkey
    foreign key (confirmed_by) references public.users(id) on delete set null;

alter table public.notifications
  drop constraint if exists notifications_user_id_fkey,
  add constraint notifications_user_id_fkey
    foreign key (user_id) references public.users(id) on delete cascade;

alter table public.notifications
  drop constraint if exists notifications_work_order_id_fkey,
  add constraint notifications_work_order_id_fkey
    foreign key (work_order_id) references public.work_orders(id) on delete cascade;

alter table public.customer_contacts
  drop constraint if exists customer_contacts_customer_id_fkey,
  add constraint customer_contacts_customer_id_fkey
    foreign key (customer_id) references public.customers(id) on delete cascade;
