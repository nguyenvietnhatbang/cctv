import { requireUser } from "@/lib/auth";
import { query } from "@/lib/db";
import { handleRouteError } from "@/lib/http";
import { dateTime, escapeHtml, money, printDocumentResponse } from "@/lib/print-documents";
import { WORK_ORDER_STATUS_LABELS, WORK_ORDER_TYPE_LABELS } from "@/lib/types";
import { assertCanReadWorkOrder } from "@/lib/work-orders";

export const runtime = "nodejs";

type Context = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: Request, context: Context) {
  try {
    const user = await requireUser();
    const { id } = await context.params;

    await assertCanReadWorkOrder(user, id);

    const [orderResult, materialsResult] = await Promise.all([
      query(
        `select wo.id, wo.code, wo.type, wo.priority, wo.status, wo.description, wo.appointment_at,
                c.name as customer_name, c.phone as customer_phone, c.address as customer_address,
                coalesce(p.material_amount, 0) as material_amount,
                coalesce(p.labor_amount, wo.labor_cost, 0) as labor_amount,
                coalesce(p.vat_amount, 0) as vat_amount,
                coalesce(p.total_amount, 0) as total_amount
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
    ]);

    const order = orderResult.rows[0];
    if (!order) {
      return new Response("Không tìm thấy phiếu", { status: 404 });
    }

    const materialRows = materialsResult.rows
      .map(
        (item, index) => `<tr>
          <td class="center">${index + 1}</td>
          <td>${escapeHtml(item.name)}</td>
          <td class="right">${escapeHtml(item.quantity)}</td>
          <td class="right">${money(item.unit_price)}</td>
          <td class="right">${money(item.line_total)}</td>
        </tr>`,
      )
      .join("");

    return printDocumentResponse({
      title: `Phiếu báo giá ${order.code}`,
      documentTitle: "Phiếu báo giá",
      documentCode: `Mã phiếu: ${order.code}`,
      footer: "Phiếu báo giá gồm các phần: thông tin doanh nghiệp, khách hàng, yêu cầu công việc, hạng mục chi phí, tổng tiền và xác nhận.",
      sections: `
        <section class="section">
          <div class="section-title">1. Thông tin khách hàng và yêu cầu</div>
          <div class="section-body info-grid">
            <div class="info-item"><span>Khách hàng</span><strong>${escapeHtml(order.customer_name)}</strong></div>
            <div class="info-item"><span>Số điện thoại</span><strong>${escapeHtml(order.customer_phone)}</strong></div>
            <div class="info-item full"><span>Địa chỉ</span><p>${escapeHtml(order.customer_address)}</p></div>
            <div class="info-item"><span>Loại việc</span><strong>${escapeHtml(WORK_ORDER_TYPE_LABELS[order.type as keyof typeof WORK_ORDER_TYPE_LABELS])}</strong></div>
            <div class="info-item"><span>Lịch hẹn dự kiến</span><strong>${escapeHtml(dateTime(order.appointment_at))}</strong></div>
            <div class="info-item"><span>Mức ưu tiên</span><strong>${order.priority === "urgent" ? "Gấp" : "Bình thường"}</strong></div>
            <div class="info-item"><span>Trạng thái phiếu</span><strong>${escapeHtml(WORK_ORDER_STATUS_LABELS[order.status as keyof typeof WORK_ORDER_STATUS_LABELS])}</strong></div>
            <div class="info-item full"><span>Mô tả yêu cầu</span><p>${escapeHtml(order.description)}</p></div>
          </div>
        </section>

        <section class="section">
          <div class="section-title">2. Hạng mục báo giá</div>
          <div class="section-body">
            <div class="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th class="center" style="width: 44px;">STT</th>
                    <th>Hạng mục / vật tư</th>
                    <th class="right" style="width: 80px;">Số lượng</th>
                    <th class="right" style="width: 120px;">Đơn giá</th>
                    <th class="right" style="width: 130px;">Thành tiền</th>
                  </tr>
                </thead>
                <tbody>${materialRows || "<tr><td colspan='5' class='center'>Chưa có vật tư trong báo giá</td></tr>"}</tbody>
              </table>
            </div>
            <table class="totals">
              <tbody>
                <tr><td>Chi phí vật tư đã chốt</td><td class="right">${money(order.material_amount)}</td></tr>
                <tr><td>Nhân công / dịch vụ</td><td class="right">${money(order.labor_amount)}</td></tr>
                <tr><td>VAT</td><td class="right">${money(order.vat_amount)}</td></tr>
                <tr class="grand"><td>Tổng báo giá</td><td class="right">${money(order.total_amount)}</td></tr>
              </tbody>
            </table>
          </div>
        </section>

        <section class="section">
          <div class="section-title">3. Ghi chú và xác nhận</div>
          <div class="section-body">
            <div class="note-box">Báo giá có giá trị theo nội dung công việc và vật tư đã liệt kê. Các phát sinh ngoài phạm vi sẽ được xác nhận bổ sung trước khi thực hiện.</div>
          </div>
        </section>

        <div class="signature">
          <div><p>Đại diện An Việt Tech</p><small>Ký và ghi rõ họ tên</small><div class="signature-line">________________________</div></div>
          <div><p>Khách hàng xác nhận</p><small>Ký và ghi rõ họ tên</small><div class="signature-line">________________________</div></div>
        </div>
      `,
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
