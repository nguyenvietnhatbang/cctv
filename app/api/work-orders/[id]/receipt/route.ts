import { requireUser } from "@/lib/auth";
import { brandAssets, companyProfile } from "@/lib/company";
import { query } from "@/lib/db";
import { handleRouteError } from "@/lib/http";
import { WORK_ORDER_STATUS_LABELS, WORK_ORDER_TYPE_LABELS } from "@/lib/types";
import { assertCanReadWorkOrder } from "@/lib/work-orders";

export const runtime = "nodejs";

type Context = {
  params: Promise<{ id: string }>;
};

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function money(value: unknown) {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(Number(value ?? 0));
}

function dateTime(value: unknown) {
  if (!value) return "";
  return new Intl.DateTimeFormat("vi-VN", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(String(value)));
}

export async function GET(_request: Request, context: Context) {
  try {
    const user = await requireUser();
    const { id } = await context.params;

    await assertCanReadWorkOrder(user, id);

    const [orderResult, materialsResult, techniciansResult] = await Promise.all([
      query(
        `select wo.*, c.name as customer_name, c.phone as customer_phone, c.address as customer_address,
                p.material_amount, p.labor_amount, p.vat_amount, p.total_amount, p.paid_amount,
                case
                  when p.status = 'debt' then coalesce(p.debt_amount, 0)
                  when p.status = 'paid' then 0
                  else greatest(coalesce(p.total_amount, 0) - coalesce(p.paid_amount, 0), 0)
                end as debt_amount
         from work_orders wo
         join customers c on c.id = wo.customer_id
         left join payments p on p.work_order_id = wo.id
         where wo.id = $1`,
        [id],
      ),
      query(
        `select name, quantity, unit_price, line_total
         from work_order_materials
         where work_order_id = $1
         order by created_at`,
        [id],
      ),
      query(
        `select u.full_name, u.phone
         from work_order_assignments woa
         join technicians t on t.id = woa.technician_id
         join users u on u.id = t.user_id
         where woa.work_order_id = $1 and woa.unassigned_at is null
         order by woa.assigned_at`,
        [id],
      ),
    ]);

    const order = orderResult.rows[0];
    if (!order) {
      return new Response("Không tìm thấy phiếu", { status: 404 });
    }

    const materialRows = materialsResult.rows
      .map(
        (item, index) => `<tr><td class="center">${index + 1}</td><td>${escapeHtml(item.name)}</td><td class="right">${escapeHtml(item.quantity)}</td><td class="right">${money(
          item.unit_price,
        )}</td><td class="right">${money(item.line_total)}</td></tr>`,
      )
      .join("");
    const technicianNames = techniciansResult.rows.length
      ? techniciansResult.rows.map((technician) => `${technician.full_name}${technician.phone ? ` (${technician.phone})` : ""}`).join(", ")
      : "Chưa phân công";
    const logoSrc = encodeURI(brandAssets.fullLogo);

    return new Response(
      `<!doctype html>
      <html lang="vi">
        <head>
          <meta charset="utf-8" />
          <title>Biên bản nghiệm thu ${escapeHtml(order.code)}</title>
          <style>
            @page { size: A4; margin: 16mm; }
            * { box-sizing: border-box; }
            body { font-family: Arial, sans-serif; margin: 0; color: #111827; background: #f1f5f9; }
            .page { max-width: 210mm; min-height: 297mm; margin: 0 auto; background: #ffffff; padding: 18mm; }
            .print-actions { max-width: 210mm; margin: 16px auto; display: flex; justify-content: flex-end; }
            button { border: 1px solid #1d4ed8; border-radius: 6px; background: #2563eb; color: #ffffff; padding: 10px 14px; font-weight: 700; cursor: pointer; }
            header { display: grid; grid-template-columns: 170px 1fr; gap: 20px; align-items: center; border-bottom: 2px solid #1d4ed8; padding-bottom: 14px; }
            .logo { width: 160px; max-height: 75px; object-fit: contain; }
            .company h2 { margin: 0 0 8px; font-size: 16px; color: #0f172a; text-transform: uppercase; }
            .company p { margin: 3px 0; font-size: 11px; line-height: 1.4; color: #475569; }
            h1 { margin: 22px 0 6px; text-align: center; font-size: 22px; letter-spacing: .02em; text-transform: uppercase; }
            .receipt-code { text-align: center; color: #475569; font-size: 12px; margin-bottom: 18px; }
            .section { margin-top: 16px; border: 1px solid #dbeafe; border-radius: 8px; overflow: hidden; break-inside: avoid; }
            .section-title { background: #eff6ff; border-bottom: 1px solid #dbeafe; padding: 8px 10px; font-size: 12px; font-weight: 800; color: #1e3a8a; text-transform: uppercase; }
            .section-body { padding: 10px; }
            .info-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px 16px; }
            .info-item span { display: block; color: #64748b; font-size: 10px; font-weight: 700; text-transform: uppercase; }
            .info-item strong, .info-item p { margin: 3px 0 0; font-size: 12px; color: #111827; line-height: 1.45; }
            table { width: 100%; border-collapse: collapse; }
            th, td { border: 1px solid #e5e7eb; padding: 8px; font-size: 11px; text-align: left; vertical-align: top; }
            th { background: #f8fafc; font-weight: 800; color: #334155; }
            .right { text-align: right; }
            .center { text-align: center; }
            .totals { margin-left: auto; width: 330px; }
            .totals td { border: 0; border-bottom: 1px solid #e5e7eb; font-size: 12px; }
            .totals .grand td { font-size: 15px; font-weight: 800; color: #1d4ed8; }
            .note-box { min-height: 70px; white-space: pre-wrap; line-height: 1.5; }
            .signature { margin-top: 28px; display: grid; grid-template-columns: 1fr 1fr; gap: 70px; text-align: center; break-inside: avoid; }
            .signature p { margin: 0; font-size: 12px; font-weight: 800; text-transform: uppercase; }
            .signature small { display: block; margin-top: 4px; color: #64748b; }
            .signature-line { margin-top: 70px; font-weight: 800; }
            footer { margin-top: 24px; border-top: 1px solid #e5e7eb; padding-top: 8px; font-size: 10px; color: #64748b; text-align: center; }
            @media print {
              body { background: #ffffff; }
              .print-actions { display: none; }
              .page { padding: 0; max-width: none; min-height: auto; }
            }
          </style>
        </head>
        <body>
          <div class="print-actions">
            <button onclick="window.print()">In / Lưu PDF</button>
          </div>
          <main class="page">
            <header>
              <img class="logo" src="${logoSrc}" alt="${escapeHtml(companyProfile.legalName)}" />
              <div class="company">
                <h2>${escapeHtml(companyProfile.legalName)}</h2>
                <p><strong>Mã số thuế:</strong> ${escapeHtml(companyProfile.taxCode)} - <strong>Website:</strong> ${escapeHtml(companyProfile.website)}</p>
                <p><strong>Văn phòng:</strong> ${escapeHtml(companyProfile.officeAddress)}</p>
                <p><strong>Điện thoại:</strong> ${escapeHtml(companyProfile.consultationPhone)} - <strong>Hỗ trợ kỹ thuật:</strong> ${escapeHtml(companyProfile.technicalSupportPhone)} - <strong>Email:</strong> ${escapeHtml(companyProfile.email)}</p>
              </div>
            </header>

            <h1>Biên bản nghiệm thu công việc</h1>
            <div class="receipt-code">Mã phiếu: <strong>${escapeHtml(order.code)}</strong> - Ngày in: ${dateTime(new Date().toISOString())}</div>

            <section class="section">
              <div class="section-title">1. Thông tin phiếu</div>
              <div class="section-body info-grid">
                <div class="info-item"><span>Loại việc</span><strong>${escapeHtml(WORK_ORDER_TYPE_LABELS[order.type as keyof typeof WORK_ORDER_TYPE_LABELS])}</strong></div>
                <div class="info-item"><span>Trạng thái</span><strong>${escapeHtml(WORK_ORDER_STATUS_LABELS[order.status as keyof typeof WORK_ORDER_STATUS_LABELS])}</strong></div>
                <div class="info-item"><span>Ngày hẹn</span><strong>${escapeHtml(dateTime(order.appointment_at))}</strong></div>
                <div class="info-item"><span>Kỹ thuật viên</span><strong>${escapeHtml(technicianNames)}</strong></div>
              </div>
            </section>

            <section class="section">
              <div class="section-title">2. Thông tin khách hàng</div>
              <div class="section-body info-grid">
                <div class="info-item"><span>Khách hàng</span><strong>${escapeHtml(order.customer_name)}</strong></div>
                <div class="info-item"><span>Số điện thoại</span><strong>${escapeHtml(order.customer_phone)}</strong></div>
                <div class="info-item" style="grid-column: 1 / -1;"><span>Địa chỉ thi công</span><p>${escapeHtml(order.customer_address)}</p></div>
              </div>
            </section>

            <section class="section">
              <div class="section-title">3. Nội dung công việc cần nghiệm thu</div>
              <div class="section-body">
                <div class="note-box">${escapeHtml(order.description)}</div>
              </div>
            </section>

            <section class="section">
              <div class="section-title">4. Vật tư và chi phí</div>
              <div class="section-body">
                <table>
                  <thead>
                    <tr>
                      <th class="center" style="width: 44px;">STT</th>
                      <th>Vật tư</th>
                      <th class="right" style="width: 80px;">Số lượng</th>
                      <th class="right" style="width: 120px;">Đơn giá</th>
                      <th class="right" style="width: 130px;">Thành tiền</th>
                    </tr>
                  </thead>
                  <tbody>${materialRows || "<tr><td colspan='5' class='center'>Không có vật tư</td></tr>"}</tbody>
                </table>
                <table class="totals">
                  <tbody>
                    <tr><td>Tiền vật tư</td><td class="right">${money(order.material_amount)}</td></tr>
                    <tr><td>Nhân công</td><td class="right">${money(order.labor_amount)}</td></tr>
                    <tr><td>VAT</td><td class="right">${money(order.vat_amount)}</td></tr>
                    <tr class="grand"><td>Tổng tiền</td><td class="right">${money(order.total_amount)}</td></tr>
                    <tr><td>Đã thu</td><td class="right">${money(order.paid_amount)}</td></tr>
                    <tr><td>Còn lại</td><td class="right">${money(order.debt_amount)}</td></tr>
                  </tbody>
                </table>
              </div>
            </section>

            <section class="section">
              <div class="section-title">5. Xác nhận nghiệm thu</div>
              <div class="section-body info-grid">
                <div class="info-item"><span>Người nghiệm thu</span><strong>${escapeHtml(order.acceptance_name)}</strong></div>
                <div class="info-item"><span>Số điện thoại nghiệm thu</span><strong>${escapeHtml(order.acceptance_phone)}</strong></div>
                <div class="info-item"><span>Thời điểm nghiệm thu</span><strong>${escapeHtml(dateTime(order.accepted_at))}</strong></div>
                <div class="info-item"><span>Ghi chú hoàn thành</span><p>${escapeHtml(order.completion_note)}</p></div>
              </div>
            </section>

            <div class="signature">
              <div>
                <p>Đại diện ${escapeHtml(companyProfile.displayName)}</p>
                <small>Ký và ghi rõ họ tên</small>
                <div class="signature-line">________________________</div>
              </div>
              <div>
                <p>Đại diện khách hàng</p>
                <small>Ký và ghi rõ họ tên</small>
                <div class="signature-line">${escapeHtml(order.acceptance_name) || "________________________"}</div>
              </div>
            </div>

            <footer>
              Phiếu in gồm các phần: thông tin doanh nghiệp, thông tin phiếu, khách hàng, nội dung công việc, vật tư/chi phí, nghiệm thu và chữ ký.
            </footer>
          </main>
        </body>
      </html>`,
      { headers: { "content-type": "text/html; charset=utf-8" } },
    );
  } catch (error) {
    return handleRouteError(error);
  }
}
