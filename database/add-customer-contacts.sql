create table if not exists customer_contacts (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references customers(id) on delete cascade,
  name text not null,
  phone text not null,
  note text,
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists customer_contacts_customer_idx on customer_contacts(customer_id);
create index if not exists customer_contacts_phone_idx on customer_contacts(phone);

create unique index if not exists customer_contacts_one_primary_idx
  on customer_contacts(customer_id)
  where is_primary;

drop trigger if exists customer_contacts_touch_updated_at on customer_contacts;

create trigger customer_contacts_touch_updated_at
before update on customer_contacts
for each row execute function touch_updated_at();

insert into customer_contacts (customer_id, name, phone, is_primary)
select c.id, c.name, c.phone, true
from customers c
where not exists (
  select 1
  from customer_contacts cc
  where cc.customer_id = c.id
);
