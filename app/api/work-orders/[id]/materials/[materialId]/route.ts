import { requireUser } from "@/lib/auth";
import { withTransaction } from "@/lib/db";
import { handleRouteError, HttpError, jsonNoContent, jsonOk } from "@/lib/http";
import { OPS_MANAGER_ROLES } from "@/lib/types";
import { updateMaterialSchema } from "@/lib/validators";
import { assertCanEditFinancials, assertCanMutateFieldWork, syncWorkOrderPaymentAmounts } from "@/lib/work-orders";

export const runtime = "nodejs";

type Context = {
  params: Promise<{ id: string; materialId: string }>;
};

export async function PATCH(request: Request, context: Context) {
  try {
    const user = await requireUser([...OPS_MANAGER_ROLES, "technician"]);
    const { id, materialId } = await context.params;
    const body = updateMaterialSchema.parse(await request.json());

    await assertCanMutateFieldWork(user, id);

    const updated = await withTransaction(async (client) => {
      const result = await client.query(
        `update work_order_materials
         set name = coalesce($3, name),
             quantity = coalesce($4, quantity),
             unit_price = coalesce($5, unit_price)
         where work_order_id = $1 and id = $2
         returning id, name, quantity, unit_price, line_total`,
        [id, materialId, body.name ?? null, body.quantity ?? null, body.unitPrice ?? null],
      );

      if (!result.rows[0]) {
        throw new HttpError(404, "Không tìm thấy vật tư");
      }

      await syncWorkOrderPaymentAmounts(client, id);
      return result.rows[0];
    });

    return jsonOk({ material: updated });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function DELETE(_request: Request, context: Context) {
  try {
    const user = await requireUser([...OPS_MANAGER_ROLES, "technician"]);
    const { id, materialId } = await context.params;

    await assertCanMutateFieldWork(user, id);

    await withTransaction(async (client) => {
      const result = await client.query(
        "delete from work_order_materials where work_order_id = $1 and id = $2 returning id",
        [id, materialId],
      );

      if (!result.rows[0]) {
        throw new HttpError(404, "Không tìm thấy vật tư");
      }

      await syncWorkOrderPaymentAmounts(client, id);
    });

    return jsonNoContent();
  } catch (error) {
    return handleRouteError(error);
  }
}
