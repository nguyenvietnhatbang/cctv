alter table public.work_order_assignments
  add column if not exists field_status work_order_status not null default 'assigned',
  add column if not exists check_in_at timestamptz,
  add column if not exists check_in_lat numeric(10, 7),
  add column if not exists check_in_lng numeric(10, 7);

update public.work_order_assignments assignment
set field_status = case
  when work_order.status in ('accepted', 'traveling', 'working', 'awaiting_acceptance', 'paused') then work_order.status
  when work_order.status in ('completed', 'awaiting_payment', 'paid', 'debt') then 'awaiting_acceptance'::work_order_status
  else 'assigned'::work_order_status
end,
check_in_at = case
  when work_order.check_in_at is not null and work_order.status in ('working', 'awaiting_acceptance', 'completed', 'awaiting_payment', 'paid', 'debt')
    then coalesce(assignment.check_in_at, work_order.check_in_at)
  else assignment.check_in_at
end,
check_in_lat = case
  when work_order.check_in_lat is not null and work_order.status in ('working', 'awaiting_acceptance', 'completed', 'awaiting_payment', 'paid', 'debt')
    then coalesce(assignment.check_in_lat, work_order.check_in_lat)
  else assignment.check_in_lat
end,
check_in_lng = case
  when work_order.check_in_lng is not null and work_order.status in ('working', 'awaiting_acceptance', 'completed', 'awaiting_payment', 'paid', 'debt')
    then coalesce(assignment.check_in_lng, work_order.check_in_lng)
  else assignment.check_in_lng
end
from public.work_orders work_order
where work_order.id = assignment.work_order_id;

create index if not exists work_order_assignments_field_status_active_idx
  on public.work_order_assignments(technician_id, field_status)
  where unassigned_at is null;
