alter type app_role add value if not exists 'team_lead' before 'technician';

alter type work_order_status add value if not exists 'paused' before 'cancelled';

alter type work_order_type add value if not exists 'add_on' after 'installation';
alter type work_order_type add value if not exists 'maintenance_repair' after 'add_on';
alter type work_order_type add value if not exists 'relocation' after 'maintenance_repair';

drop index if exists work_order_active_assignment_idx;

create unique index if not exists work_order_active_assignment_idx
  on work_order_assignments(work_order_id, technician_id)
  where unassigned_at is null;
