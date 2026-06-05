insert into users (full_name, email, phone, password_hash, role, status)
values (
  'Admin',
  'admin@example.com',
  null,
  crypt('ChangeMe123!', gen_salt('bf', 12)),
  'admin',
  'active'
)
on conflict (email) do nothing;
