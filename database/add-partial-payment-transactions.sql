alter table payments
  add column if not exists paid_amount numeric(12, 2) not null default 0,
  add column if not exists debt_amount numeric(12, 2) not null default 0;

update payments
set paid_amount = case when status = 'paid' then total_amount else paid_amount end,
    debt_amount = case when status = 'debt' then total_amount else debt_amount end;

create table if not exists payment_transactions (
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

create index if not exists payment_transactions_work_order_idx
  on payment_transactions(work_order_id, collected_at desc);

create index if not exists payment_transactions_collected_idx
  on payment_transactions(collected_at desc);

insert into payment_transactions
  (payment_id, work_order_id, amount, method, transaction_ref, note, collected_by, collected_at)
select p.id,
       p.work_order_id,
       p.total_amount,
       case when p.method = 'debt' or p.method is null then 'cash'::payment_method else p.method end,
       coalesce(p.transaction_ref, 'LEGACY-' || p.id::text),
       'Giao dịch thanh toán trước khi tách lịch sử thu tiền',
       p.confirmed_by,
       coalesce(p.confirmed_at, p.updated_at, p.created_at)
from payments p
where p.status = 'paid'
  and p.total_amount > 0
  and not exists (
    select 1
    from payment_transactions pt
    where pt.payment_id = p.id
  );
