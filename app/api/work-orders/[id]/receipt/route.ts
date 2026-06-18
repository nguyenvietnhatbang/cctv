import { requireUser } from "@/lib/auth";
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

export async function GET(_request: Request, context: Context) {
  try {
    const user = await requireUser();
    const { id } = await context.params;

    await assertCanReadWorkOrder(user, id);

    const [orderResult, materialsResult] = await Promise.all([
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
    ]);

    const order = orderResult.rows[0];
    if (!order) {
      return new Response("Không tìm thấy phiếu", { status: 404 });
    }

    const rows = materialsResult.rows
      .map(
        (item) => `<tr><td>${escapeHtml(item.name)}</td><td>${escapeHtml(item.quantity)}</td><td>${money(
          item.unit_price,
        )}</td><td>${money(item.line_total)}</td></tr>`,
      )
      .join("");

    return new Response(
      `<!doctype html>
      <html lang="vi">
        <head>
          <meta charset="utf-8" />
          <title>Biên bản nghiệm thu ${escapeHtml(order.code)}</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 40px; color: #18181b; }
            h1 { font-size: 24px; margin-bottom: 6px; }
            .muted { color: #52525b; }
            .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin: 24px 0; }
            .box { border: 1px solid #d4d4d8; border-radius: 8px; padding: 14px; }
            table { width: 100%; border-collapse: collapse; margin-top: 16px; }
            th, td { border-bottom: 1px solid #e4e4e7; padding: 10px; text-align: left; }
            .total { text-align: right; font-size: 20px; font-weight: 700; margin-top: 20px; }
            .signature { margin-top: 48px; display: grid; grid-template-columns: 1fr 1fr; gap: 80px; text-align: center; }
            @media print { button { display: none; } body { margin: 20px; } }
          </style>
        </head>
        <body>
          <button onclick="window.print()">In / lưu PDF</button>
          <h1>Biên bản nghiệm thu công việc</h1>
          <p class="muted">${escapeHtml(order.code)} · ${
            WORK_ORDER_STATUS_LABELS[order.status as keyof typeof WORK_ORDER_STATUS_LABELS]
          }</p>
          <div class="grid">
            <div class="box">
              <strong>Khách hàng</strong>
              <p>${escapeHtml(order.customer_name)} · ${escapeHtml(order.customer_phone)}</p>
              <p>${escapeHtml(order.customer_address)}</p>
            </div>
            <div class="box">
              <strong>Công việc</strong>
              <p>${WORK_ORDER_TYPE_LABELS[order.type as keyof typeof WORK_ORDER_TYPE_LABELS]}</p>
              <p>${escapeHtml(order.description)}</p>
            </div>
          </div>
          <h2>Vật tư và chi phí</h2>
          <table>
            <thead><tr><th>Vật tư</th><th>SL</th><th>Đơn giá</th><th>Thành tiền</th></tr></thead>
            <tbody>${rows || "<tr><td colspan='4'>Không có vật tư</td></tr>"}</tbody>
          </table>
          <p class="total">Tổng tiền: ${money(order.total_amount)}</p>
          <p>Đã thu: <strong>${money(order.paid_amount)}</strong></p>
          <p>Còn lại: <strong>${money(order.debt_amount)}</strong></p>
          <div class="signature">
            <div><p>Đại diện kỹ thuật</p><br /><br /><strong>________________</strong></div>
            <div><p>Người nghiệm thu</p><br /><br /><strong>${escapeHtml(order.acceptance_name)}</strong></div>
          </div>
        </body>
      </html>`,
      { headers: { "content-type": "text/html; charset=utf-8" } },
    );
  } catch (error) {
    return handleRouteError(error);
  }
}
