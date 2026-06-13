alter type work_order_file_purpose add value if not exists 'request_document';
alter type work_order_file_purpose add value if not exists 'handover_document';

alter table customers
  add column if not exists lat numeric(10, 7),
  add column if not exists lng numeric(10, 7),
  add column if not exists location_pinned_at timestamptz,
  add column if not exists location_pinned_by uuid references users(id) on delete set null;
