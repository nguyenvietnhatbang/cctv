# Ke hoach kiem thu theo luong

Tai lieu nay dung de kiem thu nghiem thu he thong CCTV Ops theo luong nghiep vu:

`Khach goi -> Dieu phoi -> Ky thuat di lam -> Nghiem thu -> Thu tien`

## 1. Pham vi kiem thu

Kiem thu cac chuc nang chinh da co trong ung dung:

- Dang nhap, dang xuat va dieu huong theo vai tro.
- Dashboard van hanh.
- Quan ly nhan vien, khach hang, ky thuat vien.
- Tao, loc, xem, sua va huy phieu cong viec.
- Phan cong va doi ky thuat vien.
- Ky thuat vien cap nhat trang thai hien truong.
- Upload file/anh theo muc dich, nhap vat tu, cap nhat chi phi.
- Ky nghiem thu va tao bien ban.
- Xac nhan thanh toan hoac cong no.
- Bao cao, thong bao va danh dau da doc.
- Kiem tra API validation, phan quyen va cac luong loi quan trong.

## 2. Moi truong va du lieu dau vao

Chay ung dung o mock mode khi chua co PostgreSQL/Supabase:

```bash
CCTV_DATA_MODE="mock"
SESSION_SECRET="replace-with-openssl-rand-base64-32"
```

Tai khoan demo:

- `admin@demo.local` / `demo1234`
- `dispatch@demo.local` / `demo1234`
- `minh@demo.local` / `demo1234`
- `accounting@demo.local` / `demo1234`

Lenh kiem tra truoc khi ban giao:

```bash
npm run lint
npm run build
```

Tieu chi chung:

- Khong co loi lint/build.
- Khong co loi console nghiem trong khi thao tac.
- Moi thao tac thanh cong cap nhat dung UI hien tai, danh sach lien quan, dashboard/thong bao khi co anh huong.
- Loi validation hien thi ro rang, khong lam mat du lieu form nguoi dung vua nhap.
- Trang thai va lich su trang thai cua phieu dung voi hanh dong vua thuc hien.

## 3. Ma trang thai can kiem tra

Thu tu trang thai chuan:

1. `pending_assignment` - Cho phan cong.
2. `assigned` - Da phan cong.
3. `accepted` - Da nhan viec.
4. `traveling` - Dang di chuyen.
5. `working` - Dang thi cong.
6. `awaiting_acceptance` - Cho nghiem thu.
7. `completed` - Hoan thanh.
8. `awaiting_payment` - Cho thanh toan.
9. `paid` - Da thanh toan, hoac `debt` - Cong no.

Trang thai dac biet:

- `cancelled` - Huy, bat buoc co ly do va chi admin/dieu phoi duoc thuc hien.

## 4. Smoke test bat buoc

### ST-01 Dang nhap va dieu huong theo vai tro

Buoc kiem thu:

1. Dang nhap bang tung tai khoan demo.
2. Kiem tra menu hien thi dung theo vai tro.
3. Truy cap truc tiep route khong du quyen, vi du ky thuat vien vao `/users`.
4. Dang xuat va refresh trang.

Ket qua mong doi:

- Admin thay dashboard, phieu, khach hang, thanh toan, bao cao, thong bao, nhan vien.
- Dieu phoi thay cac man hinh van hanh, khong thay quan ly nhan vien admin.
- Ky thuat vien duoc dua ve `/technician`, chi thay cac man hinh can cho ky thuat.
- Ke toan thay thanh toan/bao cao/phieu lien quan, khong thay phan cong va nhan vien.
- Route khong du quyen bi chuyen ve trang phu hop.
- Dang xuat xoa session va quay ve man hinh dang nhap.

### ST-02 Tao phieu toi thieu va loc danh sach

Buoc kiem thu:

1. Dang nhap dieu phoi.
2. Tao phieu moi voi khach hang moi: ten, so dien thoai, dia chi, loai cong viec, muc do uu tien, mo ta.
3. Tao phieu voi khach hang cu.
4. Tao phieu thieu so dien thoai, thieu dia chi, thieu mo ta.
5. Loc theo ma phieu, ten khach, so dien thoai, trang thai, loai cong viec, ky thuat vien, ngay tao.

Ket qua mong doi:

- Phieu hop le duoc tao voi ma phieu moi, trang thai `pending_assignment` neu chua chon ky thuat vien.
- Neu tao kem ky thuat vien, phieu vao `assigned`.
- Khach hang moi xuat hien trong danh sach khach hang.
- Du lieu khong hop le bi tu choi voi thong bao ro.
- Bo loc tra ve dung ket qua va khong reload toan bo ung dung khi go tu khoa.

## 5. Luong E2E chinh

### FLOW-01 Khach goi -> tao phieu -> phan cong

Vai tro: Dieu phoi hoac admin.

Buoc kiem thu:

1. Tao phieu moi o `/orders` va khong chon ky thuat vien.
2. Mo chi tiet phieu, kiem tra thong tin khach, cong viec, lich su va thanh toan mac dinh.
3. Mo man hinh `/dispatch`, chon phieu can phan cong.
4. Gan mot ky thuat vien dang ranh, nhap ghi chu phan cong.
5. Doi sang mot ky thuat vien khac truoc khi hoan thanh.

Ket qua mong doi:

- Phieu ban dau co lich su `Tao phieu`.
- Sau khi gan, trang thai chuyen `assigned`, ky thuat vien hien dung tren danh sach phieu.
- Ky thuat vien nhan thong bao phieu moi.
- Doi ky thuat vien tao them lich su doi phu trach, khong tao trung phan cong dang hoat dong.
- Dashboard cap nhat so phieu cho phan cong va viec dang xu ly.

### FLOW-02 Ky thuat vien nhan viec -> di chuyen -> check-in -> thi cong

Vai tro: Ky thuat vien duoc gan phieu.

Buoc kiem thu:

1. Dang nhap ky thuat vien duoc gan.
2. Mo `/technician`, kiem tra chi thay phieu cua minh.
3. Mo chi tiet/sua phieu va bam lan luot: `Nhan viec`, `Dang di chuyen`, `Check-in`.
4. Khi trinh duyet hoi quyen vi tri, cho phep lay GPS.
5. Thu truy cap phieu khong duoc gan qua URL truc tiep.

Ket qua mong doi:

- Trang thai chuyen dung thu tu: `assigned -> accepted -> traveling -> working`.
- `Check-in` luu toa do neu trinh duyet tra ve vi tri.
- Moi buoc tao lich su trang thai voi nguoi thao tac.
- Admin/dieu phoi nhan thong bao khi phieu doi trang thai.
- Ky thuat vien khong doc/sua duoc phieu khong phai cua minh.

### FLOW-03 Cap nhat hien truong: anh, vat tu, chi phi, ghi chu

Vai tro: Ky thuat vien, dieu phoi hoac admin theo quyen.

Buoc kiem thu:

1. O phieu `working`, upload anh truoc xu ly voi purpose `before`.
2. Upload anh sau xu ly voi purpose `after`.
3. Thu upload khi khong chon file.
4. Them vat tu: ten, so luong, don gia.
5. Sua vat tu va xoa vat tu.
6. Cap nhat tien cong, VAT va ghi chu hoan thanh.

Ket qua mong doi:

- File hop le xuat hien trong tab tep/vat tu, co link xem neu storage ky duoc signed URL.
- Upload rong hoac qua gioi han dung luong bi tu choi.
- Thanh tien vat tu tu tinh theo `quantity * unitPrice`.
- Tong thanh toan cap nhat theo tien cong + vat tu + VAT.
- Sau moi thay doi, detail/list lien quan cap nhat, khong can dong mo modal thu cong.

### FLOW-04 Hoan tat xu ly -> nghiem thu

Vai tro: Ky thuat vien duoc gan, admin/dieu phoi khi co quyen.

Buoc kiem thu:

1. Tu trang thai `working`, bam `Hoan tat xu ly`.
2. Kiem tra phieu sang `awaiting_acceptance`.
3. Mo form ky nghiem thu.
4. Bo trong ten nguoi ky va gui.
5. Ve chu ky, tick dong y, gui nghiem thu.
6. Mo chi tiet phieu va link bien ban `/api/work-orders/:id/receipt`.

Ket qua mong doi:

- Chi cho ky khi phieu dang `awaiting_acceptance`.
- Thieu ten nguoi ky hoac thieu chu ky bi tu choi.
- Ky thanh cong luu ten/so dien thoai nguoi nghiem thu, file chu ky purpose `signature`, thoi gian nghiem thu.
- Trang thai chuyen `completed`.
- Bien ban hien thong tin phieu, khach hang, vat tu, tong tien, trang thai va nguoi nghiem thu.
- Non-admin khong xoa duoc file chu ky sau khi da ky.

### FLOW-05 Hoan thanh -> cho thanh toan -> da thanh toan

Vai tro: Dieu phoi, ke toan hoac admin.

Buoc kiem thu:

1. Tu phieu `completed`, chuyen sang `awaiting_payment`.
2. O man hinh `/payments`, mo chi tiet thanh toan.
3. Chon `paid` nhung khong chon phuong thuc thanh toan.
4. Chon `paid`, phuong thuc `cash` hoac `bank_transfer`, nhap ma giao dich neu co.
5. Kiem tra dashboard, bao cao va danh sach phieu.

Ket qua mong doi:

- Ke toan/admin/dieu phoi moi thay hanh dong thanh toan.
- Thieu phuong thuc khi `paid` bi tu choi.
- Thanh toan hop le cap nhat payment status va trang thai phieu thanh `paid`.
- He thong luu nguoi xac nhan, thoi gian xac nhan, phuong thuc va ma giao dich.
- Doanh thu da thu trong dashboard/bao cao tang dung so tien.

### FLOW-06 Hoan thanh -> cong no

Vai tro: Dieu phoi, ke toan hoac admin.

Buoc kiem thu:

1. Tao hoac dung mot phieu da `completed`.
2. Chuyen sang `awaiting_payment`.
3. Chon payment status `debt` nhung khong nhap ghi chu va khong nhap ngay hen.
4. Nhap ngay hen tra tien hoac ghi chu cong no, gui lai.
5. Loc man hinh thanh toan theo cong no va xem bao cao.

Ket qua mong doi:

- Cong no thieu ca ghi chu lan ngay hen bi tu choi.
- Cong no hop le cap nhat phieu thanh `debt`.
- Tong cong no mo tren dashboard/bao cao tang dung.
- Danh sach thanh toan loc duoc phieu cong no.

### FLOW-07 Huy phieu

Vai tro: Admin hoac dieu phoi.

Buoc kiem thu:

1. Tao phieu moi.
2. Thu huy phieu ma khong nhap ly do.
3. Nhap ly do va xac nhan huy.
4. Dang nhap ky thuat vien/ke toan va thu goi API hoac thao tac huy.
5. Thu phan cong lai phieu da `cancelled`.

Ket qua mong doi:

- Khong co ly do thi khong huy duoc.
- Huy hop le chuyen trang thai `cancelled`, luu ly do trong lich su.
- Ky thuat vien/ke toan khong huy duoc.
- Phieu da huy khong cho phan cong lai hoac thuc hien tiep cac buoc hien truong.

## 6. Luong quan tri du lieu

### ADM-01 Quan ly nhan vien

Vai tro: Admin.

Buoc kiem thu:

1. Tao nhan vien vai tro admin/dieu phoi/ke toan.
2. Tao nhan vien vai tro ky thuat vien va nhap khu vuc phu trach.
3. Thu tao user voi email sai dinh dang hoac mat khau duoi 8 ky tu.
4. Sua thong tin nhan vien.
5. Ngung hoat dong nhan vien.

Ket qua mong doi:

- User hop le xuat hien trong danh sach nhan vien.
- User ky thuat vien tao kem ho so technician.
- Du lieu sai bi tu choi.
- Ngung hoat dong khong xoa cung user, va user inactive khong dang nhap duoc.

### ADM-02 Quan ly khach hang

Vai tro: Admin, dieu phoi, ke toan theo quyen hien thi.

Buoc kiem thu:

1. Tao khach hang moi.
2. Sua ten, so dien thoai, dia chi.
3. Mo chi tiet khach hang, xem tab thong tin, phieu, thanh toan.
4. Xoa khach hang chua co phieu.
5. Thu xoa khach hang da co phieu.

Ket qua mong doi:

- Sua khach hang cap nhat ca cac dong phieu dang hien thi lien quan.
- Chi tiet khach hang dung ID quan he, khong suy luan sai theo ten/so dien thoai.
- Khach hang da co phieu bi API tu choi xoa neu co rang buoc du lieu.

### ADM-03 Quan ly ky thuat vien

Vai tro: Dieu phoi.

Buoc kiem thu:

1. Xem danh sach ky thuat vien, trang thai, khu vuc, so viec trong ngay.
2. Sua khu vuc phu trach va trang thai.
3. Xoa ho so ky thuat vien chua co phan cong.
4. Thu xoa ky thuat vien dang co phieu active.

Ket qua mong doi:

- Danh sach cap nhat sau sua.
- Xoa ky thuat vien dang co phan cong active bi tu choi.
- Man hinh phan cong va danh sach phieu phan anh trang thai moi.

## 7. Kiem thu bao cao va thong bao

### REP-01 Bao cao theo khoang ngay

Buoc kiem thu:

1. Tao cac phieu o nhieu trang thai: dang thi cong, da thanh toan, cong no.
2. Mo `/reports`, chon khoang ngay hom nay.
3. Doi khoang ngay khong co du lieu.

Ket qua mong doi:

- Bao cao hien so phieu, doanh thu da thu, cong no, tong gia tri.
- Thong ke theo trang thai va ky thuat vien dung voi du lieu vua tao.
- Danh sach vat tu gom dung so luong va tong tien.
- Khoang ngay khong co du lieu hien trang thai rong ro rang.

### NOTI-01 Thong bao

Buoc kiem thu:

1. Dieu phoi gan phieu cho ky thuat vien.
2. Ky thuat vien doi trang thai phieu.
3. Ke toan xac nhan thanh toan.
4. Mo `/notifications` va danh dau da doc.

Ket qua mong doi:

- Nguoi lien quan nhan thong bao dung noi dung.
- Badge so thong bao chua doc cap nhat.
- Danh dau da doc giu thong bao trong danh sach nhung khong tinh vao unread.
- Bam thong bao lien ket dung phieu neu co `work_order_id`.

## 8. Kiem thu API va phan quyen toi thieu

Can test truc tiep bang UI hoac request API:

- Chua dang nhap goi API du lieu phai bi tu choi.
- Ky thuat vien chi doc/mutate phieu duoc gan.
- `POST /api/work-orders` chi admin/dieu phoi duoc tao phieu.
- `POST /api/work-orders/:id/assign` chi admin/dieu phoi duoc phan cong.
- `POST /api/work-orders/:id/status` khong cho chuyen thang sang `paid`/`debt`; bat buoc qua payment API.
- `PATCH /api/work-orders/:id/payment` chi admin/dieu phoi/ke toan duoc cap nhat.
- `POST /api/work-orders/:id/acceptance` chi thanh cong khi trang thai la `awaiting_acceptance`.
- File chu ky hoac file cua phieu da khoa khong duoc xoa boi non-admin.
- Cac loi 403, 404, 409/422 neu co phai tra message ngan gon, dung nghia.

## 9. Kiem thu UI/UX theo luong

Can xac nhan tren desktop va mobile:

- Man hinh danh sach uu tien loc, tom tat, bang/list va nut hanh dong ro.
- Hanh dong dong phieu tach bach: xem, sua, phan cong, thanh toan, huy.
- Modal xem la read-only; modal sua moi co form chinh sua.
- Form tao/sua chia nhom thong tin khach hang, cong viec, phan cong, chi phi, tep/vat tu, thanh toan.
- Nut hanh dong tiep theo phu hop vai tro va trang thai hien tai.
- Man hinh ky nghiem thu khong hien ghi chu noi bo.
- Ky thuat vien thao tac duoc tren dien thoai: xem dia chi, goi khach, cap nhat trang thai, upload, ky.
- Cac nut, nhan trang thai, filter va modal khong bi vo layout tren mobile.

## 10. Tieu chi pass/fail ban giao

Dat ban giao khi:

- Tat ca smoke test pass.
- Cac flow `FLOW-01` den `FLOW-07` pass tren mock mode.
- Khong co loi phan quyen nghiem trong: doc/sua du lieu sai vai tro, thanh toan/huy/phieu sai quyen.
- Tong tien, VAT, vat tu, doanh thu va cong no tinh dung sau khi tao/sua/xoa vat tu va cap nhat thanh toan.
- Lich su trang thai day du cho cac moc tao, phan cong, nhan viec, di chuyen, check-in, cho nghiem thu, nghiem thu, thanh toan/cong no, huy.
- Receipt mo duoc sau nghiem thu.
- `npm run lint` va `npm run build` pass.

Khong dat ban giao neu co mot trong cac loi sau:

- Ky thuat vien xem hoac sua duoc phieu khong duoc gan.
- Co the chuyen trang thai sai thu tu gay bo qua nghiem thu hoac thanh toan.
- Co the danh dau da thanh toan khi thieu phuong thuc.
- Co the tao cong no khi thieu ca ghi chu va ngay hen.
- Mat du lieu chi phi/vat tu/chu ky sau refresh.
- Dashboard, danh sach phieu hoac bao cao hien sai so lieu sau thao tac thanh toan/cong no.
