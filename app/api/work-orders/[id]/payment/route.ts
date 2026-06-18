import { requireUser } from "@/lib/auth";
import { withTransaction } from "@/lib/db";
import { handleRouteError, HttpError, jsonOk } from "@/lib/http";
import { updatePaymentSchema } from "@/lib/validators";
import { assertCanReadWorkOrder, changeWorkOrderPaymentStatus, makePaymentTransactionRef } from "@/lib/work-orders";

export const runtime = "nodejs";

type Context = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: Request, context: Context) {
  try {
    const user = await requireUser(["admin", "dispatcher", "accountant", "technician"]);
    const { id } = await context.params;
    const body = updatePaymentSchema.parse(await request.json());

    await assertCanReadWorkOrder(user, id);

    await withTransaction(async (client) => {
      const paymentResult = await client.query<{
        id: string;
        code: string;
        total_amount: string;
        paid_amount: string;
      }>(
        `update payments p
         set labor_amount = wo.labor_cost,
             material_amount = coalesce(m.total, 0),
             vat_amount = round((wo.labor_cost + coalesce(m.total, 0)) * wo.vat_rate / 100, 2),
             total_amount = wo.labor_cost + coalesce(m.total, 0)
               + round((wo.labor_cost + coalesce(m.total, 0)) * wo.vat_rate / 100, 2),
             debt_amount = greatest(
               wo.labor_cost + coalesce(m.total, 0)
                 + round((wo.labor_cost + coalesce(m.total, 0)) * wo.vat_rate / 100, 2)
                 - p.paid_amount,
               0
             )
         from work_orders wo
         left join (
           select work_order_id, sum(line_total) as total
           from work_order_materials
           where work_order_id = $1
           group by work_order_id
         ) m on m.work_order_id = wo.id
         where p.work_order_id = wo.id and wo.id = $1
         returning p.id, wo.code, p.total_amount, p.paid_amount`,
        [id],
      );

      const payment = paymentResult.rows[0];
      if (!payment) {
        throw new HttpError(404, "Không tìm thấy thanh toán");
      }

      await client.query("select id from payments where id = $1 for update", [payment.id]);

      const totalAmount = Number(payment.total_amount);
      const paidBefore = Number(payment.paid_amount);
      const remainingBefore = Math.max(totalAmount - paidBefore, 0);
      const collectionAmount = body.amount ?? (body.status === "paid" ? remainingBefore : 0);

      if (collectionAmount < 0) {
        throw new HttpError(422, "Số tiền thu không hợp lệ");
      }

      if (body.status === "paid" && collectionAmount <= 0 && remainingBefore > 0) {
        throw new HttpError(422, "Cần nhập số tiền đã thu");
      }

      if (collectionAmount > 0 && (!body.method || body.method === "debt")) {
        throw new HttpError(422, "Cần nhập hình thức thanh toán tiền đã thu");
      }

      if (collectionAmount > remainingBefore) {
        throw new HttpError(422, "Số tiền thu vượt quá số còn lại");
      }

      const paidAfter = paidBefore + collectionAmount;
      const debtAfter = Math.max(totalAmount - paidAfter, 0);
      const nextPaymentStatus = debtAfter > 0 ? "debt" : "paid";
      const transactionRef = collectionAmount > 0 ? makePaymentTransactionRef(payment.code) : null;

      if (debtAfter > 0 && !body.note && !body.debtDueDate) {
        throw new HttpError(422, "Cần ghi chú hoặc ngày hẹn cho số tiền còn công nợ");
      }

      if (collectionAmount > 0 && transactionRef && body.method && body.method !== "debt") {
        await client.query(
          `insert into payment_transactions
             (payment_id, work_order_id, amount, method, transaction_ref, note, collected_by)
           values ($1, $2, $3, $4, $5, $6, $7)`,
          [payment.id, id, collectionAmount, body.method, transactionRef, body.note, user.id],
        );
      }

      await client.query(
        `update payments p
         set paid_amount = $2,
             debt_amount = $3,
             status = $4,
             method = $5,
             transaction_ref = coalesce($6, transaction_ref),
             debt_due_date = $7,
             note = $8,
             confirmed_by = $9,
             confirmed_at = now()
         where p.work_order_id = $1`,
        [
          id,
          paidAfter,
          debtAfter,
          nextPaymentStatus,
          debtAfter > 0 && collectionAmount === 0 ? "debt" : collectionAmount > 0 ? body.method : "cash",
          transactionRef,
          body.debtDueDate,
          body.note,
          user.id,
        ],
      );

      if (nextPaymentStatus === "paid") {
        await changeWorkOrderPaymentStatus(client, id, "paid", user, `Xác nhận đã thu đủ ${totalAmount.toLocaleString("vi-VN")}đ`);
      }

      if (nextPaymentStatus === "debt") {
        const note = collectionAmount > 0
          ? `Thu ${collectionAmount.toLocaleString("vi-VN")}đ, còn công nợ ${debtAfter.toLocaleString("vi-VN")}đ`
          : `Chuyển công nợ ${debtAfter.toLocaleString("vi-VN")}đ`;
        await changeWorkOrderPaymentStatus(client, id, "debt", user, note);
      }
      await client.query(
        `insert into notifications (user_id, work_order_id, title, body)
         select u.id, $1, 'Thanh toán đã cập nhật', $2
         from users u
         where u.role in ('admin', 'dispatcher', 'accountant') and u.status = 'active'`,
        [id, nextPaymentStatus === "paid" ? "Phiếu đã thu đủ tiền." : "Phiếu còn công nợ."],
      );
    });

    return jsonOk({ ok: true });
  } catch (error) {
    return handleRouteError(error);
  }
}
