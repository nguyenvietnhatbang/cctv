import { requireUser } from "@/lib/auth";
import { query } from "@/lib/db";
import { handleRouteError } from "@/lib/http";
import { dateTime, escapeHtml, money, printDocumentResponse } from "@/lib/print-documents";
import { WORK_ORDER_STATUS_LABELS } from "@/lib/types";

export const runtime = "nodejs";

type Context = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: Request, context: Context) {
  try {
    await requireUser(["admin", "dispatcher", "team_lead", "accountant"]);
    const { id } = await context.params;

    const [customerResult, debtResult] = await Promise.all([
      query(
        `select id, name, phone, address, address_note
         from customers
         where id = $1`,
        [id],
      ),
      query(
        `with debt_orders as (
           select wo.id, wo.code, wo.status, wo.description, wo.appointment_at, wo.updated_at,
                  coalesce(p.total_amount, 0) as total_amount,
                  coalesce(p.paid_amount, 0) as paid_amount,
                  case
                    when p.status = 'debt' then coalesce(p.debt_amount, 0)
                    when p.status = 'paid' then 0
                    else greatest(coalesce(p.total_amount, 0) - coalesce(p.paid_amount, 0), 0)
                  end as debt_amount
           from work_orders wo
           left join payments p on p.work_order_id = wo.id
           where wo.customer_id = $1 and wo.status <> 'cancelled'
         )
         select *
         from debt_orders
         where debt_amount > 0
         order by appointment_at nulls last, updated_at desc`,
        [id],
      ),
    ]);

    const customer = customerResult.rows[0];
    if (!customer) {
      return new Response("Không tìm thấy khách hàng", { status: 404 });
    }

    const totalAmount = debtResult.rows.reduce((sum, item) => sum + Number(item.total_amount ?? 0), 0);
    const paidAmount = debtResult.rows.reduce((sum, item) => sum + Number(item.paid_amount ?? 0), 0);
    const debtAmount = debtResult.rows.reduce((sum, item) => sum + Number(item.debt_amount ?? 0), 0);

    const debtRows = debtResult.rows
      .map(
        (item, index) => `<tr>
          <td class="center">${index + 1}</td>
          <td>${escapeHtml(item.code)}</td>
          <td>${escapeHtml(WORK_ORDER_STATUS_LABELS[item.status as keyof typeof WORK_ORDER_STATUS_LABELS])}</td>
          <td>${escapeHtml(dateTime(item.appointment_at))}</td>
          <td>${escapeHtml(item.description)}</td>
          <td class="right">${money(item.total_amount)}</td>
          <td class="right">${money(item.paid_amount)}</td>
          <td class="right">${money(item.debt_amount)}</td>
        </tr>`,
      )
      .join("");

    return printDocumentResponse({
      title: `Phiếu báo công nợ ${customer.name}`,
      documentTitle: "Phiếu báo công nợ khách hàng",
      documentCode: `Khách hàng: ${customer.name}`,
      footer: "Phiếu báo công nợ gồm các phần: thông tin doanh nghiệp, thông tin khách hàng, danh sách phiếu còn nợ, tổng hợp công nợ và xác nhận đối chiếu.",
      sections: `
        <section class="section">
          <div class="section-title">1. Thông tin khách hàng</div>
          <div class="section-body info-grid">
            <div class="info-item"><span>Khách hàng</span><strong>${escapeHtml(customer.name)}</strong></div>
            <div class="info-item"><span>Số điện thoại</span><strong>${escapeHtml(customer.phone)}</strong></div>
            <div class="info-item full"><span>Địa chỉ</span><p>${escapeHtml(customer.address)}</p></div>
            <div class="info-item full"><span>Ghi chú địa chỉ</span><p>${escapeHtml(customer.address_note)}</p></div>
          </div>
        </section>

        <section class="section">
          <div class="section-title">2. Danh sách phiếu còn công nợ</div>
          <div class="section-body">
            <div class="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th class="center" style="width: 44px;">STT</th>
                    <th>Mã phiếu</th>
                    <th>Trạng thái</th>
                    <th>Ngày hẹn</th>
                    <th>Nội dung</th>
                    <th class="right">Tổng tiền</th>
                    <th class="right">Đã thu</th>
                    <th class="right">Còn nợ</th>
                  </tr>
                </thead>
                <tbody>${debtRows || "<tr><td colspan='8' class='center'>Không có công nợ cần báo</td></tr>"}</tbody>
              </table>
            </div>
            <table class="totals">
              <tbody>
                <tr><td>Tổng phát sinh</td><td class="right">${money(totalAmount)}</td></tr>
                <tr><td>Tổng đã thu</td><td class="right">${money(paidAmount)}</td></tr>
                <tr class="grand"><td>Tổng công nợ</td><td class="right">${money(debtAmount)}</td></tr>
              </tbody>
            </table>
          </div>
        </section>

        <section class="section">
          <div class="section-title">3. Ghi chú đối chiếu</div>
          <div class="section-body">
            <div class="note-box">Đề nghị quý khách kiểm tra và xác nhận số công nợ nêu trên. Nếu có sai lệch, vui lòng phản hồi để An Việt Tech đối chiếu và cập nhật.</div>
          </div>
        </section>

        <div class="signature">
          <div><p>Đại diện An Việt Tech</p><small>Ký và ghi rõ họ tên</small><div class="signature-line">________________________</div></div>
          <div><p>Đại diện khách hàng</p><small>Ký và ghi rõ họ tên</small><div class="signature-line">________________________</div></div>
        </div>
      `,
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
