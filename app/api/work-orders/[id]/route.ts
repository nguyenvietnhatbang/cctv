import { requireUser } from "@/lib/auth";
import { query, withTransaction } from "@/lib/db";
import { handleRouteError, HttpError, jsonNoContent, jsonOk } from "@/lib/http";
import { isMockMode, mockStore } from "@/lib/mock-store";
import { createSignedFileUrl } from "@/lib/storage";
import { updateWorkOrderSchema } from "@/lib/validators";
import { assertCanEditFinancials, assertCanReadWorkOrder } from "@/lib/work-orders";

export const runtime = "nodejs";

type Context = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: Request, context: Context) {
  try {
    const user = await requireUser();
    const { id } = await context.params;
    if (isMockMode()) {
      return jsonOk(mockStore.detail(user, id));
    }

    await assertCanReadWorkOrder(user, id);

    const workOrderResult = await query(
      `select wo.*,
              c.name as customer_name, c.phone as customer_phone, c.address as customer_address,
              c.address_note as customer_address_note,
              t.id as technician_id, tu.full_name as technician_name, tu.phone as technician_phone,
              p.status as payment_status, p.method as payment_method, p.labor_amount,
              p.material_amount, p.vat_amount, p.total_amount, p.transaction_ref,
              p.debt_due_date, p.note as payment_note, p.confirmed_at
       from work_orders wo
       join customers c on c.id = wo.customer_id
       left join work_order_assignments woa on woa.work_order_id = wo.id and woa.unassigned_at is null
       left join technicians t on t.id = woa.technician_id
       left join users tu on tu.id = t.user_id
       left join payments p on p.work_order_id = wo.id
       where wo.id = $1
       limit 1`,
      [id],
    );

    const workOrder = workOrderResult.rows[0];
    if (!workOrder) {
      return Response.json({ error: "Không tìm thấy phiếu" }, { status: 404 });
    }

    const [historyResult, materialsResult, filesResult] = await Promise.all([
      query(
        `select h.*, u.full_name as changed_by_name
         from work_order_status_history h
         left join users u on u.id = h.changed_by
         where h.work_order_id = $1
         order by h.changed_at desc`,
        [id],
      ),
      query(
        `select id, name, quantity, unit_price, line_total, created_at
         from work_order_materials
         where work_order_id = $1
         order by created_at desc`,
        [id],
      ),
      query(
        `select id, bucket, path, original_name, mime_type, size_bytes, purpose, uploaded_at
         from work_order_files
         where work_order_id = $1
         order by uploaded_at desc`,
        [id],
      ),
    ]);

    const files = await Promise.all(
      filesResult.rows.map(async (file) => {
        try {
          return { ...file, signed_url: await createSignedFileUrl(file.path) };
        } catch {
          return { ...file, signed_url: null };
        }
      }),
    );

    return jsonOk({
      workOrder,
      history: historyResult.rows,
      materials: materialsResult.rows,
      files,
    });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function PATCH(request: Request, context: Context) {
  try {
    const user = await requireUser(["admin", "dispatcher", "technician"]);
    const { id } = await context.params;
    if (isMockMode()) {
      const body = updateWorkOrderSchema.parse(await request.json());
      return jsonOk({ workOrder: mockStore.updateWorkOrder(user, id, body) });
    }

    await assertCanReadWorkOrder(user, id);
    const body = updateWorkOrderSchema.parse(await request.json());
    if (body.laborCost !== undefined || body.vatRate !== undefined) {
      await assertCanEditFinancials(user, id);
    }

    const result = await withTransaction(async (client) => {
      const updated = await client.query(
        `update work_orders
         set type = coalesce($2, type),
             priority = coalesce($3, priority),
             description = coalesce($4, description),
             appointment_at = coalesce($5, appointment_at),
             internal_note = coalesce($6, internal_note),
             labor_cost = coalesce($7, labor_cost),
             vat_rate = coalesce($8, vat_rate),
             completion_note = coalesce($9, completion_note),
             acceptance_name = coalesce($10, acceptance_name),
             acceptance_phone = coalesce($11, acceptance_phone),
             cancellation_reason = coalesce($12, cancellation_reason),
             updated_by = $13
         where id = $1
         returning id, code, status`,
        [
          id,
          body.type ?? null,
          body.priority ?? null,
          body.description ?? null,
          body.appointmentAt ? new Date(body.appointmentAt) : null,
          body.internalNote ?? null,
          body.laborCost ?? null,
          body.vatRate ?? null,
          body.completionNote ?? null,
          body.acceptanceName ?? null,
          body.acceptancePhone ?? null,
          body.cancellationReason ?? null,
          user.id,
        ],
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

      return updated;
    });

    if (!result.rows[0]) {
      return Response.json({ error: "Không tìm thấy phiếu" }, { status: 404 });
    }

    return jsonOk({ workOrder: result.rows[0] });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function DELETE(_request: Request, context: Context) {
  try {
    const user = await requireUser(["admin", "dispatcher"]);
    const { id } = await context.params;
    if (isMockMode()) {
      mockStore.changeStatus(user, id, "cancelled", "Xóa mock");
      return jsonNoContent();
    }

    const result = await query("delete from work_orders where id = $1 returning id", [id]);

    if (!result.rows[0]) {
      throw new HttpError(404, "Không tìm thấy phiếu");
    }

    return jsonNoContent();
  } catch (error) {
    return handleRouteError(error);
  }
}
