import { requireUser } from "@/lib/auth";
import { query, withTransaction } from "@/lib/db";
import { handleRouteError, jsonCreated, jsonOk } from "@/lib/http";
import { isMockMode, mockStore } from "@/lib/mock-store";
import { createMaterialSchema } from "@/lib/validators";
import { assertCanEditFinancials, assertCanMutateFieldWork } from "@/lib/work-orders";

export const runtime = "nodejs";

type Context = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: Request, context: Context) {
  try {
    const user = await requireUser();
    const { id } = await context.params;
    if (isMockMode()) {
      return jsonOk({ materials: mockStore.detail(user, id).materials });
    }

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
    const user = await requireUser(["admin", "dispatcher", "technician"]);
    const { id } = await context.params;
    const body = createMaterialSchema.parse(await request.json());
    if (isMockMode()) {
      return jsonCreated({ material: mockStore.createMaterial(user, id, body) });
    }

    await assertCanMutateFieldWork(user, id);
    await assertCanEditFinancials(user, id);

    const created = await withTransaction(async (client) => {
      const materialResult = await client.query(
        `insert into work_order_materials (work_order_id, name, quantity, unit_price, created_by)
         values ($1, $2, $3, $4, $5)
         returning id, name, quantity, unit_price, line_total`,
        [id, body.name, body.quantity, body.unitPrice, user.id],
      );

      await client.query(
        `update payments p
         set material_amount = coalesce(m.total, 0),
             labor_amount = wo.labor_cost,
             vat_amount = round((wo.labor_cost + coalesce(m.total, 0)) * wo.vat_rate / 100, 2),
             total_amount = wo.labor_cost + coalesce(m.total, 0)
               + round((wo.labor_cost + coalesce(m.total, 0)) * wo.vat_rate / 100, 2)
         from work_orders wo
         left join (
           select work_order_id, sum(line_total) as total
           from work_order_materials
           where work_order_id = $1
           group by work_order_id
         ) m on m.work_order_id = wo.id
         where p.work_order_id = wo.id and wo.id = $1`,
        [id],
      );

      return materialResult.rows[0];
    });

    return jsonCreated({ material: created });
  } catch (error) {
    return handleRouteError(error);
  }
}
