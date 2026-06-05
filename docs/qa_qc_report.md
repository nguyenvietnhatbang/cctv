# Báo cáo QA/QC hệ thống CCTV Ops

Ngày kiểm tra: 2026-06-04

Phạm vi kiểm tra:

- Đọc tài liệu nghiệp vụ trong `docs/luông nghiệp vụ.md`.
- Đọc tài liệu chức năng UX trong `docs/chuc-nang-ux-can-thiet.md`.
- Đọc code frontend, API route, validator, schema và type.
- Không kiểm thử dữ liệu thật vì hiện chưa có DB chạy thực tế.
- Không chỉnh sửa code.

## 1. Kết luận tổng quan

Hệ thống hiện đã có khung MVP tương đối đầy đủ cho luồng vận hành:

`Khách gọi -> Điều phối -> Kỹ thuật đi làm -> Nghiệm thu -> Thu tiền`

Mức sẵn sàng ước tính: 70-75% nếu xét theo MVP đọc code.

Các phần cốt lõi đã có:

- Đăng nhập và phân quyền cơ bản.
- Quản lý phiếu công việc.
- Tạo phiếu và chọn khách hàng.
- Phân công kỹ thuật viên.
- Kỹ thuật viên xem việc được giao.
- Cập nhật trạng thái hiện trường.
- Upload ảnh.
- Nhập vật tư và tiền công.
- Ký nghiệm thu.
- Xác nhận thanh toán hoặc công nợ.
- Báo cáo cơ bản.
- Thông báo trong web.

Chưa nên xem là đạt mức UI/UX cao hoặc sẵn sàng bàn giao vận hành thật nếu chưa bổ sung các điểm còn thiếu về action, bộ lọc, form, kiểm soát lỗi và trải nghiệm mobile.

## 2. Kết quả kiểm tra kỹ thuật

Đã chạy:

```bash
npm run lint
npm run build
```

Kết quả:

- `npm run lint`: pass.
- `npm run build`: pass.
- Next.js build thành công với `Next.js 16.2.7`.
- Không phát hiện lỗi TypeScript/ESLint ở mức build hiện tại.

Lưu ý: chưa smoke test luồng thật do chưa có DB/runtime data.

## 3. Đối chiếu nghiệp vụ

### 3.1 Vai trò người dùng

Đã có đủ 4 vai trò theo tài liệu:

- Admin.
- Điều phối.
- Kỹ thuật viên.
- Kế toán.

Code định nghĩa tại `lib/types.ts`:

- `admin`
- `dispatcher`
- `technician`
- `accountant`

Đánh giá: đạt phần khung vai trò.

Rủi ro còn lại:

- UI phân quyền có nhưng chưa thật mượt ở một số action. Ví dụ form thanh toán vẫn hiện cho backoffice theo vai trò, nhưng nếu trạng thái chưa phù hợp thì backend mới chặn sau khi submit.

### 3.2 Vòng đời phiếu công việc

Bộ trạng thái đã đủ gần như tài liệu:

- `pending_assignment`: Chờ phân công.
- `assigned`: Đã phân công.
- `accepted`: Đã nhận việc.
- `traveling`: Đang di chuyển.
- `working`: Đang thi công.
- `awaiting_acceptance`: Chờ nghiệm thu.
- `completed`: Hoàn thành.
- `awaiting_payment`: Chờ thanh toán.
- `paid`: Đã thanh toán.
- `debt`: Công nợ.
- `cancelled`: Hủy.

Backend có kiểm soát chuyển trạng thái đúng thứ tự trong `lib/work-orders.ts`.

Đánh giá: đạt phần lõi backend.

Thiếu:

- UI chưa có action hủy phiếu kèm lý do rõ ràng.
- UI chưa có flow quay lại/chỉnh lỗi đủ rõ cho các trạng thái đặc biệt.
- Action trạng thái ở UI mới expose một số trạng thái tiếp theo qua `NEXT_STATUS_ACTIONS`, chưa đầy đủ toàn bộ nghiệp vụ.

## 4. Đối chiếu màn hình chính

### 4.1 Dashboard

Đã có:

- Phiếu hôm nay.
- Chờ phân công.
- Đang xử lý.
- Chờ nghiệm thu.
- Chờ thanh toán.
- Đã thu hôm nay.
- Công nợ mở.
- Click metric để lọc danh sách phiếu.

Đánh giá: đạt MVP.

Thiếu/cần cải thiện:

- Danh sách việc cần xử lý mới hiển thị 10 phiếu đầu, chưa có sắp xếp ưu tiên rõ theo SLA/giờ hẹn/gấp.
- Chưa có trạng thái cảnh báo quá hạn.

### 4.2 Danh sách công việc

Đã có bộ lọc:

- Từ khóa theo mã phiếu, khách, SĐT, địa chỉ.
- Trạng thái.
- Loại việc.
- Kỹ thuật viên.
- Từ ngày/đến ngày.

Đã có action:

- Xem.
- Sửa.
- Xóa.

Đánh giá: khá tốt cho MVP điều phối.

Thiếu/cần cải thiện:

- Bảng nhiều cột chưa có xử lý mobile tốt; `.table-shell` đang `overflow: hidden`, có nguy cơ cắt nội dung trên màn nhỏ.
- Chưa có phân trang hoặc infinite load; API limit 80 phiếu.
- Chưa có filter riêng theo ngày hẹn và ngày tạo. Hiện filter date đang dựa trên `created_at`.
- Chưa có sort theo ưu tiên, giờ hẹn, trạng thái.

### 4.3 Tạo phiếu công việc

Đã có:

- Chọn khách cũ hoặc nhập khách mới.
- Tên khách.
- Số điện thoại.
- Địa chỉ.
- Ghi chú địa chỉ.
- Loại việc.
- Mức ưu tiên.
- Thời gian hẹn.
- Kỹ thuật viên hoặc lưu chờ phân công.
- Mô tả sự cố.
- Ghi chú nội bộ.

Đánh giá: đạt MVP.

Thiếu/cần cải thiện:

- Tài liệu yêu cầu `Tạo và phân công` hoặc `Lưu chờ phân công`; UI hiện chỉ có một nút `Tạo phiếu`.
- Chưa có gợi ý khách cũ theo số điện thoại khi đang nhập.
- Chưa có upload ảnh hiện trạng ngay ở bước tạo phiếu.
- Form dùng nhiều placeholder thay vì label cố định, chưa tốt cho accessibility và form dài.
- Chưa có báo lỗi inline tại từng trường; lỗi chủ yếu từ browser/backend.

### 4.4 Chi tiết phiếu công việc

Đã có:

- Trạng thái hiện tại.
- Thông tin khách.
- Số điện thoại.
- Địa chỉ.
- Kỹ thuật viên.
- Giờ hẹn.
- Gọi khách.
- Mở bản đồ.
- Action trạng thái tiếp theo.
- Chi phí và ghi chú.
- Phân công.
- Lịch sử trạng thái.
- Upload ảnh/chữ ký.
- Vật tư.
- Thanh toán.
- Nghiệm thu.
- Link biên bản nghiệm thu.

Đánh giá: là phần mạnh nhất của hệ thống hiện tại.

Thiếu/cần cải thiện:

- Chưa chia ảnh trước/sau thành khu vực riêng rõ ràng; hiện dùng một select `purpose`.
- Chưa có preview ảnh trực quan, chỉ link file.
- Chưa có xóa/replace ảnh.
- Chưa có sửa/xóa vật tư từng dòng.
- Chưa có action hủy phiếu có lý do.
- Chưa hiển thị payment label tiếng Việt đầy đủ trong mọi nơi.
- Chưa có loading state/disabled state rõ khi submit action.

### 4.5 Phân công kỹ thuật

Đã có:

- Danh sách phiếu chờ phân công.
- Danh sách kỹ thuật viên.
- Trạng thái kỹ thuật viên.
- Khu vực.
- Số việc hôm nay.
- Form phân công trong modal chi tiết.

Đánh giá: đạt MVP.

Thiếu/cần cải thiện:

- Chưa có cảnh báo rõ khi chọn kỹ thuật viên đang bận.
- Chưa có lịch/map điều phối.
- Chưa cho chọn nhanh kỹ thuật viên ngay trên màn phân công, phải mở chi tiết phiếu.
- Chưa có timeline/lịch trong ngày của từng kỹ thuật viên.

### 4.6 Công việc hôm nay của kỹ thuật viên

Đã có:

- Danh sách phiếu được giao.
- Trạng thái.
- Địa chỉ.
- SĐT khách.
- Giờ hẹn.
- Gọi khách.
- Mở bản đồ.
- Mở chi tiết.

Đánh giá: đạt MVP và có chú ý mobile.

Thiếu/cần cải thiện:

- Chưa có đánh dấu phiếu tiếp theo rõ ràng.
- Chưa có offline state hoặc cảnh báo mất mạng.
- Chưa có layout theo timeline giờ hẹn.

### 4.7 Thao tác hiện trường

Đã có:

- Nhận việc.
- Đang di chuyển.
- Check-in có lấy geolocation nếu trình duyệt cho phép.
- Hoàn tất xử lý.
- Upload ảnh.
- Nhập vật tư.
- Nhập tiền công/VAT.
- Ghi chú hoàn thành.
- Ký nghiệm thu.

Đánh giá: đạt MVP.

Thiếu/cần cải thiện:

- Nếu không lấy được GPS, hệ thống vẫn chuyển trạng thái mà không báo rõ cho kỹ thuật viên.
- Chưa bắt buộc ảnh trước/sau trước khi nghiệm thu.
- Chưa có checklist thao tác theo thứ tự rõ ràng; các form nằm cùng modal, dễ hơi nặng trên mobile.
- Chưa có retry/offline handling.

### 4.8 Nghiệm thu

Đã có:

- Tên khách.
- Địa chỉ.
- Tổng tiền.
- Tên người ký.
- SĐT người ký.
- Canvas chữ ký.
- Checkbox xác nhận.
- Nút ký lại.
- Lưu nghiệm thu và chuyển trạng thái `completed`.

Đánh giá: đạt MVP.

Thiếu/cần cải thiện:

- Màn nghiệm thu chưa hiển thị rõ vật tư sử dụng.
- Chưa hiển thị nội dung đã thực hiện/completion note.
- Chưa hiển thị ảnh sau xử lý để khách đối chiếu.
- Chưa tách riêng màn khách sạch hoàn toàn khỏi modal nội bộ.

### 4.9 Thanh toán

Đã có:

- Tổng tiền.
- Trạng thái `paid` hoặc `debt`.
- Phương thức tiền mặt/chuyển khoản/công nợ.
- Mã giao dịch.
- Ngày hẹn công nợ.
- Ghi chú.
- Backend lưu người xác nhận và thời gian xác nhận.

Đánh giá: backend tốt, UI đạt MVP.

Thiếu/cần cải thiện:

- Màn Payments chưa có filter `Chờ thanh toán`, `Đã thanh toán`, `Công nợ`.
- Payment form chưa tự ẩn/disable theo trạng thái không phù hợp.
- Nếu chọn `Công nợ`, UI vẫn để method default `cash` nếu người dùng không đổi, dù backend có fallback khi method null; UX dễ nhập sai.
- Chưa có hiển thị chi tiết tiền công/vật tư/VAT ngay trong payment form, chỉ có tổng tiền.

### 4.10 Báo cáo

Đã có:

- Lọc theo khoảng ngày.
- Số phiếu.
- Đã thu.
- Công nợ.
- Tổng phát sinh.
- Theo trạng thái.
- Theo kỹ thuật viên.
- Vật tư đã dùng.

Đánh giá: đạt báo cáo cơ bản.

Thiếu/cần cải thiện:

- Chưa có export dữ liệu.
- Chưa có drill-down từ chỉ số sang danh sách phiếu tương ứng.
- Chưa phân biệt rõ ngày tạo, ngày hoàn thành, ngày thu tiền trong filter báo cáo.

### 4.11 Thông báo

Đã có:

- Danh sách thông báo.
- Badge số chưa đọc.
- Mở phiếu từ thông báo.
- Đánh dấu đã đọc.
- Backend tạo thông báo khi phân công, đổi trạng thái, thanh toán.

Đánh giá: đạt MVP web notification.

Thiếu/cần cải thiện:

- Chưa có filter thông báo đã đọc/chưa đọc.
- Chưa có đánh dấu tất cả đã đọc.
- Chưa có push notification mobile.

## 5. CRUD/action theo module

### Phiếu công việc

Đã có:

- Tạo.
- Xem.
- Sửa một số trường.
- Xóa vĩnh viễn.
- Phân công.
- Đổi trạng thái.
- Upload file.
- Thêm vật tư.
- Nghiệm thu.
- Thanh toán.

Thiếu:

- Hủy phiếu kèm lý do.
- Sửa/xóa vật tư.
- Xóa file/ảnh.
- Sửa khách hàng trong context từng phiếu.
- Khóa action theo trạng thái rõ hơn ở UI.

### Khách hàng

Đã có:

- Tạo.
- Sửa.
- Xóa.

Thiếu:

- Search/filter trên màn khách hàng.
- Lịch sử phiếu của khách.
- Gợi ý khách cũ theo số điện thoại trong form tạo phiếu.

### Nhân viên

Đã có:

- Tạo.
- Sửa.
- Ngưng hoạt động.

Thiếu:

- Reset mật khẩu.
- Kiểm tra role đổi từ technician sang role khác có xử lý technician profile không.
- Filter/search nhân viên.

### Kỹ thuật viên

Đã có:

- Danh sách.
- Sửa trạng thái/khu vực.
- Xóa hồ sơ kỹ thuật viên.
- Số việc hôm nay.

Thiếu:

- Tạo kỹ thuật viên trực tiếp từ màn kỹ thuật viên.
- Cảnh báo khi xóa kỹ thuật viên đang có việc.
- Lịch làm việc/nghỉ.

## 6. Đánh giá UI/UX

Điểm tốt:

- Giao diện gọn, đúng tinh thần operational tool.
- Có màu trạng thái rõ.
- Button action có icon ở nhiều nơi.
- Header/nav đơn giản, dễ hiểu.
- Modal chi tiết gom được nhiều thao tác nghiệp vụ.
- Technician screen có nút gọi và bản đồ, phù hợp mobile.

Điểm chưa đạt yêu cầu cao:

- Form còn dựa nhiều vào placeholder, thiếu label cố định.
- Chưa có inline validation rõ ràng ở từng field.
- Thiếu loading/disabled state khi submit.
- Bảng nhiều cột chưa xử lý mobile đủ tốt.
- Màn chi tiết phiếu có nhiều form trong một modal, dễ quá tải trên điện thoại.
- Nghiệm thu chưa đủ sạch cho khách xem.
- File upload chưa có preview ảnh, phân nhóm ảnh, xóa/replace.
- Payment screen thiếu bộ lọc riêng.
- Report thiếu export.
- Focus state cho accessibility chưa đồng đều; `.input` có focus style nhưng button/icon-button chưa có focus ring rõ.

## 7. Rủi ro nghiệp vụ

1. Dễ sai dữ liệu vật tư vì chỉ thêm, chưa sửa/xóa từng dòng.
2. Dễ nhầm ảnh trước/sau vì dùng select purpose thay vì khu vực upload riêng.
3. Dễ chuyển nghiệm thu khi chưa đủ ảnh sau xử lý nếu doanh nghiệp yêu cầu ảnh bắt buộc.
4. Xóa phiếu là xóa vĩnh viễn, có thể mất dữ liệu tranh chấp; nghiệp vụ nên ưu tiên hủy phiếu có lý do.
5. Thanh toán có thể gây lỗi UX vì backend mới chặn trạng thái không hợp lệ sau submit.
6. Báo cáo doanh thu theo ngày tạo phiếu có thể lệch với nhu cầu kế toán theo ngày thu tiền.
7. README đang trỏ tới `docs/qa-acceptance-criteria.md` nhưng file này không tồn tại trong repo hiện tại.

## 8. Ưu tiên xử lý đề xuất

### P0 - Cần trước khi bàn giao vận hành

- Thêm action hủy phiếu kèm lý do, tránh xóa vĩnh viễn.
- Thêm sửa/xóa vật tư.
- Tách upload ảnh trước/sau/hiện trạng thành khu vực riêng.
- Bắt buộc điều kiện nghiệm thu nếu nghiệp vụ yêu cầu: ảnh sau, chữ ký, completion note.
- Hoàn thiện filter thanh toán: chờ thanh toán, đã thanh toán, công nợ.
- Thêm loading/disabled state cho các form/action quan trọng.
- Làm rõ state thanh toán trong UI và disable action sai trạng thái.

### P1 - Nâng UX vận hành

- Search khách cũ theo số điện thoại khi tạo phiếu.
- Tách CTA `Lưu chờ phân công` và `Tạo và phân công`.
- Thêm preview ảnh.
- Cải thiện mobile table bằng card layout hoặc horizontal scroll.
- Thêm label cố định cho form.
- Thêm inline error dưới từng field.
- Thêm filter/search khách hàng, nhân viên, kỹ thuật viên.

### P2 - Sau MVP

- Export báo cáo.
- Drill-down báo cáo sang danh sách phiếu.
- Lịch/map điều phối.
- Push notification.
- Offline/retry cho kỹ thuật viên.
- Reset mật khẩu nhân viên.

## 9. Kết luận bàn giao

Hệ thống đã có nền tảng tốt và đúng hướng nghiệp vụ. Nếu mục tiêu là demo nội bộ hoặc MVP kỹ thuật, code hiện tại đủ để tiếp tục kết nối DB và smoke test.

Nếu mục tiêu là bàn giao cho đội điều phối/kỹ thuật dùng thật hằng ngày, cần bổ sung các action còn thiếu và nâng UX nhập liệu trước. Các điểm quan trọng nhất là hủy phiếu có lý do, quản lý vật tư/ảnh tốt hơn, payment filter, nghiệm thu sạch cho khách và mobile UX cho kỹ thuật viên.
