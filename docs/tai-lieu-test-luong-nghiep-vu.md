# Tài liệu test luồng nghiệp vụ CCTV Ops

Mục tiêu của tài liệu này là giúp tester kiểm tra đúng và đủ các luồng chính trước khi bàn giao.

Quy trình chuẩn:

**Khách gọi -> Tạo phiếu -> Phân công -> Kỹ thuật đi làm -> Nghiệm thu -> Thu tiền/Công nợ**

## 1. Tài khoản test

### Admin

```text
Email: admin@example.com
Mật khẩu: admin123
```

### Kỹ thuật

Mật khẩu chung:

```text
Test12345!
```

```text
tech.a@test.local
tech.b@test.local
tech.c@test.local
```

### Vai trò khác

```text
dispatcher@test.local / Test12345!
accountant@test.local / Test12345!
```

## 2. Dữ liệu test đã seed

Các phiếu test chính:

| Mã phiếu | Trạng thái | Mục đích test |
| --- | --- | --- |
| `TEST-001-CHO-PHAN-CONG` | Chờ phân công | Admin phân công kỹ thuật |
| `TEST-002-DA-PHAN-CONG` | Đã phân công | Kỹ thuật bấm nhận việc |
| `TEST-003-DA-NHAN-VIEC` | Đã nhận việc | Kỹ thuật bấm đang di chuyển |
| `TEST-004-DANG-DI-CHUYEN` | Đang di chuyển | Kỹ thuật bấm check-in |
| `TEST-005-DANG-THI-CONG` | Đang thi công | Kỹ thuật thêm ảnh/vật tư/ghi chú và hoàn tất xử lý |
| `TEST-006-CHO-NGHIEM-THU` | Chờ nghiệm thu | Kỹ thuật hoặc admin cho khách ký nghiệm thu |
| `TEST-007-DA-NGHIEM-THU` | Đã nghiệm thu | Admin thu tiền hoặc ghi công nợ |
| `TEST-008-CONG-NO` | Công nợ | Admin/kế toán thu công nợ |
| `TEST-009-DA-THU-TIEN` | Đã thu tiền | Kiểm tra phiếu đã đóng |

## 3. Test đăng nhập và phân quyền

### TC-01: Admin đăng nhập

Điều kiện:

- Dùng tài khoản `admin@example.com / admin123`.

Bước test:

1. Mở hệ thống.
2. Đăng nhập bằng tài khoản admin.

Kết quả mong đợi:

- Đăng nhập thành công.
- Thấy các menu quản trị như Dashboard, Công việc, Khách hàng, DS kỹ thuật, Thanh toán, Báo cáo, Nhân viên.

### TC-02: Kỹ thuật đăng nhập

Điều kiện:

- Dùng tài khoản `tech.a@test.local / Test12345!`.

Bước test:

1. Đăng xuất admin.
2. Đăng nhập kỹ thuật A.

Kết quả mong đợi:

- Đăng nhập thành công.
- Hệ thống đưa vào màn hình Kỹ thuật.
- Chỉ thấy các công việc được giao cho kỹ thuật A.

### TC-03: Kỹ thuật không thấy màn admin

Bước test:

1. Đăng nhập kỹ thuật.
2. Truy cập trực tiếp `/users` hoặc `/payments`.

Kết quả mong đợi:

- Hệ thống không cho xem trang không thuộc quyền kỹ thuật.
- Kỹ thuật được đưa về màn hình phù hợp.

## 4. Test màn Công việc admin

### TC-04: Admin xem trạng thái trực quan

Bước test:

1. Đăng nhập admin.
2. Vào `Công việc`.

Kết quả mong đợi:

- Chỉ thấy các nhóm trực quan:
  - Việc chưa làm.
  - Đang làm.
  - Đang làm quá hạn.
  - Hoàn thành.
  - Hoàn thành quá hạn.
- Không hiển thị nhóm giai đoạn nghiệp vụ ở danh sách chính.
- Giai đoạn chỉ xuất hiện khi mở modal chi tiết/sửa phiếu.

### TC-05: Lọc theo trạng thái trực quan

Bước test:

1. Tại màn Công việc, bấm từng card trạng thái trực quan.
2. Quan sát danh sách phiếu.

Kết quả mong đợi:

- Danh sách lọc đúng theo card được chọn.
- Bấm lại card đang chọn thì bỏ lọc.

### TC-06: Xem giai đoạn trong chi tiết phiếu

Bước test:

1. Mở một phiếu bất kỳ.
2. Xem phần nhãn trong modal.

Kết quả mong đợi:

- Modal có hiển thị giai đoạn nghiệp vụ như Tiếp nhận, Phân công, Hiện trường, Nghiệm thu, Thu tiền hoặc Đóng phiếu.
- Danh sách ngoài không dùng giai đoạn làm nhóm chính.

## 5. Test luồng admin tạo và phân công

### TC-07: Tạo phiếu không gán kỹ thuật

Bước test:

1. Đăng nhập admin.
2. Vào `Công việc`.
3. Bấm `Tạo công việc`.
4. Nhập khách hàng, loại việc, mô tả, thời gian hẹn.
5. Không chọn kỹ thuật viên.
6. Lưu.

Kết quả mong đợi:

- Phiếu được tạo.
- Trạng thái nghiệp vụ là `Chờ phân công`.
- Phiếu nằm trong nhóm trực quan `Việc chưa làm`.

### TC-08: Phân công phiếu chờ phân công

Dữ liệu gợi ý:

- Phiếu `TEST-001-CHO-PHAN-CONG`.

Bước test:

1. Mở phiếu.
2. Modal admin báo cần phân công.
3. Chọn kỹ thuật viên.
4. Lưu phân công.

Kết quả mong đợi:

- Phiếu chuyển sang `Đã phân công`.
- Kỹ thuật viên được gán nhìn thấy phiếu trong màn Kỹ thuật.
- Lịch sử trạng thái có ghi nhận phân công.

## 6. Test luồng kỹ thuật hiện trường

### TC-09: Kỹ thuật nhận việc

Dữ liệu gợi ý:

- Đăng nhập `tech.a@test.local`.
- Phiếu `TEST-002-DA-PHAN-CONG`.

Bước test:

1. Vào màn `Kỹ thuật`.
2. Mở phiếu `TEST-002-DA-PHAN-CONG`.
3. Bấm `Nhận việc`.

Kết quả mong đợi:

- Phiếu chuyển sang `Đã nhận việc`.
- Modal kỹ thuật hiển thị bước kế tiếp là `Đang di chuyển`.

### TC-10: Kỹ thuật bắt đầu di chuyển

Dữ liệu gợi ý:

- Phiếu `TEST-003-DA-NHAN-VIEC`.

Bước test:

1. Đăng nhập `tech.a@test.local`.
2. Mở phiếu.
3. Bấm `Đang di chuyển`.

Kết quả mong đợi:

- Phiếu chuyển sang `Đang di chuyển`.
- Bước kế tiếp hiển thị là `Check-in`.

### TC-11: Kỹ thuật check-in

Dữ liệu gợi ý:

- Phiếu `TEST-004-DANG-DI-CHUYEN`.
- Đăng nhập `tech.b@test.local`.

Bước test:

1. Mở phiếu.
2. Bấm `Check-in`.
3. Cho phép hoặc từ chối quyền vị trí đều cần test.

Kết quả mong đợi:

- Phiếu chuyển sang `Đang thi công`.
- Nếu lấy được GPS, hệ thống lưu tọa độ.
- Nếu không lấy được GPS, hệ thống vẫn chuyển trạng thái và hiển thị cảnh báo phù hợp.

### TC-12: Kỹ thuật đang thi công thêm ảnh/vật tư/ghi chú

Dữ liệu gợi ý:

- Phiếu `TEST-005-DANG-THI-CONG`.
- Đăng nhập `tech.b@test.local`.

Bước test:

1. Mở phiếu.
2. Upload ảnh trước hoặc ảnh sau xử lý.
3. Thêm một dòng vật tư.
4. Nhập ghi chú hiện trường.
5. Bấm `Hoàn tất xử lý`.

Kết quả mong đợi:

- Ảnh được lưu và hiển thị trong gallery.
- Vật tư được thêm, thành tiền tự tính.
- Ghi chú hiện trường được lưu.
- Phiếu chuyển sang `Chờ nghiệm thu`.
- Form nghiệm thu xuất hiện khi mở lại phiếu.

### TC-13: Kỹ thuật cho khách ký nghiệm thu

Dữ liệu gợi ý:

- Phiếu `TEST-006-CHO-NGHIEM-THU`.
- Đăng nhập `tech.a@test.local`.

Bước test:

1. Mở phiếu.
2. Nhập tên người ký nghiệm thu.
3. Ký trên canvas.
4. Tick xác nhận khách đồng ý nghiệm thu.
5. Bấm lưu.

Kết quả mong đợi:

- Phiếu chuyển sang `Đã nghiệm thu`.
- Có thời gian nghiệm thu.
- Có file chữ ký.
- Ảnh/vật tư hiện trường bị khóa sau nghiệm thu.

## 7. Test luồng nghiệm thu và thanh toán admin

### TC-14: Admin nghiệm thu thay kỹ thuật

Dữ liệu gợi ý:

- Một phiếu trạng thái `Chờ nghiệm thu`.

Bước test:

1. Đăng nhập admin.
2. Mở phiếu.
3. Vào tab `Nghiệm thu`.
4. Cho khách ký.
5. Lưu.

Kết quả mong đợi:

- Phiếu chuyển sang `Đã nghiệm thu`.
- Modal admin chuyển định hướng sang bước thu tiền.

### TC-15: Admin thu tiền phiếu đã nghiệm thu

Dữ liệu gợi ý:

- Phiếu `TEST-007-DA-NGHIEM-THU`.

Bước test:

1. Đăng nhập admin.
2. Mở phiếu.
3. Modal báo `Đã nghiệm thu, cần chốt thu tiền`.
4. Vào tab `Thu tiền`.
5. Chọn `Đã thanh toán`.
6. Chọn phương thức thanh toán.
7. Lưu.

Kết quả mong đợi:

- Phiếu chuyển sang `Đã thu tiền`.
- Payment status là `Đã thu`.
- Phiếu không còn nằm trong công nợ.

### TC-16: Admin ghi công nợ

Bước test:

1. Mở một phiếu `Đã nghiệm thu`.
2. Vào tab `Thu tiền`.
3. Chọn `Công nợ`.
4. Nhập ngày hẹn hoặc ghi chú.
5. Lưu.

Kết quả mong đợi:

- Phiếu chuyển sang `Công nợ`.
- Có ghi chú hoặc ngày hẹn công nợ.
- Phiếu xuất hiện trong danh sách công nợ.

### TC-17: Thu công nợ

Dữ liệu gợi ý:

- Phiếu `TEST-008-CONG-NO`.

Bước test:

1. Đăng nhập admin hoặc kế toán.
2. Mở phiếu công nợ.
3. Vào tab `Thu tiền`.
4. Chọn `Đã thanh toán`.
5. Nhập phương thức thanh toán.
6. Lưu.

Kết quả mong đợi:

- Phiếu chuyển sang `Đã thu tiền`.
- Công nợ giảm.

## 8. Test khóa dữ liệu sau nghiệm thu/thanh toán

### TC-18: Không cho kỹ thuật sửa ảnh/vật tư sau nghiệm thu

Dữ liệu gợi ý:

- Phiếu đã nghiệm thu hoặc đã thu tiền.

Bước test:

1. Đăng nhập kỹ thuật được gán phiếu.
2. Mở phiếu đã nghiệm thu.
3. Kiểm tra phần ảnh và vật tư.

Kết quả mong đợi:

- Không thêm/xóa ảnh hiện trường được.
- Không thêm/sửa/xóa vật tư được.
- Vẫn xem được thông tin đã lưu.

### TC-19: Biên bản nghiệm thu

Bước test:

1. Mở phiếu đã nghiệm thu.
2. Bấm xem biên bản nghiệm thu.

Kết quả mong đợi:

- Hệ thống mở được biên bản nghiệm thu.
- Thông tin khách hàng, phiếu, vật tư, tổng tiền và chữ ký hiển thị đúng nếu có.

## 9. Test trường hợp lỗi

### TC-20: Không cho thu tiền khi chưa nghiệm thu

Bước test:

1. Mở phiếu chưa tới trạng thái `Đã nghiệm thu`.
2. Vào tab `Thu tiền` nếu có quyền.
3. Thử xác nhận thanh toán.

Kết quả mong đợi:

- Hệ thống không cho cập nhật thanh toán nếu phiếu chưa đủ điều kiện.

### TC-21: Công nợ bắt buộc có ghi chú hoặc ngày hẹn

Bước test:

1. Mở phiếu đã nghiệm thu.
2. Chọn `Công nợ`.
3. Để trống ghi chú và ngày hẹn.
4. Lưu.

Kết quả mong đợi:

- Hệ thống báo lỗi cần ghi chú hoặc ngày hẹn.

### TC-22: Kỹ thuật không được xem phiếu không được gán

Bước test:

1. Đăng nhập `tech.c@test.local`.
2. Tìm phiếu của kỹ thuật A hoặc B bằng URL trực tiếp nếu biết mã/id.

Kết quả mong đợi:

- Hệ thống từ chối quyền xem hoặc không hiển thị phiếu.

## 10. Tiêu chí pass tổng thể

Một bản test được coi là đạt khi:

- Admin xem danh sách bằng 5 trạng thái trực quan đúng.
- Giai đoạn nghiệp vụ chỉ dùng trong modal chi tiết/sửa.
- Kỹ thuật có thể đi hết flow: nhận việc -> di chuyển -> check-in -> thi công -> hoàn tất xử lý -> nghiệm thu.
- Admin/kế toán có thể đi hết flow tiền: đã nghiệm thu -> đã thu tiền hoặc công nợ -> thu công nợ.
- Dữ liệu bị khóa đúng sau nghiệm thu/thanh toán.
- Các role không xem/thao tác sai quyền.
