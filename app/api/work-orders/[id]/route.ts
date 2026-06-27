import { requireUser } from "@/lib/auth";
import { query, withTransaction } from "@/lib/db";
import { handleRouteError, HttpError, jsonNoContent, jsonOk } from "@/lib/http";
import { createNotifications, schedulePushProcessing } from "@/lib/notifications";
import { createSignedFileUrl, deleteWorkOrderFile } from "@/lib/storage";
import { OPS_MANAGER_ROLES } from "@/lib/types";
import { updateWorkOrderSchema } from "@/lib/validators";
import { assertCanEditFinancials, assertCanReadWorkOrder, assertWorkOrderTotalCoversPaidAmount, syncClosedWorkOrderStatusFromPayment, syncWorkOrderPaymentAmounts } from "@/lib/work-orders";

export const runtime = "nodejs";

type Context = {
  params: Promise<{ id: string }>;
};

const assignmentLateralJoin = `
  left join lateral (
    select min(woa.assigned_at) as assigned_at,
           (array_agg(t.id order by woa.assigned_at, u.full_name))[1] as technician_id,
           string_agg(u.full_name, ', ' order by u.full_name) as technician_name,
           coalesce(
             jsonb_agg(
               jsonb_build_object(
                 'id', t.id,
                 'user_id', t.user_id,
                 'full_name', u.full_name,
                 'phone', u.phone,
                 'email', u.email,
                 'service_area', t.service_area,
                 'status', t.status,
                 'assigned_at', woa.assigned_at,
                 'field_status', woa.field_status,
                 'check_in_at', woa.check_in_at
               )
               order by u.full_name
             ),
             '[]'::jsonb
           ) as assigned_technicians
    from work_order_assignments woa
    join technicians t on t.id = woa.technician_id
    join users u on u.id = t.user_id
    where woa.work_order_id = wo.id and woa.unassigned_at is null
  ) assn on true
`;

export async function GET(_request: Request, context: Context) {
  try {
    const user = await requireUser();
    const { id } = await context.params;

    await assertCanReadWorkOrder(user, id);

    const workOrderResult = await query(
      `select wo.*,
              c.name as customer_name, c.phone as customer_phone, c.address as customer_address,
              c.lat as customer_lat, c.lng as customer_lng,
              c.address_note as customer_address_note,
              assn.assigned_at,
              assn.technician_id,
              assn.technician_name,
              coalesce(assn.assigned_technicians, '[]'::jsonb) as assigned_technicians,
              p.status as payment_status, p.method as payment_method, p.labor_amount,
              p.material_amount, p.vat_amount, p.total_amount, p.paid_amount,
              case
                when p.status = 'debt' then coalesce(p.debt_amount, 0)
                when p.status = 'paid' then 0
                else greatest(coalesce(p.total_amount, 0) - coalesce(p.paid_amount, 0), 0)
              end as debt_amount,
              p.transaction_ref,
              p.debt_due_date, p.note as payment_note, p.confirmed_at
       from work_orders wo
       join customers c on c.id = wo.customer_id
       ${assignmentLateralJoin}
       left join payments p on p.work_order_id = wo.id
       where wo.id = $1
       limit 1`,
      [id],
    );

    const workOrder = workOrderResult.rows[0];
    if (!workOrder) {
      return Response.json({ error: "Không tìm thấy phiếu" }, { status: 404 });
    }

    const [historyResult, materialsResult, filesResult, paymentTransactionsResult] = await Promise.all([
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
      query(
        `select pt.id, pt.amount, pt.method, pt.transaction_ref, pt.note,
                u.full_name as collected_by_name, pt.collected_at
         from payment_transactions pt
         left join users u on u.id = pt.collected_by
         where pt.work_order_id = $1
         order by pt.collected_at desc`,
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
      paymentTransactions: paymentTransactionsResult.rows,
    });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function PATCH(request: Request, context: Context) {
  try {
    const user = await requireUser([...OPS_MANAGER_ROLES, "technician"]);
    const { id } = await context.params;

    await assertCanReadWorkOrder(user, id);
    const body = updateWorkOrderSchema.parse(await request.json());
    if (body.laborCost !== undefined || body.vatRate !== undefined || body.materialCost !== undefined) {
      await assertCanEditFinancials(user, id);
    }

    const result = await withTransaction(async (client) => {
      const currentResult = await client.query<{
        code: string;
        type: string;
        priority: "normal" | "urgent";
        description: string;
        appointment_at: string | null;
        internal_note: string | null;
      }>(
        `select code, type, priority, description, appointment_at, internal_note
         from work_orders
         where id = $1
         for update`,
        [id],
      );
      const current = currentResult.rows[0];
      if (!current) {
        throw new HttpError(404, "Không tìm thấy phiếu");
      }

      const updated = await client.query(
        `update work_orders
         set type = coalesce($2, type),
             priority = coalesce($3, priority),
             description = coalesce($4, description),
             appointment_at = case when $5::boolean then $6::timestamptz else appointment_at end,
             internal_note = coalesce($7, internal_note),
             labor_cost = coalesce($8, labor_cost),
             material_cost = coalesce($9, material_cost),
             vat_rate = coalesce($10, vat_rate),
             completion_note = coalesce($11, completion_note),
             acceptance_name = coalesce($12, acceptance_name),
             acceptance_phone = coalesce($13, acceptance_phone),
             cancellation_reason = coalesce($14, cancellation_reason),
             updated_by = $15
         where id = $1
         returning id, code, status`,
        [
          id,
          body.type ?? null,
          body.priority ?? null,
          body.description ?? null,
          Object.prototype.hasOwnProperty.call(body, "appointmentAt"),
          body.appointmentAt ? new Date(body.appointmentAt) : null,
          body.internalNote ?? null,
          body.laborCost ?? null,
          body.materialCost ?? null,
          body.vatRate ?? null,
          body.completionNote ?? null,
          body.acceptanceName ?? null,
          body.acceptancePhone ?? null,
          body.cancellationReason ?? null,
          user.id,
        ],
      );

      if (body.laborCost !== undefined || body.vatRate !== undefined || body.materialCost !== undefined) {
        await assertWorkOrderTotalCoversPaidAmount(client, id);
      }
      await syncWorkOrderPaymentAmounts(client, id);
      if (body.laborCost !== undefined || body.vatRate !== undefined || body.materialCost !== undefined) {
        await syncClosedWorkOrderStatusFromPayment(client, id, user);
      }

      const appointmentWasProvided = Object.prototype.hasOwnProperty.call(body, "appointmentAt");
      const currentAppointment = current.appointment_at ? new Date(current.appointment_at).getTime() : null;
      const nextAppointment = body.appointmentAt ? new Date(body.appointmentAt).getTime() : null;
      const importantChanged =
        (body.type !== undefined && body.type !== current.type)
        || (body.priority !== undefined && body.priority !== current.priority)
        || (body.description !== undefined && body.description !== current.description)
        || (appointmentWasProvided && nextAppointment !== currentAppointment)
        || (body.internalNote !== undefined && body.internalNote !== current.internal_note);

      if (importantChanged) {
        const recipients = await client.query<{ user_id: string }>(
          `select technician.user_id
           from work_order_assignments assignment
           join technicians technician on technician.id = assignment.technician_id
           join users technician_user on technician_user.id = technician.user_id
           where assignment.work_order_id = $1
             and assignment.unassigned_at is null
             and technician_user.status = 'active'`,
          [id],
        );
        await createNotifications(
          client,
          recipients.rows.map((recipient) => ({
            userId: recipient.user_id,
            workOrderId: id,
            type: "work_order_updated",
            priority: (body.priority ?? current.priority) === "urgent" ? "urgent" : "high",
            title: `Phiếu ${current.code} đã cập nhật`,
            body: "Lịch hẹn hoặc nội dung công việc đã thay đổi. Mở phiếu để kiểm tra.",
          })),
        );
      }

      return updated;
    });

    if (!result.rows[0]) {
      return Response.json({ error: "Không tìm thấy phiếu" }, { status: 404 });
    }

    schedulePushProcessing();
    return jsonOk({ workOrder: result.rows[0] });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function DELETE(_request: Request, context: Context) {
  try {
    await requireUser(["admin"]);
    const { id } = await context.params;

    const filePaths = await withTransaction(async (client) => {
      const deletableResult = await client.query<{
        status: string;
        accepted_at: string | null;
        paid_amount: string;
        has_transaction: boolean;
      }>(
        `select wo.status, wo.accepted_at, coalesce(p.paid_amount, 0) as paid_amount,
                exists (
                  select 1
                  from payment_transactions pt
                  where pt.work_order_id = wo.id
                ) as has_transaction
         from work_orders wo
         left join payments p on p.work_order_id = wo.id
         where wo.id = $1
         for update of wo`,
        [id],
      );
      const deletable = deletableResult.rows[0];
      if (!deletable) {
        throw new HttpError(404, "Không tìm thấy phiếu");
      }
      if (
        !["pending_assignment", "cancelled"].includes(deletable.status)
        || deletable.accepted_at
        || Number(deletable.paid_amount) > 0
        || deletable.has_transaction
      ) {
        throw new HttpError(422, "Không thể xóa phiếu đã phát sinh xử lý, nghiệm thu hoặc giao dịch tài chính");
      }

      const filesResult = await client.query<{ path: string }>(
        "select path from work_order_files where work_order_id = $1",
        [id],
      );

      await client.query("delete from notifications where work_order_id = $1", [id]);
      await client.query("delete from work_order_files where work_order_id = $1", [id]);
      await client.query("delete from work_order_materials where work_order_id = $1", [id]);
      await client.query("delete from work_order_status_history where work_order_id = $1", [id]);
      await client.query("delete from work_order_assignments where work_order_id = $1", [id]);
      await client.query("delete from payments where work_order_id = $1", [id]);

      const result = await client.query("delete from work_orders where id = $1 returning id", [id]);

      if (!result.rows[0]) {
        throw new HttpError(404, "Không tìm thấy phiếu");
      }

      return filesResult.rows.map((file) => file.path);
    });

    for (const path of filePaths) {
      try {
        await deleteWorkOrderFile(path);
      } catch (error) {
        console.error("Không xóa được file trong storage", { path, error });
      }
    }

    return jsonNoContent();
  } catch (error) {
    return handleRouteError(error);
  }
}
