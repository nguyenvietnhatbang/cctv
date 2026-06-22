# CCTV Ops

Hệ thống điều phối kỹ thuật cho luồng:

`Khách gọi -> Điều phối -> Kỹ thuật đi làm -> Nghiệm thu -> Thu tiền`

Next.js xử lý cả frontend và backend qua App Router API. Supabase chỉ dùng PostgreSQL và Storage bucket, không dùng Supabase Auth.

## Setup

1. Cài dependency:

```bash
npm install
```

2. Tạo `.env` từ mẫu:

```bash
cp .env.example .env
```

3. Chạy SQL:

- `database/schema.sql`
- `database/seed-admin.sql`

Với database đã tồn tại, chạy thêm migration:

- `database/add-web-push-notifications.sql`

4. Chạy dev server:

```bash
npm run dev
```

Mở `http://localhost:3000`.

## PWA và Web Push

Tạo một cặp VAPID key:

```bash
npx web-push generate-vapid-keys
```

Khai báo các biến môi trường:

```env
NEXT_PUBLIC_VAPID_PUBLIC_KEY="..."
VAPID_PRIVATE_KEY="..."
VAPID_SUBJECT="mailto:admin@example.com"
CRON_SECRET="..."
```

Production phải chạy HTTPS. `vercel.json` cấu hình worker retry mỗi phút tại
`/api/cron/push`; Vercel tự gửi `CRON_SECRET` trong header Authorization.

## Chạy không cần DB

Khi chưa có PostgreSQL/Supabase, bật mock mode trong `.env`:

```bash
CCTV_DATA_MODE="mock"
SESSION_SECRET="replace-with-openssl-rand-base64-32"
```

Tài khoản demo:

- `admin@demo.local`
- `dispatch@demo.local`
- `minh@demo.local`
- `accounting@demo.local`

Mật khẩu chung: `demo1234`.

Mock mode dùng dữ liệu in-memory trong dev server. Có thể tạo phiếu, phân công, cập nhật trạng thái, thêm/sửa/xóa vật tư, upload ảnh giả, nghiệm thu và thanh toán. Khi restart dev server, dữ liệu mock reset về seed ban đầu.

## QA / Acceptance Criteria

Checklist nghiệm thu nằm ở:

- `docs/qa-acceptance-criteria.md`

Trước khi bàn giao, chạy:

```bash
npm run lint
npm run build
```

Sau đó smoke test các flow chính:

- Đăng nhập / đăng xuất.
- Tạo khách hàng.
- Tạo phiếu.
- Phân công kỹ thuật.
- Kỹ thuật cập nhật trạng thái, upload ảnh, nhập vật tư.
- Ký nghiệm thu.
- Xác nhận thanh toán hoặc công nợ.
- Kiểm tra báo cáo và thông báo.

## Tài liệu nghiệp vụ

- `docs/chuc-nang-ux-can-thiet.md`
- `docs/luông nghiệp vụ.md`
