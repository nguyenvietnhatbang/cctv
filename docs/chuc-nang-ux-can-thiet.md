# Chức năng UX cần thiết cho hệ thống điều phối kỹ thuật

Tài liệu này chuyển luồng nghiệp vụ hiện có thành danh sách chức năng UX cần thiết để web/app có thể vận hành thực tế. Mục tiêu là phục vụ đúng quy trình:

**Khách gọi -> Điều phối -> Kỹ thuật đi làm -> Nghiệm thu -> Thu tiền**

Không mở rộng sang các tính năng không cần thiết như marketing, CRM phức tạp, tự động hóa nâng cao, phân tích chuyên sâu hoặc quản trị nhiều chi nhánh nếu chưa có nhu cầu thật.

## 1. Vai trò người dùng

Hệ thống cần tối thiểu 4 vai trò.

### Admin

Quản lý cấu hình và xem toàn bộ dữ liệu.

Chức năng cần có:

- Xem tổng quan công việc, doanh thu, công nợ.
- Quản lý tài khoản nhân viên.
- Quản lý danh sách kỹ thuật viên.
- Xem toàn bộ phiếu công việc.
- Chỉnh sửa dữ liệu khi cần xử lý sai sót.

### Điều phối

Người tiếp nhận yêu cầu khách hàng và phân công kỹ thuật.

Chức năng cần có:

- Tạo phiếu công việc.
- Tìm kiếm khách hàng cũ hoặc tạo khách hàng mới.
- Xem danh sách kỹ thuật viên đang rảnh/bận.
- Gán kỹ thuật viên cho phiếu.
- Theo dõi trạng thái công việc.
- Trao đổi hoặc ghi chú nội bộ trên phiếu.
- Xác nhận hoặc chuyển cho kế toán xác nhận thanh toán.

### Kỹ thuật viên

Người nhận việc và cập nhật thông tin tại hiện trường.

Chức năng cần có:

- Xem danh sách công việc được giao.
- Xem chi tiết địa chỉ, số điện thoại, mô tả sự cố.
- Mở bản đồ chỉ đường.
- Cập nhật trạng thái công việc.
- Check-in khi tới nơi.
- Chụp ảnh trước và sau xử lý.
- Ghi vật tư sử dụng.
- Ghi công sửa chữa/lắp đặt nếu có.
- Ghi chú phát sinh.
- Cho khách ký nghiệm thu trên màn hình.
- Gửi kết quả hoàn thành về hệ thống.

### Kế toán hoặc người xác nhận tiền

Vai trò này có thể là kế toán riêng hoặc điều phối kiêm nhiệm.

Chức năng cần có:

- Xem các phiếu đã hoàn thành.
- Kiểm tra tổng tiền công, vật tư, VAT nếu có.
- Cập nhật trạng thái thanh toán.
- Ghi nhận hình thức thanh toán: tiền mặt, chuyển khoản, công nợ.
- Xem danh sách công nợ chưa thu.

## 2. Vòng đời một phiếu công việc

Phiếu công việc là đối tượng chính của hệ thống. Mọi màn hình nên xoay quanh phiếu này.

### Trạng thái phiếu

Cần dùng một bộ trạng thái rõ ràng:

- `Chờ phân công`: điều phối mới tạo phiếu, chưa giao kỹ thuật.
- `Đã phân công`: đã chọn kỹ thuật viên.
- `Đã nhận việc`: kỹ thuật viên xác nhận nhận việc.
- `Đang di chuyển`: kỹ thuật viên đang tới địa điểm.
- `Đang thi công`: kỹ thuật viên đã check-in và bắt đầu xử lý.
- `Chờ nghiệm thu`: kỹ thuật viên đã xử lý xong, chờ khách xác nhận.
- `Hoàn thành`: đã có ảnh sau xử lý và chữ ký nghiệm thu.
- `Chờ thanh toán`: hoàn thành kỹ thuật nhưng chưa xác nhận tiền.
- `Đã thanh toán`: đã thu đủ tiền.
- `Công nợ`: khách chưa thanh toán ngay.
- `Hủy`: phiếu bị hủy, phải có lý do.

Không nên để người dùng tự gõ trạng thái bằng tay. Trạng thái phải được đổi bằng nút hành động cụ thể để tránh sai dữ liệu.

### Luồng trạng thái chuẩn

1. Điều phối tạo phiếu ở trạng thái `Chờ phân công`.
2. Điều phối gán kỹ thuật viên, phiếu chuyển sang `Đã phân công`.
3. Kỹ thuật viên bấm nhận việc, phiếu chuyển sang `Đã nhận việc`.
4. Kỹ thuật viên bấm đang di chuyển, phiếu chuyển sang `Đang di chuyển`.
5. Kỹ thuật viên check-in tại địa điểm, phiếu chuyển sang `Đang thi công`.
6. Kỹ thuật viên cập nhật ảnh, vật tư, chi phí, ghi chú.
7. Kỹ thuật viên bấm hoàn tất xử lý, phiếu chuyển sang `Chờ nghiệm thu`.
8. Khách ký xác nhận, phiếu chuyển sang `Hoàn thành`.
9. Điều phối/kế toán xác nhận tiền, phiếu chuyển sang `Đã thanh toán` hoặc `Công nợ`.

## 3. Thông tin cần có trong phiếu công việc

### Thông tin khách hàng

- Tên khách hàng.
- Số điện thoại.
- Địa chỉ thi công/sửa chữa.
- Ghi chú địa chỉ nếu có: tầng, phòng, cổng vào, người liên hệ tại chỗ.

UX cần có:

- Khi nhập số điện thoại, hệ thống nên gợi ý khách cũ nếu đã tồn tại.
- Cho phép dùng lại địa chỉ cũ nhưng vẫn sửa được địa chỉ cho từng lần làm việc.
- Số điện thoại là trường bắt buộc.
- Địa chỉ là trường bắt buộc.

### Thông tin công việc

- Loại công việc: bảo hành, bảo trì, thi công lắp mới, khác.
- Mô tả sự cố hoặc yêu cầu.
- Mức độ ưu tiên nếu cần: bình thường, gấp.
- Thời gian hẹn khách nếu có.
- Ảnh hiện trạng do điều phối tải lên nếu khách gửi trước.

UX cần có:

- Loại công việc chọn từ danh sách, không nhập tự do.
- Mô tả sự cố nên là ô nhập nhiều dòng.
- Ảnh hiện trạng là tùy chọn ở bước tạo phiếu.

### Thông tin phân công

- Kỹ thuật viên được giao.
- Thời gian giao việc.
- Người giao việc.
- Ghi chú nội bộ cho kỹ thuật.

UX cần có:

- Điều phối nhìn được danh sách kỹ thuật viên kèm trạng thái hiện tại.
- Khi chọn kỹ thuật viên, cần thấy số việc đang làm hoặc việc trong ngày.
- Một phiếu tối thiểu có 1 kỹ thuật viên phụ trách.
- Có thể đổi kỹ thuật viên trước khi hoàn thành, nhưng phải lưu lại lịch sử đổi.

### Thông tin hiện trường

- Thời gian nhận việc.
- Thời gian bắt đầu di chuyển.
- Thời gian check-in.
- Vị trí check-in nếu thiết bị có GPS.
- Ảnh trước khi xử lý.
- Ghi chú khảo sát ban đầu.
- Danh sách vật tư sử dụng.
- Chi phí công sửa chữa/lắp đặt nếu có.
- Ảnh sau xử lý.
- Ghi chú hoàn thành.

UX cần có:

- Kỹ thuật viên thao tác được tốt trên điện thoại.
- Các nút trạng thái phải rõ và theo đúng thứ tự công việc.
- Ảnh trước/sau phải có khu vực upload riêng, tránh nhầm lẫn.
- Ghi vật tư theo từng dòng gồm tên vật tư, số lượng, đơn giá, thành tiền.
- Thành tiền vật tư nên tự tính từ số lượng và đơn giá.

### Thông tin nghiệm thu

- Tên người ký nghiệm thu.
- Số điện thoại người ký nếu khác khách ban đầu.
- Chữ ký trên màn hình.
- Ảnh sau xử lý.
- Thời gian nghiệm thu.
- File biên bản nghiệm thu PDF.

UX cần có:

- Màn hình ký nghiệm thu phải đơn giản, chỉ hiển thị thông tin cần xác nhận.
- Khách cần thấy tóm tắt công việc, vật tư và tổng tiền trước khi ký nếu có thu tiền.
- Có nút xóa ký lại.
- Sau khi ký, hệ thống tạo biên bản nghiệm thu.

### Thông tin thanh toán

- Tiền công.
- Tiền vật tư.
- VAT nếu có.
- Tổng tiền.
- Hình thức thanh toán: tiền mặt, chuyển khoản, công nợ.
- Trạng thái thanh toán: chưa thanh toán, đã thanh toán, công nợ.
- Người xác nhận thanh toán.
- Thời gian xác nhận thanh toán.
- Ghi chú thanh toán.

UX cần có:

- Tổng tiền tự cộng từ tiền công, vật tư và VAT.
- Không cho đánh dấu `Đã thanh toán` nếu chưa nhập hình thức thanh toán.
- Nếu chọn `Công nợ`, cần có ghi chú hoặc ngày hẹn thanh toán nếu doanh nghiệp muốn theo dõi.

## 4. Các màn hình cần thiết

### 4.1 Dashboard

Dành cho admin và điều phối.

Nội dung cần hiển thị:

- Số phiếu hôm nay.
- Số phiếu chờ phân công.
- Số phiếu đang thi công.
- Số phiếu chờ nghiệm thu.
- Số phiếu chờ thanh toán.
- Doanh thu đã thu trong ngày.
- Công nợ đang mở.

UX cần có:

- Các số liệu bấm được để lọc danh sách phiếu tương ứng.
- Ưu tiên hiển thị việc cần xử lý ngay, không chỉ hiển thị biểu đồ.

### 4.2 Danh sách công việc

Đây là màn hình chính của điều phối.

Nội dung cần hiển thị mỗi dòng:

- Mã phiếu.
- Tên khách.
- Số điện thoại.
- Địa chỉ rút gọn.
- Loại công việc.
- Kỹ thuật viên phụ trách.
- Trạng thái.
- Thời gian hẹn hoặc thời gian tạo.

Bộ lọc cần có:

- Trạng thái.
- Loại công việc.
- Kỹ thuật viên.
- Ngày tạo/ngày hẹn.
- Từ khóa theo tên khách, số điện thoại, mã phiếu.

UX cần có:

- Trạng thái phải dễ nhìn bằng màu/nhãn.
- Có nút tạo phiếu mới rõ ràng.
- Bấm vào một dòng để mở chi tiết phiếu.
- Danh sách phải dùng được khi có nhiều phiếu trong ngày.

### 4.3 Tạo phiếu công việc

Dành cho điều phối.

Các phần trên form:

- Thông tin khách hàng.
- Thông tin công việc.
- Ảnh hiện trạng nếu có.
- Thời gian hẹn.
- Ghi chú nội bộ.
- Phân công kỹ thuật viên nếu đã biết người làm.

UX cần có:

- Form không nên quá dài trong một khối khó đọc; nên chia theo nhóm thông tin.
- Sau khi tạo xong, điều phối được chọn `Tạo và phân công` hoặc `Lưu chờ phân công`.
- Báo lỗi rõ tại trường thiếu thông tin.

### 4.4 Chi tiết phiếu công việc

Dành cho admin, điều phối, kỹ thuật viên và kế toán nhưng mỗi vai trò thấy nút hành động khác nhau.

Nội dung cần hiển thị:

- Thông tin khách hàng.
- Thông tin công việc.
- Trạng thái hiện tại.
- Người phụ trách.
- Lịch sử trạng thái.
- Ảnh hiện trạng/trước/sau.
- Vật tư sử dụng.
- Chi phí.
- Nghiệm thu.
- Thanh toán.
- Ghi chú nội bộ.

UX cần có:

- Trạng thái hiện tại phải nằm ở vị trí dễ thấy.
- Nút hành động tiếp theo phải rõ ràng, ví dụ `Nhận việc`, `Check-in`, `Hoàn tất xử lý`, `Ký nghiệm thu`.
- Không hiển thị quá nhiều nút không liên quan đến vai trò hiện tại.
- Lịch sử cập nhật nên có thời gian và người thực hiện.

### 4.5 Màn hình phân công kỹ thuật

Dành cho điều phối.

Nội dung cần hiển thị:

- Danh sách kỹ thuật viên.
- Trạng thái từng kỹ thuật viên: rảnh, đang di chuyển, đang thi công, nghỉ.
- Khu vực phụ trách nếu có.
- Số phiếu đang nhận trong ngày.
- Phiếu cần phân công.

UX cần có:

- Điều phối chọn kỹ thuật viên rồi xác nhận giao việc.
- Nếu kỹ thuật viên đang bận, hệ thống vẫn có thể cho giao nhưng cần cảnh báo.
- Sau khi giao, kỹ thuật viên nhận thông báo.

### 4.6 Công việc hôm nay của kỹ thuật viên

Dành cho kỹ thuật viên trên điện thoại.

Nội dung cần hiển thị:

- Các phiếu được giao trong ngày.
- Trạng thái từng phiếu.
- Địa chỉ rút gọn.
- Số điện thoại khách.
- Giờ hẹn nếu có.

UX cần có:

- Ưu tiên giao diện mobile.
- Mỗi phiếu có nút gọi khách và mở bản đồ.
- Phiếu cần làm tiếp theo phải dễ nhận biết.

### 4.7 Chi tiết công việc cho kỹ thuật viên

Dành cho thao tác ngoài hiện trường.

Các thao tác cần có:

- Gọi khách.
- Mở bản đồ.
- Nhận việc.
- Cập nhật đang di chuyển.
- Check-in.
- Chụp ảnh trước.
- Nhập vật tư.
- Nhập tiền công.
- Chụp ảnh sau.
- Ghi chú hoàn thành.
- Chuyển sang nghiệm thu.

UX cần có:

- Các thao tác theo thứ tự thực tế, tránh bắt kỹ thuật viên tìm kiếm.
- Ảnh chụp nên hỗ trợ chụp trực tiếp từ camera và chọn từ máy.
- Khi mất mạng, nếu chưa làm offline thì tối thiểu phải báo rõ chưa lưu được.

### 4.8 Nghiệm thu

Dành cho kỹ thuật viên thực hiện cùng khách.

Nội dung cần hiển thị cho khách:

- Tên khách hàng.
- Địa chỉ.
- Loại công việc.
- Nội dung đã thực hiện.
- Vật tư sử dụng.
- Tổng tiền nếu có.
- Ảnh sau xử lý nếu cần đối chiếu.
- Khu vực ký xác nhận.

UX cần có:

- Màn hình sạch, dễ đọc, không lẫn ghi chú nội bộ.
- Có checkbox hoặc dòng xác nhận rằng khách đồng ý nghiệm thu.
- Có nút ký lại trước khi lưu.
- Sau khi lưu nghiệm thu, không cho sửa chữ ký nếu không có quyền admin/điều phối.

### 4.9 Thanh toán

Dành cho điều phối/kế toán.

Nội dung cần hiển thị:

- Phiếu đã hoàn thành nhưng chưa thanh toán.
- Tổng tiền từng phiếu.
- Hình thức thanh toán.
- Trạng thái thanh toán.
- Ghi chú công nợ.

UX cần có:

- Có bộ lọc `Chờ thanh toán`, `Đã thanh toán`, `Công nợ`.
- Khi xác nhận thanh toán, cần lưu người xác nhận và thời gian.
- Nếu chuyển khoản, có thể nhập mã giao dịch hoặc ghi chú nếu cần.

### 4.10 Báo cáo cơ bản

Chỉ cần báo cáo phục vụ vận hành hằng ngày.

Báo cáo cần có:

- Số phiếu theo ngày/tháng.
- Số phiếu theo trạng thái.
- Doanh thu đã thu.
- Công nợ chưa thu.
- Doanh thu theo kỹ thuật viên nếu cần tính hiệu quả.
- Danh sách vật tư đã dùng.

UX cần có:

- Lọc theo khoảng ngày.
- Xuất dữ liệu nếu cần đối soát.
- Không cần biểu đồ phức tạp ở giai đoạn đầu.

## 5. Thông báo cần thiết

Thông báo chỉ cần phục vụ các điểm chuyển giao công việc.

Cần có:

- Thông báo cho kỹ thuật viên khi được giao phiếu.
- Thông báo cho điều phối khi kỹ thuật viên nhận việc.
- Thông báo khi kỹ thuật viên check-in.
- Thông báo khi phiếu hoàn thành chờ nghiệm thu hoặc chờ thanh toán.
- Thông báo khi phiếu bị hủy hoặc đổi người phụ trách.

UX cần có:

- Trong web phải có danh sách thông báo.
- Trên điện thoại kỹ thuật viên nên có push notification nếu app/hệ thống hỗ trợ.
- Nếu chưa có push notification, cần có trạng thái rõ trên màn hình công việc hôm nay.

## 6. Quyền hạn tối thiểu

### Admin

- Xem, tạo, sửa, xóa hoặc hủy phiếu.
- Quản lý nhân viên.
- Xem báo cáo.
- Sửa dữ liệu sau nghiệm thu/thanh toán khi cần.

### Điều phối

- Tạo và sửa phiếu trước khi hoàn thành.
- Gán hoặc đổi kỹ thuật viên.
- Theo dõi toàn bộ phiếu.
- Hủy phiếu kèm lý do.
- Xác nhận thanh toán nếu được phân quyền.

### Kỹ thuật viên

- Chỉ thấy phiếu được giao cho mình.
- Cập nhật trạng thái hiện trường.
- Upload ảnh.
- Nhập vật tư và ghi chú.
- Thực hiện nghiệm thu.
- Không được sửa thông tin khách hàng chính nếu không có quyền.
- Không được tự xóa phiếu.

### Kế toán

- Xem phiếu đã hoàn thành.
- Cập nhật thanh toán.
- Xem công nợ và báo cáo doanh thu.
- Không cần quyền phân công kỹ thuật.

## 7. Dữ liệu cần lưu lại để tránh tranh chấp

Hệ thống cần lưu các thông tin sau:

- Ai tạo phiếu.
- Ai được giao việc.
- Ai đổi trạng thái.
- Thời gian từng trạng thái.
- Ảnh trước xử lý.
- Ảnh sau xử lý.
- Vật tư sử dụng.
- Tiền công và tổng tiền.
- Chữ ký nghiệm thu.
- Người xác nhận thanh toán.
- Lý do hủy nếu phiếu bị hủy.

Đây là phần quan trọng vì giúp đối chiếu khi khách thắc mắc, kỹ thuật báo sai, hoặc kế toán cần kiểm tra tiền.

## 8. Nguyên tắc UX khi thiết kế giao diện

- Người dùng phải luôn biết phiếu đang ở trạng thái nào.
- Mỗi màn hình chỉ nên ưu tiên hành động tiếp theo của vai trò đó.
- Form nhập liệu phải chia nhóm rõ ràng.
- Các trường bắt buộc phải báo lỗi ngay và dễ hiểu.
- Trạng thái, tiền, ảnh và chữ ký phải khó nhập nhầm.
- Kỹ thuật viên dùng điện thoại là chính, nên thao tác hiện trường phải ngắn và rõ.
- Điều phối cần nhìn danh sách nhanh, lọc nhanh, xử lý nhanh.
- Khách chỉ nhìn thấy màn hình nghiệm thu sạch sẽ, không thấy ghi chú nội bộ.
- Mọi thay đổi quan trọng phải có lịch sử.

## 9. Phạm vi nên làm trước

Giai đoạn đầu nên tập trung làm đủ các phần sau:

1. Đăng nhập và phân quyền cơ bản.
2. Quản lý nhân viên/kỹ thuật viên.
3. Tạo phiếu công việc.
4. Danh sách và chi tiết phiếu.
5. Phân công kỹ thuật.
6. Màn hình công việc hôm nay cho kỹ thuật viên.
7. Cập nhật trạng thái, check-in, upload ảnh.
8. Nhập vật tư và chi phí.
9. Ký nghiệm thu.
10. Xác nhận thanh toán.
11. Báo cáo doanh thu và công nợ cơ bản.

Các phần có thể để sau nếu chưa cần:

- Tối ưu tuyến đường.
- Chấm công riêng.
- Kho vật tư đầy đủ.
- Tự động nhắc nợ.
- Tích hợp ngân hàng.
- Tích hợp tổng đài.
- App mobile native riêng.
- Phân tích hiệu suất nâng cao.

## 10. Kết luận

Hệ thống cần được thiết kế quanh phiếu công việc và trạng thái xử lý. Chỉ cần làm tốt việc tiếp nhận, phân công, cập nhật hiện trường, nghiệm thu và thanh toán là đã đáp ứng đúng luồng vận hành của đội kỹ thuật khoảng 10 người.

Ưu tiên UX là nhanh, rõ, ít nhầm lẫn và dùng tốt trên điện thoại cho kỹ thuật viên.
