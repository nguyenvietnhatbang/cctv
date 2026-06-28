import { requireUser } from "@/lib/auth";
import { query } from "@/lib/db";
import { handleRouteError } from "@/lib/http";
import { dateTime, escapeHtml, money, printDocumentResponse } from "@/lib/print-documents";
import { parseUuidParam } from "@/lib/route-params";
import { WORK_ORDER_STATUS_LABELS } from "@/lib/types";
import { assertCanReadWorkOrder } from "@/lib/work-orders";

export const runtime = "nodejs";

type Context = {
  params: Promise<{ id: string }>;
};

const PAYMENT_STATUS_LABELS: Record<string, string> = {
  unpaid: "Chưa thanh toán",
  paid: "Đã thanh toán",
  debt: "Công nợ",
};

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  cash: "Tiền mặt",
  bank_transfer: "Chuyển khoản",
  debt: "Công nợ",
};

export async function GET(_request: Request, context: Context) {
  try {
    const user = await requireUser();
    const { id: rawId } = await context.params;
    const id = parseUuidParam(rawId, "Phiếu không hợp lệ");

    await assertCanReadWorkOrder(user, id);

    const [orderResult, transactionsResult] = await Promise.all([
      query(
        `select wo.id, wo.code, wo.status, wo.description, wo.appointment_at,
                c.name as customer_name, c.phone as customer_phone, c.address as customer_address,
                coalesce(p.material_amount, 0) as material_amount,
                coalesce(p.labor_amount, wo.labor_cost, 0) as labor_amount,
                coalesce(p.vat_amount, 0) as vat_amount,
                coalesce(p.total_amount, 0) as total_amount,
                coalesce(p.paid_amount, 0) as paid_amount,
                case
                  when p.status = 'debt' then coalesce(p.debt_amount, 0)
                  when p.status = 'paid' then 0
                  else greatest(coalesce(p.total_amount, 0) - coalesce(p.paid_amount, 0), 0)
                end as debt_amount,
                p.status as payment_status, p.method, p.transaction_ref, p.note, p.confirmed_at,
                u.full_name as confirmed_by_name
         from work_orders wo
         join customers c on c.id = wo.customer_id
         left join payments p on p.work_order_id = wo.id
         left join users u on u.id = p.confirmed_by
         where wo.id = $1`,
        [id],
      ),
      query(
        `select pt.amount, pt.method, pt.transaction_ref, pt.note, pt.collected_at,
                u.full_name as collected_by_name
         from payment_transactions pt
         left join users u on u.id = pt.collected_by
         where pt.work_order_id = $1
         order by pt.collected_at desc`,
        [id],
      ),
    ]);

    const order = orderResult.rows[0];
    if (!order) {
      return new Response("Không tìm thấy phiếu", { status: 404 });
    }

    const transactionRows = transactionsResult.rows
      .map(
        (item, index) => `<tr>
          <td class="center">${index + 1}</td>
          <td>${escapeHtml(dateTime(item.collected_at))}</td>
          <td>${escapeHtml(PAYMENT_METHOD_LABELS[item.method] ?? item.method)}</td>
          <td>${escapeHtml(item.transaction_ref)}</td>
          <td>${escapeHtml(item.collected_by_name)}</td>
          <td class="right">${money(item.amount)}</td>
          <td>${escapeHtml(item.note)}</td>
        </tr>`,
      )
      .join("");

    return printDocumentResponse({
      title: `Phiếu thu ${order.code}`,
      documentTitle: "Phiếu thu / xác nhận thanh toán",
      documentCode: `Mã phiếu: ${order.code}`,
      footer: "Phiếu thu gồm các phần: thông tin doanh nghiệp, khách hàng, công việc, số tiền thanh toán, lịch sử giao dịch và chữ ký xác nhận.",
      sections: `
        <section class="section">
          <div class="section-title">1. Thông tin khách hàng và công việc</div>
          <div class="section-body info-grid">
            <div class="info-item"><span>Khách hàng</span><strong>${escapeHtml(order.customer_name)}</strong></div>
            <div class="info-item"><span>Số điện thoại</span><strong>${escapeHtml(order.customer_phone)}</strong></div>
            <div class="info-item full"><span>Địa chỉ</span><p>${escapeHtml(order.customer_address)}</p></div>
            <div class="info-item"><span>Trạng thái công việc</span><strong>${escapeHtml(WORK_ORDER_STATUS_LABELS[order.status as keyof typeof WORK_ORDER_STATUS_LABELS])}</strong></div>
            <div class="info-item"><span>Lịch hẹn</span><strong>${escapeHtml(dateTime(order.appointment_at))}</strong></div>
            <div class="info-item full"><span>Nội dung công việc</span><p>${escapeHtml(order.description)}</p></div>
          </div>
        </section>

        <section class="section">
          <div class="section-title">2. Xác nhận thanh toán</div>
          <div class="section-body info-grid">
            <div class="info-item"><span>Trạng thái thanh toán</span><strong>${escapeHtml(PAYMENT_STATUS_LABELS[order.payment_status] ?? "Chưa thanh toán")}</strong></div>
            <div class="info-item"><span>Phương thức</span><strong>${escapeHtml(PAYMENT_METHOD_LABELS[order.method] ?? "")}</strong></div>
            <div class="info-item"><span>Mã giao dịch</span><strong>${escapeHtml(order.transaction_ref)}</strong></div>
            <div class="info-item"><span>Người xác nhận</span><strong>${escapeHtml(order.confirmed_by_name)}</strong></div>
            <div class="info-item"><span>Thời điểm xác nhận</span><strong>${escapeHtml(dateTime(order.confirmed_at))}</strong></div>
            <div class="info-item full"><span>Ghi chú thanh toán</span><p>${escapeHtml(order.note)}</p></div>
          </div>
        </section>

        <section class="section">
          <div class="section-title">3. Số tiền</div>
          <div class="section-body">
            <table class="totals">
              <tbody>
                <tr><td>Chi phí vật tư đã chốt</td><td class="right">${money(order.material_amount)}</td></tr>
                <tr><td>Nhân công / dịch vụ</td><td class="right">${money(order.labor_amount)}</td></tr>
                <tr><td>VAT</td><td class="right">${money(order.vat_amount)}</td></tr>
                <tr class="grand"><td>Tổng phải thu</td><td class="right">${money(order.total_amount)}</td></tr>
                <tr><td>Đã thu</td><td class="right">${money(order.paid_amount)}</td></tr>
                <tr><td>Còn nợ</td><td class="right">${money(order.debt_amount)}</td></tr>
              </tbody>
            </table>
          </div>
        </section>

        <section class="section">
          <div class="section-title">4. Lịch sử giao dịch</div>
          <div class="section-body">
            <div class="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th class="center" style="width: 44px;">STT</th>
                    <th>Thời điểm</th>
                    <th>Phương thức</th>
                    <th>Mã giao dịch</th>
                    <th>Người thu</th>
                    <th class="right">Số tiền</th>
                    <th>Ghi chú</th>
                  </tr>
                </thead>
                <tbody>${transactionRows || "<tr><td colspan='7' class='center'>Chưa có giao dịch thu tiền</td></tr>"}</tbody>
              </table>
            </div>
          </div>
        </section>

        <div class="signature">
          <div><p>Người thu tiền</p><small>Ký và ghi rõ họ tên</small><div class="signature-line">________________________</div></div>
          <div><p>Người nộp tiền / khách hàng</p><small>Ký và ghi rõ họ tên</small><div class="signature-line">________________________</div></div>
        </div>
      `,
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
