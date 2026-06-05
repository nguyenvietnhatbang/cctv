import { requireUser } from "@/lib/auth";
import { withTransaction } from "@/lib/db";
import { handleRouteError, jsonOk } from "@/lib/http";
import { isMockMode, mockStore } from "@/lib/mock-store";
import { updatePaymentSchema } from "@/lib/validators";
import { changeWorkOrderStatus } from "@/lib/work-orders";

export const runtime = "nodejs";

type Context = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: Request, context: Context) {
  try {
    const user = await requireUser(["admin", "dispatcher", "accountant"]);
    const { id } = await context.params;
    const body = updatePaymentSchema.parse(await request.json());

    if (body.status === "paid" && !body.method) {
      return Response.json({ error: "Cần nhập hình thức thanh toán" }, { status: 422 });
    }

    if (body.status === "debt" && !body.note && !body.debtDueDate) {
      return Response.json({ error: "Cần ghi chú hoặc ngày hẹn khi chuyển công nợ" }, { status: 422 });
    }

    if (isMockMode()) {
      mockStore.pay(user, id, body);
      return jsonOk({ ok: true });
    }

    await withTransaction(async (client) => {
      await client.query(
        `update payments p
         set labor_amount = wo.labor_cost,
             material_amount = coalesce(m.total, 0),
             vat_amount = round((wo.labor_cost + coalesce(m.total, 0)) * wo.vat_rate / 100, 2),
             total_amount = wo.labor_cost + coalesce(m.total, 0)
               + round((wo.labor_cost + coalesce(m.total, 0)) * wo.vat_rate / 100, 2),
             status = $2,
             method = $3,
             transaction_ref = $4,
             debt_due_date = $5,
             note = $6,
             confirmed_by = $7,
             confirmed_at = now()
         from work_orders wo
         left join (
           select work_order_id, sum(line_total) as total
           from work_order_materials
           where work_order_id = $1
           group by work_order_id
         ) m on m.work_order_id = wo.id
         where p.work_order_id = wo.id and wo.id = $1`,
        [
          id,
          body.status,
          body.method ?? (body.status === "debt" ? "debt" : null),
          body.transactionRef,
          body.debtDueDate,
          body.note,
          user.id,
        ],
      );

      if (body.status === "paid") {
        await changeWorkOrderStatus(client, id, "paid", user, "Xác nhận đã thanh toán");
      }

      if (body.status === "debt") {
        await changeWorkOrderStatus(client, id, "debt", user, "Chuyển công nợ");
      }
      await client.query(
        `insert into notifications (user_id, work_order_id, title, body)
         select u.id, $1, 'Thanh toán đã cập nhật', $2
         from users u
         where u.role in ('admin', 'dispatcher', 'accountant') and u.status = 'active'`,
        [id, body.status === "paid" ? "Phiếu đã thanh toán." : "Phiếu chuyển sang công nợ."],
      );
    });

    return jsonOk({ ok: true });
  } catch (error) {
    return handleRouteError(error);
  }
}
