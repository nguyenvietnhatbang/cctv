import { requireUser } from "@/lib/auth";
import { todayInVietnam, vietnamDayRangeUtc, vietnamMonthRangeUtc } from "@/lib/date-ranges";
import { query, withTransaction } from "@/lib/db";
import { handleRouteError, HttpError, jsonCreated, jsonOk } from "@/lib/http";
import { OPS_MANAGER_ROLES } from "@/lib/types";
import { createWorkOrderSchema } from "@/lib/validators";
import { changeWorkOrderStatus, makeWorkOrderCode, requireTechnicianIdForUser } from "@/lib/work-orders";

export const runtime = "nodejs";

const customerSelect = `
  select c.id, c.name, c.phone, c.address, c.address_note,
         c.lat, c.lng, c.location_pinned_at, c.location_pinned_by, c.created_at,
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
                 'assigned_at', woa.assigned_at
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

function uniqueIds(ids: Array<string | null | undefined>) {
  return [...new Set(ids.filter((id): id is string => Boolean(id)))];
}

export async function GET(request: Request) {
  try {
    const user = await requireUser();
    const { searchParams } = new URL(request.url);

    const status = searchParams.get("status");
    const type = searchParams.get("type");
    const technicianId = searchParams.get("technicianId");
    const dateFrom = searchParams.get("dateFrom");
    const dateTo = searchParams.get("dateTo");
    const scope = searchParams.get("scope") ?? "open";
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
      } else if (status === "paused") {
        filters.push(`wo.status = 'paused'`);
      } else if (status === "cancelled") {
        filters.push(`wo.status = 'cancelled'`);
      } else if (status === "other") {
        filters.push(`wo.status::text not in (
          'pending_assignment', 'assigned', 'accepted', 'traveling',
          'working', 'awaiting_acceptance',
          'completed', 'awaiting_payment', 'paid', 'debt',
          'paused', 'cancelled'
        )`);
      } else if (status === "intake") {
        filters.push(`wo.status = 'pending_assignment'`);
      } else if (status === "dispatch") {
        filters.push(`wo.status = 'assigned'`);
      } else if (status === "field") {
        filters.push(`wo.status in ('accepted', 'traveling', 'working')`);
      } else if (status === "acceptance") {
        filters.push(`wo.status in ('awaiting_acceptance', 'completed')`);
      } else if (status === "payment") {
        filters.push(`wo.status in ('awaiting_payment', 'debt')`);
      } else if (status === "closed") {
        filters.push(`wo.status = 'paid'`);
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
      filters.push(
        `exists (
          select 1
          from work_order_assignments filter_woa
          where filter_woa.work_order_id = wo.id
            and filter_woa.unassigned_at is null
            and filter_woa.technician_id = $${params.length}
        )`,
      );
    }

    if (dateFrom) {
      const range = vietnamDayRangeUtc(dateFrom);
      params.push(range.start);
      filters.push(`wo.appointment_at >= $${params.length}`);
    }

    if (dateTo) {
      const range = vietnamDayRangeUtc(dateTo);
      params.push(range.end);
      filters.push(`wo.appointment_at < $${params.length}`);
    }

    if (!status && !dateFrom && !dateTo) {
      if (scope === "open") {
        filters.push(`wo.status not in ('paid', 'cancelled')`);
      } else if (scope === "today") {
        const range = vietnamDayRangeUtc(todayInVietnam());
        params.push(range.start, range.end);
        filters.push(`wo.appointment_at >= $${params.length - 1} and wo.appointment_at < $${params.length}`);
      } else if (scope === "this_month") {
        const range = vietnamMonthRangeUtc(todayInVietnam());
        params.push(range.start, range.end);
        filters.push(`wo.appointment_at >= $${params.length - 1} and wo.appointment_at < $${params.length}`);
      }
    }

    if (q) {
      params.push(q);
      filters.push(
        `(wo.code ilike '%' || $${params.length} || '%'
          or wo.description ilike '%' || $${params.length} || '%'
          or c.name ilike '%' || $${params.length} || '%'
          or c.phone ilike '%' || $${params.length} || '%'
          or c.address ilike '%' || $${params.length} || '%'
          or coalesce(assn.technician_name, '') ilike '%' || $${params.length} || '%')`,
      );
    }

    if (user.role === "technician") {
      const ownTechnicianId = await requireTechnicianIdForUser(user.id);
      params.push(ownTechnicianId);
      filters.push(
        `exists (
          select 1
          from work_order_assignments own_woa
          where own_woa.work_order_id = wo.id
            and own_woa.unassigned_at is null
            and own_woa.technician_id = $${params.length}
        )`,
      );
    }

    const result = await query(
      `select wo.id, wo.code, wo.type, wo.priority, wo.status, wo.description,
              wo.appointment_at, assn.assigned_at, wo.created_at, wo.updated_at, wo.labor_cost, wo.vat_rate,
              c.id as customer_id,
              c.name as customer_name, c.phone as customer_phone, c.address as customer_address,
              c.lat as customer_lat, c.lng as customer_lng,
              assn.technician_id, assn.technician_name, coalesce(assn.assigned_technicians, '[]'::jsonb) as assigned_technicians,
              coalesce(p.total_amount, 0) as total_amount, p.status as payment_status
       from work_orders wo
       join customers c on c.id = wo.customer_id
       ${assignmentLateralJoin}
       left join payments p on p.work_order_id = wo.id
       where ${filters.join(" and ")}
       order by wo.appointment_at desc nulls last, wo.created_at desc
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
    const user = await requireUser(OPS_MANAGER_ROLES);
    const body = createWorkOrderSchema.parse(await request.json());
    const technicianIds = uniqueIds([...(body.technicianIds ?? []), body.technicianId]);

    if (!body.customerId && !body.customer) {
      return Response.json({ error: "Cần chọn hoặc tạo khách hàng" }, { status: 422 });
    }

    const created = await withTransaction(async (client) => {
      let customerId = body.customerId;
      let customer = null;

      if (!customerId && body.customer) {
        const customerResult = await client.query(
          `insert into customers (name, phone, address, address_note, lat, lng, location_pinned_at, location_pinned_by, created_by)
           values ($1, $2, $3, $4, $5::numeric, $6::numeric, case when $5::numeric is not null and $6::numeric is not null then now() else null end, case when $5::numeric is not null and $6::numeric is not null then $7::uuid else null end, $7::uuid)
           returning id`,
          [
            body.customer.name,
            body.customer.phone,
            body.customer.address,
            body.customer.addressNote,
            body.customer.lat ?? null,
            body.customer.lng ?? null,
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

      if (technicianIds.length > 0) {
        const technicianResult = await client.query<{ id: string }>(
          `select t.id
           from technicians t
           join users u on u.id = t.user_id
           where t.id = any($1::uuid[]) and u.status = 'active'`,
          [technicianIds],
        );
        if (technicianResult.rows.length !== technicianIds.length) {
          throw new HttpError(422, "Danh sách kỹ thuật viên không hợp lệ hoặc có người đã ngưng hoạt động");
        }

        await client.query(
          `insert into work_order_assignments (work_order_id, technician_id, assigned_by)
           select $1, id, $3
           from technicians
           where id = any($2::uuid[])`,
          [workOrder.id, technicianIds, user.id],
        );
        await client.query(
          `insert into notifications (user_id, work_order_id, title, body)
           select t.user_id, $1, 'Bạn được giao phiếu mới', 'Mở phiếu để xem địa chỉ, liên hệ khách và nhận việc.'
           from technicians t
           where t.id = any($2::uuid[])`,
          [workOrder.id, technicianIds],
        );
        await changeWorkOrderStatus(
          client,
          workOrder.id,
          "assigned",
          user,
          `Phân công ${technicianIds.length} kỹ thuật viên`,
        );
      }

      const listResult = await client.query(
        `select wo.id, wo.code, wo.type, wo.priority, wo.status, wo.description,
                wo.appointment_at, assn.assigned_at, wo.created_at, wo.updated_at, wo.labor_cost, wo.vat_rate,
                c.id as customer_id,
                c.name as customer_name, c.phone as customer_phone, c.address as customer_address,
                c.lat as customer_lat, c.lng as customer_lng,
                assn.technician_id, assn.technician_name, coalesce(assn.assigned_technicians, '[]'::jsonb) as assigned_technicians,
                coalesce(p.total_amount, 0) as total_amount, p.status as payment_status
         from work_orders wo
         join customers c on c.id = wo.customer_id
         ${assignmentLateralJoin}
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
