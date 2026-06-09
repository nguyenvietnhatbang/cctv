import { requireUser } from "@/lib/auth";
import { query, withTransaction } from "@/lib/db";
import { handleRouteError, jsonCreated, jsonOk } from "@/lib/http";
import { createWorkOrderSchema } from "@/lib/validators";
import { changeWorkOrderStatus, getTechnicianIdForUser, makeWorkOrderCode } from "@/lib/work-orders";

export const runtime = "nodejs";

const customerSelect = `
  select c.id, c.name, c.phone, c.address, c.address_note, c.created_at,
         coalesce((
           select jsonb_agg(
             jsonb_build_object(
               'id', cc.id,
               'customer_id', cc.customer_id,
               'name', cc.name,
               'phone', cc.phone,
               'note', cc.note,
               'is_primary', cc.is_primary
             )
             order by cc.is_primary desc, cc.created_at asc
           )
           from customer_contacts cc
           where cc.customer_id = c.id
         ), '[]'::jsonb) as contacts
  from customers c
`;

export async function GET(request: Request) {
  try {
    const user = await requireUser();
    const { searchParams } = new URL(request.url);

    const status = searchParams.get("status");
    const type = searchParams.get("type");
    const technicianId = searchParams.get("technicianId");
    const dateFrom = searchParams.get("dateFrom");
    const dateTo = searchParams.get("dateTo");
    const q = searchParams.get("q")?.trim();

    const params: unknown[] = [];
    const filters = ["true"];

    if (status) {
      if (status === "todo") {
        filters.push(`wo.status in ('pending_assignment', 'assigned', 'accepted', 'traveling')`);
      } else if (status === "doing") {
        filters.push(`wo.status in ('working', 'awaiting_acceptance') and (wo.appointment_at is null or wo.appointment_at >= now())`);
      } else if (status === "doing_overdue") {
        filters.push(`wo.status in ('working', 'awaiting_acceptance') and wo.appointment_at < now()`);
      } else if (status === "done") {
        filters.push(`wo.status in ('completed', 'awaiting_payment', 'paid', 'debt') and (wo.appointment_at is null or wo.updated_at <= wo.appointment_at)`);
      } else if (status === "done_overdue") {
        filters.push(`wo.status in ('completed', 'awaiting_payment', 'paid', 'debt') and wo.appointment_at is not null and wo.updated_at > wo.appointment_at`);
      } else {
        params.push(status);
        filters.push(`wo.status = $${params.length}`);
      }
    }

    if (type) {
      params.push(type);
      filters.push(`wo.type = $${params.length}`);
    }

    if (technicianId && user.role !== "technician") {
      params.push(technicianId);
      filters.push(`woa.technician_id = $${params.length}`);
    }

    if (dateFrom) {
      params.push(dateFrom);
      filters.push(`(wo.created_at at time zone 'Asia/Ho_Chi_Minh')::date >= $${params.length}::date`);
    }

    if (dateTo) {
      params.push(dateTo);
      filters.push(`(wo.created_at at time zone 'Asia/Ho_Chi_Minh')::date <= $${params.length}::date`);
    }

    if (q) {
      params.push(q);
      filters.push(
        `(wo.code ilike '%' || $${params.length} || '%'
          or c.name ilike '%' || $${params.length} || '%'
          or c.phone ilike '%' || $${params.length} || '%'
          or c.address ilike '%' || $${params.length} || '%')`,
      );
    }

    if (user.role === "technician") {
      const ownTechnicianId = await getTechnicianIdForUser(user.id);
      params.push(ownTechnicianId ?? "00000000-0000-0000-0000-000000000000");
      filters.push(`woa.technician_id = $${params.length}`);
    }

    const result = await query(
      `select wo.id, wo.code, wo.type, wo.priority, wo.status, wo.description,
              wo.appointment_at, wo.created_at, wo.updated_at, wo.labor_cost, wo.vat_rate,
              c.id as customer_id,
              c.name as customer_name, c.phone as customer_phone, c.address as customer_address,
              t.id as technician_id, tu.full_name as technician_name,
              coalesce(p.total_amount, 0) as total_amount, p.status as payment_status
       from work_orders wo
       join customers c on c.id = wo.customer_id
       left join work_order_assignments woa on woa.work_order_id = wo.id and woa.unassigned_at is null
       left join technicians t on t.id = woa.technician_id
       left join users tu on tu.id = t.user_id
       left join payments p on p.work_order_id = wo.id
       where ${filters.join(" and ")}
       order by coalesce(wo.appointment_at, wo.created_at) desc
       limit 80`,
      params,
    );

    return jsonOk({ workOrders: result.rows });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireUser(["admin", "dispatcher"]);
    const body = createWorkOrderSchema.parse(await request.json());

    if (!body.customerId && !body.customer) {
      return Response.json({ error: "Cần chọn hoặc tạo khách hàng" }, { status: 422 });
    }

    const created = await withTransaction(async (client) => {
      let customerId = body.customerId;
      let customer = null;

      if (!customerId && body.customer) {
        const customerResult = await client.query(
          `insert into customers (name, phone, address, address_note, created_by)
           values ($1, $2, $3, $4, $5)
           returning id`,
          [
            body.customer.name,
            body.customer.phone,
            body.customer.address,
            body.customer.addressNote,
            user.id,
          ],
        );
        customerId = customerResult.rows[0].id;
        await client.query(
          `insert into customer_contacts (customer_id, name, phone, is_primary)
           values ($1, $2, $3, true)`,
          [customerId, body.customer.name, body.customer.phone],
        );
        const createdCustomerResult = await client.query(`${customerSelect} where c.id = $1`, [customerId]);
        customer = createdCustomerResult.rows[0];
      }

      const workOrderResult = await client.query(
        `insert into work_orders
           (code, customer_id, type, priority, description, appointment_at, internal_note, created_by, updated_by)
         values ($1, $2, $3, $4, $5, $6, $7, $8, $8)
         returning id, code, status`,
        [
          makeWorkOrderCode(),
          customerId,
          body.type,
          body.priority,
          body.description,
          body.appointmentAt ? new Date(body.appointmentAt) : null,
          body.internalNote,
          user.id,
        ],
      );

      const workOrder = workOrderResult.rows[0];

      await client.query(
        `insert into work_order_status_history
           (work_order_id, from_status, to_status, changed_by, note)
         values ($1, null, 'pending_assignment', $2, 'Tạo phiếu')`,
        [workOrder.id, user.id],
      );

      await client.query(
        "insert into payments (work_order_id) values ($1)",
        [workOrder.id],
      );

      if (body.technicianId) {
        await client.query(
          `insert into work_order_assignments (work_order_id, technician_id, assigned_by)
           values ($1, $2, $3)`,
          [workOrder.id, body.technicianId, user.id],
        );
        await changeWorkOrderStatus(
          client,
          workOrder.id,
          "assigned",
          user,
          "Phân công kỹ thuật viên",
        );
      }

      const listResult = await client.query(
        `select wo.id, wo.code, wo.type, wo.priority, wo.status, wo.description,
                wo.appointment_at, wo.created_at, wo.labor_cost, wo.vat_rate,
                c.id as customer_id,
                c.name as customer_name, c.phone as customer_phone, c.address as customer_address,
                t.id as technician_id, tu.full_name as technician_name,
                coalesce(p.total_amount, 0) as total_amount, p.status as payment_status
         from work_orders wo
         join customers c on c.id = wo.customer_id
         left join work_order_assignments woa on woa.work_order_id = wo.id and woa.unassigned_at is null
         left join technicians t on t.id = woa.technician_id
         left join users tu on tu.id = t.user_id
         left join payments p on p.work_order_id = wo.id
         where wo.id = $1
         limit 1`,
        [workOrder.id],
      );

      return { workOrder: listResult.rows[0], customer };
    });

    return jsonCreated(created);
  } catch (error) {
    return handleRouteError(error);
  }
}
