import { randomUUID } from "crypto";
import { requireUser } from "@/lib/auth";
import { withTransaction } from "@/lib/db";
import { handleRouteError, HttpError, jsonOk } from "@/lib/http";
import { schedulePushProcessing } from "@/lib/notifications";
import { OPS_MANAGER_ROLES, type WorkOrderStatus } from "@/lib/types";
import { uploadWorkOrderBytes } from "@/lib/storage";
import { acceptanceSchema } from "@/lib/validators";
import { assertCanMutateFieldWork, changeWorkOrderPaymentStatus, changeWorkOrderStatus, recordWorkOrderPayment } from "@/lib/work-orders";

export const runtime = "nodejs";

type Context = {
  params: Promise<{ id: string }>;
};

export async function POST(request: Request, context: Context) {
  try {
    const user = await requireUser([...OPS_MANAGER_ROLES, "technician"]);
    const { id } = await context.params;
    const body = acceptanceSchema.parse(await request.json());

    await assertCanMutateFieldWork(user, id);
    const base64 = body.signatureDataUrl.replace("data:image/png;base64,", "");
    const bytes = Buffer.from(base64, "base64");
    const path = `work-orders/${id}/signature/${randomUUID()}.png`;

    await withTransaction(async (client) => {
      const statusResult = await client.query<{ status: WorkOrderStatus }>(
        "select status from work_orders where id = $1 for update",
        [id],
      );
      const current = statusResult.rows[0];
      if (!current) {
        throw new HttpError(404, "Không tìm thấy phiếu");
      }
      if (current.status !== "awaiting_acceptance") {
        throw new HttpError(422, "Chỉ ký nghiệm thu khi phiếu đang chờ nghiệm thu");
      }

      if (body.payment) {
        if (!["admin", "dispatcher", "accountant", "technician"].includes(user.role)) {
          throw new HttpError(403, "Tài khoản hiện tại không có quyền ghi nhận thanh toán");
        }
        await recordWorkOrderPayment(client, id, body.payment, user);
      }

      const uploaded = await uploadWorkOrderBytes(path, bytes, "image/png");

      await client.query(
        `update work_orders
         set acceptance_name = $2,
             acceptance_phone = $3,
             accepted_at = coalesce(accepted_at, now()),
             updated_by = $4
         where id = $1`,
        [id, body.acceptanceName, body.acceptancePhone, user.id],
      );
      await client.query(
        `insert into work_order_files
           (work_order_id, bucket, path, original_name, mime_type, size_bytes, purpose, uploaded_by)
         values ($1, $2, $3, $4, 'image/png', $5, 'signature', $6)
         on conflict (bucket, path) do nothing`,
        [id, uploaded.bucket, uploaded.path, "signature.png", bytes.length, user.id],
      );
      await changeWorkOrderStatus(client, id, "completed", user, "Khách ký nghiệm thu");

      const paymentResult = await client.query<{ status: "paid" | "debt" | "unpaid"; debt_amount: string }>(
        `select status, debt_amount
         from payments
         where work_order_id = $1`,
        [id],
      );
      const payment = paymentResult.rows[0];
      if (payment?.status === "paid") {
        await changeWorkOrderPaymentStatus(client, id, "paid", user, "Tự đồng bộ trạng thái sau nghiệm thu vì đã ghi nhận thanh toán");
      }
      if (payment?.status === "debt") {
        await changeWorkOrderPaymentStatus(client, id, "debt", user, `Tự đồng bộ công nợ sau nghiệm thu: ${Number(payment.debt_amount).toLocaleString("vi-VN")}đ`);
      }
    });

    schedulePushProcessing();
    return jsonOk({ ok: true });
  } catch (error) {
    return handleRouteError(error);
  }
}
