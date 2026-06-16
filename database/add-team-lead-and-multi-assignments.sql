alter type app_role add value if not exists 'team_lead' before 'technician';

alter type work_order_status add value if not exists 'paused' before 'cancelled';

drop index if exists work_order_active_assignment_idx;

create unique index if not exists work_order_active_assignment_idx
  on work_order_assignments(work_order_id, technician_id)
  where unassigned_at is null;
