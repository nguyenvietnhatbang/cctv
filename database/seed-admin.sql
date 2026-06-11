insert into users (full_name, email, phone, password_hash, role, status)
values (
  'Admin',
  'cctvdragon@gmail.com',
  null,
  crypt('cctv1234', gen_salt('bf', 12)),
  'admin',
  'active'
)
on conflict (email) do nothing;
