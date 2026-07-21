-- Reset operational/demo data before going live.
-- Keeps admin user accounts and all database structure/system objects.

begin;

delete from public.notification_push_jobs;
delete from public.push_subscriptions;
delete from public.notifications;

delete from public.payment_transactions;
delete from public.payments;

delete from public.work_order_files;
delete from public.work_order_materials;
delete from public.work_order_status_history;
delete from public.work_order_field_sessions;
delete from public.work_order_assignments;
delete from public.work_orders;

delete from public.customer_contacts;
delete from public.customers;

delete from public.technicians
where user_id not in (
  select id from public.users where role = 'admin'
);

delete from public.users
where role <> 'admin';

commit;
