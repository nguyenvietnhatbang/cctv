-- Migration: Add Dynamic RBAC Matrix
-- An toàn: Chỉ tạo bảng mới nếu chưa tồn tại, chèn dữ liệu quyền mẫu. Tuyệt đối không xóa/sửa dữ liệu cũ.

create table if not exists permissions (
  id text primary key,
  code text not null unique,
  name text not null,
  module text not null,
  description text,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists role_permissions (
  role app_role not null,
  permission_id text not null references permissions(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (role, permission_id)
);

create index if not exists role_permissions_role_idx on role_permissions(role);

-- Danh mục permissions
insert into permissions (id, code, name, module, description, sort_order)
values
  -- Khách hàng
  ('perm_customers_view', 'customers.view', 'Xem danh sách & thông tin khách hàng', 'Khách hàng', 'Cho phép xem thông tin khách hàng và liên hệ', 10),
  ('perm_customers_create', 'customers.create', 'Tạo mới khách hàng', 'Khách hàng', 'Cho phép thêm khách hàng mới vào hệ thống', 11),
  ('perm_customers_edit', 'customers.edit', 'Sửa thông tin khách hàng', 'Khách hàng', 'Cho phép cập nhật thông tin, ghim tọa độ khách hàng', 12),
  ('perm_customers_delete', 'customers.delete', 'Xóa khách hàng', 'Khách hàng', 'Cho phép xóa thông tin khách hàng khỏi hệ thống', 13),
  ('perm_customers_export', 'customers.export', 'Xuất danh sách khách hàng ra Excel', 'Khách hàng', 'Tải danh bạ, số điện thoại và địa chỉ khách hàng', 14),

  -- Kỹ thuật viên / Tài nguyên
  ('perm_technicians_view', 'technicians.view', 'Xem danh sách kỹ thuật viên', 'Kỹ thuật viên & Tài nguyên', 'Xem trạng thái, khu vực hoạt động của kỹ thuật viên', 20),
  ('perm_technicians_edit', 'technicians.edit', 'Cập nhật trạng thái / khu vực', 'Kỹ thuật viên & Tài nguyên', 'Thay đổi thông tin hồ sơ kỹ thuật viên', 21),
  ('perm_technicians_view_performance', 'technicians.view_performance', 'Xem hiệu suất & giờ công trình', 'Kỹ thuật viên & Tài nguyên', 'Xem thống kê việc hoàn thành, thời gian tác nghiệp', 22),
  ('perm_technicians_export', 'technicians.export', 'Xuất báo cáo tài nguyên & năng suất', 'Kỹ thuật viên & Tài nguyên', 'Xuất bảng tổng và chi tiết hiệu suất kỹ thuật ra Excel', 23),

  -- Báo cáo
  ('perm_reports_view', 'reports.view', 'Xem báo cáo hệ thống & doanh thu', 'Báo cáo', 'Xem biểu đồ sản lượng, doanh thu, công nợ tổng thể', 30),
  ('perm_reports_export', 'reports.export', 'Xuất báo cáo hệ thống ra Excel', 'Báo cáo', 'Xuất toàn bộ dữ liệu báo cáo ra file Excel', 31),

  -- Công việc
  ('perm_orders_view', 'orders.view', 'Xem danh sách công việc', 'Công việc', 'Xem các phiếu công việc trên hệ thống', 40),
  ('perm_orders_create', 'orders.create', 'Tạo mới công việc', 'Công việc', 'Tạo phiếu công việc và tiếp nhận yêu cầu khách hàng', 41),
  ('perm_orders_edit', 'orders.edit', 'Chỉnh sửa thông tin công việc', 'Công việc', 'Sửa nội dung, vật tư, chi phí phiếu công việc', 42),
  ('perm_orders_cancel', 'orders.cancel', 'Hủy công việc', 'Công việc', 'Đổi trạng thái phiếu công việc sang đã hủy', 43),
  ('perm_orders_export', 'orders.export', 'Xuất danh sách công việc ra Excel', 'Công việc', 'Xuất danh sách phiếu công việc ra file Excel', 44),

  -- Điều phối & Phân công
  ('perm_dispatch_view', 'dispatch.view', 'Xem bảng điều phối hiện trường', 'Điều phối', 'Theo dõi phân bổ công việc cho kỹ thuật viên', 50),
  ('perm_dispatch_assign', 'dispatch.assign', 'Phân công kỹ thuật viên', 'Điều phối', 'Gán hoặc đổi kỹ thuật viên phụ trách phiếu', 51),
  ('perm_dispatch_export', 'dispatch.export', 'Xuất bảng phân công ra Excel', 'Điều phối', 'Xuất danh sách phân công ra file Excel', 52),

  -- Kỹ thuật hiện trường (Team lead & Technician)
  ('perm_field_view_jobs', 'field.view_jobs', 'Xem công việc hiện trường được giao', 'Tác nghiệp hiện trường', 'Kỹ thuật viên xem công việc của mình để thi công', 60),
  ('perm_field_check_in', 'field.check_in', 'Check-in GPS tại công trình', 'Tác nghiệp hiện trường', 'Xác thực vị trí khi đến nơi làm việc', 61),
  ('perm_field_update_materials', 'field.update_materials', 'Ghi nhận vật tư sử dụng', 'Tác nghiệp hiện trường', 'Cập nhật danh sách vật tư sử dụng tại công trình', 62),
  ('perm_field_upload_photos', 'field.upload_photos', 'Chụp & upload ảnh hiện trường', 'Tác nghiệp hiện trường', 'Upload ảnh hiện trạng trước và sau xử lý', 63),
  ('perm_field_acceptance', 'field.acceptance_signature', 'Lấy chữ ký nghiệm thu điện tử', 'Tác nghiệp hiện trường', 'Khách hàng ký xác nhận nghiệm thu trên điện thoại', 64),

  -- Thanh toán
  ('perm_payments_view', 'payments.view', 'Xem danh sách thanh toán & công nợ', 'Thanh toán', 'Theo dõi trạng thái thu tiền và công nợ', 70),
  ('perm_payments_collect', 'payments.collect', 'Xác nhận thu tiền / tạo giao dịch', 'Thanh toán', 'Ghi nhận khoản thanh toán tiền mặt/chuyển khoản', 71),
  ('perm_payments_export', 'payments.export', 'Xuất danh sách thanh toán ra Excel', 'Thanh toán', 'Xuất dữ liệu thanh toán và công nợ ra file Excel', 72),

  -- Quản trị nhân viên & phân quyền
  ('perm_users_view', 'users.view', 'Xem danh sách nhân viên', 'Quản trị nhân sự', 'Xem danh sách tài khoản nội bộ', 80),
  ('perm_users_manage', 'users.manage', 'Thêm, sửa, đặt lại mật khẩu nhân viên', 'Quản trị nhân sự', 'Quản lý tài khoản nhân viên công ty', 81),
  ('perm_users_export', 'users.export', 'Xuất danh sách nhân viên ra Excel', 'Quản trị nhân sự', 'Xuất thông tin tài khoản nhân sự ra file Excel', 82),
  ('perm_permissions_manage', 'permissions.manage', 'Cấu hình ma trận phân quyền động', 'Quản trị nhân sự', 'Bật/tắt quyền hạn chi tiết cho từng vị trí', 83)
on conflict (id) do update set
  code = excluded.code,
  name = excluded.name,
  module = excluded.module,
  description = excluded.description,
  sort_order = excluded.sort_order;

-- Nạp ma trận quyền mặc định
-- ADMIN: Đầy đủ tất cả các quyền
insert into role_permissions (role, permission_id)
select 'admin'::app_role, id from permissions
on conflict do nothing;

-- DISPATCHER (Điều phối):
-- Được quản lý khách hàng, xem & tạo việc, điều phối phân công, xem kỹ thuật, thu tiền
-- NHƯNG KHÓA: Không được xuất khách hàng, không được xuất tài nguyên kỹ thuật, không được xóa khách hàng
insert into role_permissions (role, permission_id)
values
  ('dispatcher', 'perm_customers_view'),
  ('dispatcher', 'perm_customers_create'),
  ('dispatcher', 'perm_customers_edit'),
  ('dispatcher', 'perm_technicians_view'),
  ('dispatcher', 'perm_technicians_view_performance'),
  ('dispatcher', 'perm_reports_view'),
  ('dispatcher', 'perm_orders_view'),
  ('dispatcher', 'perm_orders_create'),
  ('dispatcher', 'perm_orders_edit'),
  ('dispatcher', 'perm_orders_cancel'),
  ('dispatcher', 'perm_dispatch_view'),
  ('dispatcher', 'perm_dispatch_assign'),
  ('dispatcher', 'perm_payments_view'),
  ('dispatcher', 'perm_payments_collect')
on conflict do nothing;

-- TEAM LEAD (Trưởng nhóm - Kỹ thuật đặc thù):
-- Vừa đi làm hiện trường (đầy đủ quyền field)
-- Vừa giám sát và phân công việc cho nhóm (orders, dispatch, technicians)
-- Xem thông tin khách hàng để liên hệ thi công
-- TUYỆT ĐỐI KHÓA: Không xuất khách hàng, không xuất tài nguyên kỹ thuật, không xem báo cáo doanh thu công ty, không xóa khách hàng
insert into role_permissions (role, permission_id)
values
  ('team_lead', 'perm_customers_view'),
  ('team_lead', 'perm_customers_create'),
  ('team_lead', 'perm_customers_edit'),
  ('team_lead', 'perm_technicians_view'),
  ('team_lead', 'perm_technicians_view_performance'),
  ('team_lead', 'perm_orders_view'),
  ('team_lead', 'perm_orders_create'),
  ('team_lead', 'perm_orders_edit'),
  ('team_lead', 'perm_dispatch_view'),
  ('team_lead', 'perm_dispatch_assign'),
  ('team_lead', 'perm_field_view_jobs'),
  ('team_lead', 'perm_field_check_in'),
  ('team_lead', 'perm_field_update_materials'),
  ('team_lead', 'perm_field_upload_photos'),
  ('team_lead', 'perm_field_acceptance')
on conflict do nothing;

-- TECHNICIAN (Kỹ thuật viên thuần túy):
-- Chỉ có quyền tác nghiệp hiện trường trên phiếu của mình
insert into role_permissions (role, permission_id)
values
  ('technician', 'perm_field_view_jobs'),
  ('technician', 'perm_field_check_in'),
  ('technician', 'perm_field_update_materials'),
  ('technician', 'perm_field_upload_photos'),
  ('technician', 'perm_field_acceptance')
on conflict do nothing;

-- ACCOUNTANT (Kế toán):
-- Xem khách hàng đối soát (KHÔNG xuất khách hàng), xem và xuất báo cáo tài chính, quản lý và xuất thanh toán
insert into role_permissions (role, permission_id)
values
  ('accountant', 'perm_customers_view'),
  ('accountant', 'perm_reports_view'),
  ('accountant', 'perm_reports_export'),
  ('accountant', 'perm_orders_view'),
  ('accountant', 'perm_payments_view'),
  ('accountant', 'perm_payments_collect'),
  ('accountant', 'perm_payments_export')
on conflict do nothing;
