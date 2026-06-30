insert into users (full_name, email, phone, password_hash, role, status)
values (
  'Admin',
  'admin@example.invalid',
  null,
  crypt('CHANGE_ME_BEFORE_RUNNING', gen_salt('bf', 12)),
  'admin',
  'active'
)
on conflict (email) do nothing;
