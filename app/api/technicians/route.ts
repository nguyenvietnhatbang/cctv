import { requireUser } from "@/lib/auth";
import { query } from "@/lib/db";
import { handleRouteError, jsonCreated, jsonOk } from "@/lib/http";
import { OPS_MANAGER_ROLES } from "@/lib/types";
import { createTechnicianSchema } from "@/lib/validators";

export const runtime = "nodejs";

export async function GET() {
  try {
    await requireUser(OPS_MANAGER_ROLES);

    const result = await query(
      `select t.id, t.user_id, u.full_name, u.phone, u.email, t.service_area, t.status,
              count(woa.id) filter (
                where wo.appointment_at is not null
                  and (wo.appointment_at at time zone 'Asia/Ho_Chi_Minh')::date = (timezone('Asia/Ho_Chi_Minh', now()))::date
                  and woa.unassigned_at is null
              ) as jobs_today
       from technicians t
       join users u on u.id = t.user_id
       left join work_order_assignments woa on woa.technician_id = t.id
       left join work_orders wo on wo.id = woa.work_order_id
       where u.status = 'active'
       group by t.id, u.id
       order by t.status, u.full_name`,
    );

    return jsonOk({ technicians: result.rows });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: Request) {
  try {
    await requireUser(["admin"]);
    const body = createTechnicianSchema.parse(await request.json());

    const result = await query(
      `insert into technicians (user_id, service_area, status)
       values ($1, $2, $3)
       returning id, user_id, service_area, status`,
      [body.userId, body.serviceArea, body.status],
    );

    return jsonCreated({ technician: result.rows[0] });
  } catch (error) {
    return handleRouteError(error);
  }
}
