import { requireUser } from "@/lib/auth";
import { withTransaction } from "@/lib/db";
import { handleRouteError, jsonOk } from "@/lib/http";
import { updatePaymentSchema } from "@/lib/validators";
import { assertCanReadWorkOrder, recordWorkOrderPayment } from "@/lib/work-orders";

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

    await withTransaction((client) => recordWorkOrderPayment(client, id, body, user));

    return jsonOk({ ok: true });
  } catch (error) {
    return handleRouteError(error);
  }
}
