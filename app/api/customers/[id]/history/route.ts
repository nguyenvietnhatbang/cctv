import { requireUser } from "@/lib/auth";
import { query } from "@/lib/db";
import { handleRouteError, jsonOk } from "@/lib/http";

export const runtime = "nodejs";

type Context = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: Request, context: Context) {
  try {
    await requireUser();
    const { id } = await context.params;

    const result = await query(
      `select wo.id, wo.code, wo.type, wo.status, wo.description, 
              wo.appointment_at, wo.created_at, wo.completion_note,
              coalesce(
                (select jsonb_agg(
                  jsonb_build_object(
                    'name', name,
                    'quantity', quantity
                  )
                  order by created_at asc
                )
                from work_order_materials
                where work_order_id = wo.id),
                '[]'::jsonb
              ) as materials
       from work_orders wo
       where wo.customer_id = $1
       order by wo.appointment_at desc nulls last, wo.created_at desc`,
      [id],
    );

    return jsonOk({ history: result.rows });
  } catch (error) {
    return handleRouteError(error);
  }
}
