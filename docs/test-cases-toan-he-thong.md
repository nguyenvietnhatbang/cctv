# Tài liệu Test Case toàn diện - Hệ thống CCTV Ops

Tài liệu này cung cấp danh sách đầy đủ các kịch bản kiểm thử (Test Cases) cho hệ thống điều phối kỹ thuật CCTV Ops, bao gồm tất cả các vai trò, luồng nghiệp vụ chính, giao diện chức năng và các trường hợp biên/ngoại lệ.

Quy trình lõi của hệ thống: 
`Khách gọi -> Tiếp nhận/Tạo phiếu -> Phân công -> Kỹ thuật nhận & di chuyển -> Check-in -> Thi công -> Nghiệm thu -> Thu tiền/Công nợ`

---

## 1. Kiểm thử phân quyền & Vai trò (Role-based Permissions Matrix)

Hệ thống hỗ trợ 5 vai trò chính: **Admin**, **Dispatcher** (Điều phối), **Technician** (Kỹ thuật), **Accountant** (Kế toán), và **Team Lead** (Trưởng nhóm).

### TC-ROLE-01: Kiểm tra phân quyền truy cập URL trực tiếp
* **Mục đích:** Đảm bảo các vai trò chỉ có thể truy cập các đường dẫn được cấp phép, các trang nhạy cảm phải bị chặn và chuyển hướng về màn hình phù hợp.
* **Điều kiện tiền đề:** Hệ thống đang chạy ở chế độ Mock hoặc Production với đầy đủ tài khoản test.
* **Các bước thực hiện:**
  1. Đăng nhập lần lượt bằng tài khoản của từng vai trò.
  2. Truy cập trực tiếp qua địa chỉ URL của các trang quản trị: `/users`, `/payments`, `/reports`, `/dashboard`, `/dispatch`, `/customers`, `/technicians`.
  3. Quan sát phản hồi của hệ thống.
* **Kết quả mong đợi:**
  * **Admin:** Truy cập thành công tất cả các URL.
  * **Dispatcher:** Truy cập được `/orders`, `/customers`, `/dispatch`, `/technicians`. Bị chặn khi vào `/users`, `/payments`, `/reports` (chuyển hướng hoặc báo lỗi 403/Không có quyền).
  * **Technician:** Chỉ được truy cập màn hình `/technician` và `/notifications`. Bị chặn và chuyển hướng về `/technician` khi vào bất kỳ trang quản trị nào khác.
  * **Accountant:** Truy cập được `/orders`, `/payments`, `/reports`. Bị chặn khi vào `/users`, `/dispatch`, `/technicians`.
  * **Team Lead:** Truy cập được `/orders`, `/dispatch`, `/technicians`, `/reports` ở cấp độ khu vực của mình. Bị chặn khi vào `/users`, `/payments`.

### TC-ROLE-02: Đăng nhập với thông tin không hợp lệ
* **Mục đích:** Xác minh hệ thống chặn đăng nhập khi sai email/số điện thoại hoặc mật khẩu.
* **Các bước thực hiện:**
  1. Mở trang đăng nhập.
  2. Nhập Email/SĐT chưa đăng ký hoặc mật khẩu sai.
  3. Bấm "Đăng nhập".
* **Kết quả mong đợi:** Đăng nhập thất bại, hệ thống hiển thị thông báo lỗi rõ ràng (ví dụ: "Tài khoản hoặc mật khẩu không chính xác") và không chuyển trang.

---

## 2. Kiểm thử các luồng nghiệp vụ E2E (Happy Path Flows)

### TC-FLOW-01: Luồng xử lý công việc thanh toán bằng tiền mặt (Happy Path)
* **Mục đích:** Kiểm tra luồng xử lý trọn vẹn từ lúc tạo phiếu đến khi đóng phiếu bằng thanh toán tiền mặt.
* **Các bước thực hiện:**
  1. **[Dispatcher/Admin]** Đăng nhập hệ thống -> Vào màn hình `Công việc` -> Bấm `Tạo công việc`. Nhập thông tin khách hàng mới, chọn loại việc "Bảo trì/Sửa chữa", nhập mô tả sự cố, chọn Kỹ thuật viên A -> Lưu.
  2. **[Technician A]** Đăng nhập thiết bị di động -> Vào danh sách công việc -> Tìm phiếu vừa được giao -> Bấm `Nhận việc`.
  3. **[Technician A]** Khi bắt đầu di chuyển, bấm `Đang di chuyển`.
  4. **[Technician A]** Đến hiện trường -> Bấm `Check-in` (đồng ý chia sẻ vị trí GPS).
  5. **[Technician A]** Tại màn hình thi công:
     * Tải lên 2 ảnh trước khi xử lý (mục "Ảnh trước").
     * Thêm vật tư sử dụng: Nhập tên "Camera IP 2MP", số lượng "2", đơn giá "500000".
     * Thêm tiền công sửa chữa: Nhập "200000".
     * Ghi nhận ghi chú hiện trường: "Đã thay thế camera hỏng".
     * Tải lên 2 ảnh sau khi xử lý (mục "Ảnh sau").
     * Bấm `Hoàn tất xử lý`.
  6. **[Technician A / Khách hàng]** Cho khách hàng xem tóm tắt thông tin vật tư và chi phí. Nhập tên người ký nghiệm thu, cho khách ký chữ ký trên màn hình, tick chọn "Đồng ý nghiệm thu" -> Bấm `Xác nhận`.
  7. **[Accountant/Admin]** Mở chi tiết phiếu -> Vào tab `Thu tiền` -> Chọn `Đã thanh toán` -> Chọn phương thức `Tiền mặt` -> Nhập số tiền thu đủ -> Bấm `Lưu`.
* **Kết quả mong đợi:**
  * Trạng thái phiếu chuyển tuần tự: `Chờ phân công` -> `Đã phân công` -> `Đã nhận việc` -> `Đang di chuyển` -> `Đang thi công` -> `Chờ nghiệm thu` -> `Đã nghiệm thu/Hoàn thành` -> `Đã thu tiền` (Đóng phiếu).
  * Vị trí GPS của kỹ thuật viên được ghi nhận chính xác tại thời điểm check-in.
  * Tổng tiền tự động tính đúng: `(2 * 500,000) + 200,000 = 1,200,000 VNĐ`.
  * Sau khi nghiệm thu, Kỹ thuật viên bị khóa quyền sửa ảnh, vật tư và chi phí.
  * Phiếu chuyển sang trạng thái đã thanh toán đầy đủ, không ghi nhận công nợ.

### TC-FLOW-02: Luồng xử lý ghi nhận công nợ và thu hồi nợ sau đó
* **Mục đích:** Kiểm tra quy trình nghiệm thu, ghi nhận công nợ và kế toán thu hồi công nợ sau đó.
* **Các bước thực hiện:**
  1. Thực hiện các bước từ 1 đến 6 giống như `TC-FLOW-01` để đưa phiếu về trạng thái `Đã nghiệm thu`.
  2. **[Accountant/Admin]** Mở chi tiết phiếu nghiệm thu -> Vào tab `Thu tiền` -> Chọn trạng thái `Công nợ`.
  3. Để trống hạn thanh toán và ghi chú -> Bấm `Lưu` (Kiểm tra xem hệ thống có báo lỗi không).
  4. Nhập hạn thanh toán (ví dụ: ngày 15 tháng sau), nhập ghi chú công nợ -> Bấm `Lưu`.
  5. Vào màn hình `Báo cáo công nợ` -> Kiểm tra xem phiếu này đã xuất hiện trong danh sách nợ chưa.
  6. **[Accountant]** Khách chuyển khoản thanh toán nợ -> Mở chi tiết phiếu nợ -> Vào tab `Thu tiền` -> Chọn `Đã thanh toán` -> Chọn phương thức `Chuyển khoản`, nhập mã giao dịch -> Bấm `Lưu`.
* **Kết quả mong đợi:**
  * Tại bước 3: Hệ thống bắt buộc phải hiển thị thông báo lỗi yêu cầu nhập hạn thanh toán hoặc ghi chú khi ghi nhận công nợ.
  * Tại bước 4: Lưu thành công, phiếu chuyển sang trạng thái `Công nợ`.
  * Tại bước 5: Phiếu xuất hiện chính xác trong danh sách công nợ với số tiền nợ bằng đúng tổng số tiền chưa thanh toán.
  * Tại bước 6: Lưu thành công, phiếu chuyển sang trạng thái `Đã thu tiền`, số dư công nợ của khách hàng giảm tương ứng về 0.

### TC-FLOW-03: Luồng hủy phiếu công việc
* **Mục đích:** Xác minh quy trình hủy phiếu yêu cầu nhập lý do và cập nhật trạng thái lịch sử.
* **Các bước thực hiện:**
  1. **[Dispatcher/Admin]** Mở một phiếu bất kỳ đang ở trạng thái `Chờ phân công` hoặc `Đã phân công`.
  2. Bấm nút `Hủy công việc` (hoặc `Hủy phiếu`).
  3. Để trống lý do hủy -> Bấm xác nhận hủy (Kiểm tra báo lỗi).
  4. Nhập lý do hủy: "Khách báo hoãn lịch" -> Bấm xác nhận.
* **Kết quả mong đợi:**
  * Hệ thống chặn không cho hủy nếu lý do trống.
  * Khi nhập lý do đầy đủ, phiếu chuyển sang trạng thái `Hủy` (`cancelled`).
  * Lịch sử trạng thái của phiếu ghi nhận rõ: "Đã hủy bởi [Tên người hủy], Lý do: Khách báo hoãn lịch".

---

## 3. Kiểm thử các màn hình chức năng chi tiết

### 3.1 Dashboard & Báo cáo
* **TC-DB-01: Thống kê và bộ lọc trạng thái trực quan:**
  * *Các bước:* Truy cập Dashboard bằng quyền Admin/Dispatcher. Bấm lần lượt vào các thẻ thống kê: "Việc chưa làm", "Đang làm", "Hoàn thành", "Công nợ mở".
  * *Kết quả mong đợi:* Hệ thống chuyển hướng đến danh sách công việc được lọc đúng theo nhóm trạng thái trực quan đã chọn.
* **TC-DB-02: Đồng bộ dữ liệu doanh thu:**
  * *Các bước:* Thực hiện đóng 1 phiếu mới với số tiền thanh toán là 5,000,000 VNĐ. Quay lại Dashboard kiểm tra chỉ số "Đã thu hôm nay".
  * *Kết quả mong đợi:* Chỉ số tăng thêm đúng 5,000,000 VNĐ ngay lập tức hoặc sau khi reload trang.

### 3.2 Quản lý công việc (Work Orders)
* **TC-WO-01: Gợi ý tìm kiếm khách hàng cũ khi tạo phiếu:**
  * *Các bước:* Bấm Tạo công việc -> Nhập số điện thoại hoặc tên của một khách hàng đã có trong hệ thống vào ô tìm kiếm.
  * *Kết quả mong đợi:* Hệ thống gợi ý danh sách khách hàng cũ phù hợp. Chọn khách hàng cũ sẽ tự động điền các thông tin: Tên, Số điện thoại, Địa chỉ, Tọa độ bản đồ cũ.
* **TC-WO-02: Phân công kỹ thuật viên:**
  * *Các bước:* Mở phiếu ở trạng thái `Chờ phân công`. Chọn phân công Kỹ thuật viên B.
  * *Kết quả mong đợi:* Lưu thành công. Phiếu chuyển sang `Đã phân công`. Kỹ thuật viên B nhận được thông báo đẩy.

### 3.3 Giao diện Kỹ thuật viên hiện trường (Mobile View)
* **TC-TECH-01: Quy trình chuyển trạng thái tuần tự:**
  * *Các bước:* Đăng nhập tài khoản Kỹ thuật -> Mở phiếu được giao. Thực hiện bấm các nút chuyển đổi trạng thái.
  * *Kết quả mong đợi:* Các nút chuyển đổi xuất hiện tuần tự theo quy trình nghiệp vụ: `Nhận việc` -> `Bắt đầu di chuyển` -> `Check-in` -> `Hoàn tất thi công`. Kỹ thuật viên không thể nhảy cóc trạng thái (ví dụ: chưa nhận việc đã bấm check-in).
* **TC-TECH-02: Thêm vật tư hiện trường:**
  * *Các bước:* Tại trạng thái `Đang thi công`, bấm thêm vật tư. Thử nhập số lượng âm hoặc bằng 0, đơn giá âm. Sau đó nhập số lượng = 3, đơn giá = 150000.
  * *Kết quả mong đợi:* Hệ thống báo lỗi và chặn số lượng/đơn giá không hợp lệ. Khi nhập thông tin hợp lệ, hệ thống tự động tính thành tiền dòng vật tư là 450,000 VNĐ.

---

## 4. Kiểm thử các trường hợp đặc biệt & Edge Cases (Ngoại lệ & Ràng buộc)

### TC-EDGE-01: Check-in hiện trường khi thiết bị từ chối quyền vị trí (GPS)
* **Mục đích:** Đảm bảo hệ thống vẫn cho phép kỹ thuật làm việc khi không lấy được tọa độ GPS nhưng hiển thị cảnh báo phù hợp.
* **Các bước thực hiện:**
  1. Đăng nhập tài khoản Kỹ thuật trên điện thoại -> Mở phiếu đang ở trạng thái `Đang di chuyển`.
  2. Bấm nút `Check-in`.
  3. Trình duyệt/Điện thoại hỏi quyền vị trí -> Chọn "Từ chối" (Deny).
* **Kết quả mong đợi:**
  * Hệ thống ghi nhận trạng thái chuyển sang `Đang thi công`.
  * Hiển thị cảnh báo: "Không thể lấy tọa độ GPS của bạn. Hệ thống sẽ ghi nhận check-in không có tọa độ".
  * Trong cơ sở dữ liệu hoặc trang chi tiết phiếu của Admin, vị trí check-in ghi nhận giá trị `null` hoặc để trống, nhưng trạng thái vẫn cập nhật thành công.

### TC-EDGE-02: Khóa dữ liệu hiện trường sau khi nghiệm thu
* **Mục đích:** Ngăn chặn kỹ thuật viên sửa đổi vật tư, chi phí hoặc ảnh sau khi khách hàng đã ký nghiệm thu để tránh tranh chấp.
* **Các bước thực hiện:**
  1. Đăng nhập tài khoản Kỹ thuật viên.
  2. Mở một phiếu công việc đã ở trạng thái `Đã nghiệm thu` hoặc `Đã thu tiền`.
  3. Thử tìm các nút: "Thêm vật tư", "Xóa vật tư", "Upload ảnh", "Sửa chi phí công".
* **Kết quả mong đợi:**
  * Tất cả các nút chỉnh sửa, thêm, xóa vật tư/ảnh hiện trường bị ẩn hoặc vô hiệu hóa (disabled).
  * Hiển thị thông báo rõ ràng: "Chi phí đã khóa sau nghiệm thu/thanh toán".

### TC-EDGE-03: Thu tiền vượt quá tổng tiền của phiếu
* **Mục đích:** Đảm bảo số tiền thanh toán thực tế không được phép lớn hơn tổng tiền phải thanh toán của phiếu công việc.
* **Các bước thực hiện:**
  1. Mở chi tiết một phiếu có tổng tiền thanh toán là 1,500,000 VNĐ.
  2. Vào tab `Thu tiền` -> Chọn `Đã thanh toán`.
  3. Nhập số tiền thanh toán là 2,000,000 VNĐ -> Bấm `Lưu`.
* **Kết quả mong đợi:** Hệ thống chặn lưu và hiển thị thông báo lỗi: "Số tiền thanh toán không được lớn hơn tổng số tiền cần thanh toán".

### TC-EDGE-04: Đăng xuất và Hủy đăng ký nhận Web Push Notification
* **Mục đích:** Đảm bảo khi một người dùng đăng xuất khỏi thiết bị, họ không nhận được thông báo đẩy của tài khoản đó nữa (đặc biệt quan trọng với thiết bị dùng chung).
* **Các bước thực hiện:**
  1. Đăng nhập Kỹ thuật viên A trên thiết bị di động. Bật nhận thông báo thành công.
  2. Đăng xuất tài khoản Kỹ thuật viên A trên thiết bị này.
  3. **[Dispatcher]** Tạo một công việc mới và phân công cho Kỹ thuật viên A.
* **Kết quả mong đợi:**
  * Thiết bị vừa đăng xuất KHÔNG nhận được thông báo đẩy về công việc mới của Kỹ thuật viên A.
  * Cơ sở dữ liệu cập nhật trường `disabled_at` cho subscription tương ứng của Kỹ thuật viên A trên thiết bị đó.

### TC-EDGE-05: Gộp thông báo đẩy (Deduplication) trên thiết bị di động
* **Mục đích:** Tránh làm phiền người dùng bằng việc gửi liên tiếp nhiều thông báo đẩy cho cùng một phiếu công việc.
* **Các bước thực hiện:**
  1. Phân công một việc cho Kỹ thuật viên A.
  2. Thay đổi mô tả công việc đó liên tiếp 3 lần trong vòng 1 phút.
* **Kết quả mong đợi:** Trên màn hình khóa của điện thoại kỹ thuật viên, các thông báo được gộp lại (chỉ hiển thị 1 thông báo mới nhất đại diện cho phiếu đó thay vì hiển thị 3 bong bóng thông báo rời rạc).

---

## 5. Tiêu chí nghiệm thu PASS/FAIL tổng thể (Acceptance Criteria)

Hệ thống được xác nhận là đạt chất lượng để bàn giao khi:
1. **100% các Test Case loại Phân quyền (TC-ROLE)** vượt qua thành công, không xảy ra rò rỉ dữ liệu hoặc vượt quyền.
2. **Các luồng E2E Happy Path (TC-FLOW)** chạy mượt mà từ đầu đến cuối không gặp lỗi hệ thống (Crash/500).
3. **Các ràng buộc nghiệp vụ** (Khóa dữ liệu sau nghiệm thu, ràng buộc số tiền thanh toán, ràng buộc hạn nợ) hoạt động chính xác.
4. **GPS và Web Push** hoạt động ổn định trên cả hệ điều hành Android và iOS (Safari PWA).
