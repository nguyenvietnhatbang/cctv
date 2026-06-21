import { requireUser } from "@/lib/auth";
import { query, withTransaction } from "@/lib/db";
import { handleRouteError, jsonCreated, jsonOk } from "@/lib/http";
import { OPS_MANAGER_ROLES } from "@/lib/types";
import { createMaterialSchema } from "@/lib/validators";
import { assertCanEditFinancials, assertCanMutateFieldWork, assertCanReadWorkOrder } from "@/lib/work-orders";

export const runtime = "nodejs";

type Context = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: Request, context: Context) {
  try {
    const user = await requireUser();
    const { id } = await context.params;
    await assertCanReadWorkOrder(user, id);

    const result = await query(
      `select id, name, quantity, unit_price, line_total, created_at
       from work_order_materials
       where work_order_id = $1
       order by created_at desc`,
      [id],
    );

    return jsonOk({ materials: result.rows });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: Request, context: Context) {
  try {
    const user = await requireUser([...OPS_MANAGER_ROLES, "technician"]);
    const { id } = await context.params;
    const body = createMaterialSchema.parse(await request.json());

    await assertCanMutateFieldWork(user, id);
    await assertCanEditFinancials(user, id);

    const created = await withTransaction(async (client) => {
      const materialResult = await client.query(
        `insert into work_order_materials (work_order_id, name, quantity, unit_price, created_by)
         values ($1, $2, $3, $4, $5)
         returning id, name, quantity, unit_price, line_total`,
        [id, body.name, body.quantity, body.unitPrice, user.id],
      );

      return materialResult.rows[0];
    });

    return jsonCreated({ material: created });
  } catch (error) {
    return handleRouteError(error);
  }
}
