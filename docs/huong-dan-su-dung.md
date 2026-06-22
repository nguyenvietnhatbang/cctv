# Hướng dẫn sử dụng hệ thống CCTV Ops

Tài liệu này hướng dẫn thao tác cơ bản cho admin và kỹ thuật viên theo quy trình:

**Khách gọi -> Điều phối/Admin tạo phiếu -> Kỹ thuật đi làm -> Nghiệm thu -> Thu tiền**

## 1. Đăng nhập


```

### Tài khoản admin

```text
Email: admin@example.com
Mật khẩu: admin123
```

Admin dùng để xem toàn bộ dữ liệu, tạo phiếu, phân công, theo dõi công việc, quản lý nhân viên, xử lý nghiệm thu và thanh toán.

### Tài khoản kỹ thuật test

Các tài khoản kỹ thuật dùng chung mật khẩu:

```text
Mật khẩu: Test12345!
```

```text
tech.a@test.local
tech.b@test.local
tech.c@test.local
```

Tài khoản khác nếu cần test:

```text
dispatcher@test.local / Test12345!
accountant@test.local / Test12345!
```

## 2. Màn hình admin

### Dashboard

Dashboard dùng để xem nhanh tình hình vận hành:

- Công việc hôm nay.
- Việc chưa làm.
- Đang làm.
- Đang làm quá hạn.
- Hoàn thành.
- Hoàn thành quá hạn.
- Đã thu hôm nay.
- Công nợ mở.

Bấm vào từng chỉ số để chuyển sang danh sách công việc đã lọc.

### Công việc

Màn hình Công việc là nơi admin theo dõi và xử lý phiếu.

Các trạng thái trực quan admin cần quan tâm:

- `Việc chưa làm`: phiếu chưa bắt đầu thi công.
- `Đang làm`: kỹ thuật đang xử lý đúng hạn.
- `Đang làm quá hạn`: kỹ thuật đang xử lý nhưng đã quá thời gian hẹn.
- `Hoàn thành`: phần kỹ thuật đã hoàn tất.
- `Hoàn thành quá hạn`: hoàn tất sau thời gian hẹn.

Giai đoạn nghiệp vụ chi tiết nằm trong modal xem/sửa phiếu, không hiển thị thành nhóm chính ở danh sách.

### Tạo công việc

1. Vào `Công việc`.
2. Bấm `Tạo công việc`.
3. Chọn khách hàng có sẵn hoặc nhập khách hàng mới.
4. Nhập loại việc, mức ưu tiên, mô tả, thời gian hẹn.
5. Có thể chọn kỹ thuật viên ngay khi tạo.
6. Lưu phiếu.

Nếu chưa chọn kỹ thuật, phiếu ở trạng thái `Chờ phân công`.

### Phân công kỹ thuật

1. Mở phiếu cần xử lý.
2. Nếu phiếu chưa có kỹ thuật, modal sẽ báo cần phân công.
3. Chọn kỹ thuật viên phù hợp.
4. Lưu phân công.

Sau phân công, phiếu chuyển sang `Đã phân công`. Kỹ thuật viên được giao sẽ thấy phiếu trong màn hình kỹ thuật.

### Theo dõi chi tiết phiếu

Trong modal chi tiết/sửa phiếu, admin có thể xem:

- Thông tin khách hàng.
- Mô tả công việc.
- Kỹ thuật viên phụ trách.
- Giai đoạn nghiệp vụ.
- Lịch sử trạng thái.
- Ảnh, vật tư, ghi chú hiện trường.
- Nghiệm thu.
- Thanh toán/công nợ.

Admin nên xem giai đoạn trong modal chi tiết để hiểu phiếu đang nằm ở bước nào trong quy trình.

### Nghiệm thu

Khi phiếu ở trạng thái `Chờ nghiệm thu`:

1. Mở phiếu.
2. Vào tab `Nghiệm thu`.
3. Nhập tên người ký nếu cần.
4. Cho khách ký trên màn hình.
5. Lưu nghiệm thu.

Sau khi lưu, phiếu chuyển sang `Đã nghiệm thu`.

### Thu tiền hoặc ghi công nợ

Khi phiếu đã nghiệm thu:

1. Mở phiếu.
2. Vào tab `Thu tiền`.
3. Kiểm tra tiền công, vật tư, VAT, tổng tiền.
4. Chọn:
   - `Đã thanh toán` nếu khách đã trả tiền.
   - `Công nợ` nếu khách hẹn trả sau.
5. Nếu đã thanh toán, chọn hình thức thanh toán.
6. Nếu công nợ, nhập ghi chú hoặc ngày hẹn.
7. Lưu.

Sau khi đã thu tiền, phiếu được xem là đã đóng.

## 3. Màn hình kỹ thuật

Kỹ thuật viên đăng nhập sẽ được chuyển vào màn hình `Kỹ thuật`.

Màn hình này chỉ hiển thị các phiếu được phân công cho chính kỹ thuật viên đang đăng nhập.

### Các nhóm việc

- `Cần nhận`: phiếu đã giao, kỹ thuật cần xác nhận nhận việc.
- `Đã nhận/đang đi`: phiếu đã nhận hoặc đang di chuyển.
- `Thi công`: kỹ thuật đã check-in và đang làm.
- `Chờ ký`: đã xử lý xong, cần khách ký nghiệm thu.
- `Việc đã xong`: các phiếu đã nghiệm thu, đã thu tiền hoặc công nợ.

### Xử lý một phiếu ngoài hiện trường

1. Mở phiếu trong màn hình `Kỹ thuật`.
2. Kiểm tra thông tin khách hàng, địa chỉ, mô tả công việc.
3. Bấm `Gọi khách` nếu cần liên hệ.
4. Bấm `Bản đồ` để mở chỉ đường.
5. Thực hiện lần lượt các bước:
   - `Nhận việc`.
   - `Đang di chuyển`.
   - `Check-in`.
   - Cập nhật ảnh, vật tư, ghi chú.
   - `Hoàn tất xử lý`.
   - Cho khách ký nghiệm thu.

Modal kỹ thuật luôn hiển thị nút bước tiếp theo ngay trong phần `Bước hiện tại`.

### Upload ảnh

Trong modal kỹ thuật:

1. Chọn loại ảnh:
   - Ảnh hiện trạng.
   - Ảnh trước xử lý.
   - Ảnh sau xử lý.
2. Chọn hoặc chụp ảnh.
3. Bấm tải ảnh lên.

Sau nghiệm thu/thanh toán, ảnh hiện trường bị khóa để tránh thay đổi hồ sơ đã chốt.

### Ghi vật tư

Trong modal kỹ thuật:

1. Nhập tên vật tư.
2. Nhập số lượng.
3. Nhập đơn giá.
4. Bấm thêm vật tư.

Thành tiền vật tư được hệ thống tự tính.

### Ghi chú hiện trường

Kỹ thuật nhập nội dung đã xử lý, phát sinh hoặc lưu ý cho khách/admin trong phần `Ghi chú hiện trường`.

### Nghiệm thu

Khi đã bấm `Hoàn tất xử lý`, phiếu chuyển sang `Chờ nghiệm thu`.

Lúc này form ký nghiệm thu hiện ngay trong modal kỹ thuật:

1. Nhập tên người ký.
2. Nhập số điện thoại người ký nếu khác khách hàng.
3. Cho khách ký trên màn hình.
4. Tick xác nhận khách đồng ý nghiệm thu.
5. Bấm lưu.

Sau đó phiếu chuyển sang `Đã nghiệm thu`; kỹ thuật không cần xử lý thanh toán.

## 4. Lưu ý vận hành

- Không tự ý sửa trạng thái bằng dữ liệu thô. Luôn dùng nút hành động trong giao diện.
- Nếu kỹ thuật không thấy phiếu, kiểm tra phiếu đã gán đúng kỹ thuật viên chưa.
- Nếu phiếu đã nghiệm thu hoặc đã thu tiền, ảnh/vật tư hiện trường sẽ bị khóa.
- Admin xem giai đoạn nghiệp vụ trong modal chi tiết, còn danh sách chính chỉ dùng trạng thái trực quan để quét nhanh.

## 5. Cài ứng dụng và nhận thông báo

Vào màn hình `Thông báo` để kiểm tra trạng thái của thiết bị.

### Android

1. Mở hệ thống bằng Chrome.
2. Vào `Thông báo`.
3. Bấm `Cài ứng dụng` nếu nút này xuất hiện.
4. Bấm `Bật thông báo` và chấp nhận quyền của trình duyệt.
5. Bấm `Gửi thử` để kiểm tra.

### iPhone/iPad

1. Thiết bị cần dùng iOS/iPadOS 16.4 trở lên.
2. Mở hệ thống, bấm nút `Chia sẻ`.
3. Chọn `Thêm vào Màn hình chính`.
4. Đóng trình duyệt và mở lại hệ thống từ biểu tượng vừa cài.
5. Vào `Thông báo`, bấm `Bật thông báo`, sau đó `Gửi thử`.

Thông báo công việc có thể xuất hiện trên màn hình khóa. Bấm vào thông báo sẽ mở đúng phiếu liên quan.

Khi người dùng mở màn hình `Thông báo`, các thông báo hiện có của chính tài khoản đó được tự động đánh dấu đã đọc; không cần bấm từng dòng.

Trước khi đăng xuất khỏi thiết bị dùng chung, hệ thống sẽ hủy đăng ký Push của tài khoản trên thiết bị đó.
