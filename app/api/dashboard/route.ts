import { requireUser } from "@/lib/auth";
import { query } from "@/lib/db";
import { handleRouteError, jsonOk } from "@/lib/http";
import { getTechnicianIdForUser } from "@/lib/work-orders";

export const runtime = "nodejs";

export async function GET() {
  try {
    const user = await requireUser();

    const technicianId = user.role === "technician" ? await getTechnicianIdForUser(user.id) : null;
    const params: unknown[] = [];
    const technicianFilter = technicianId
      ? `and exists (
          select 1 from work_order_assignments woa
          where woa.work_order_id = wo.id
            and woa.unassigned_at is null
            and woa.technician_id = $1
        )`
      : "";

    if (technicianId) {
      params.push(technicianId);
    }

    const result = await query<{
      total_today: string;
      pending_assignment: string;
      working: string;
      awaiting_acceptance: string;
      awaiting_payment: string;
      paid_today: string;
      open_debt: string;
    }>(
      `select
        count(*) filter (where (wo.created_at at time zone 'Asia/Ho_Chi_Minh')::date = (timezone('Asia/Ho_Chi_Minh', now()))::date) as total_today,
        count(*) filter (where wo.status = 'pending_assignment') as pending_assignment,
        count(*) filter (where wo.status in ('traveling', 'working')) as working,
        count(*) filter (where wo.status = 'awaiting_acceptance') as awaiting_acceptance,
        count(*) filter (where wo.status = 'awaiting_payment') as awaiting_payment,
        coalesce(sum(p.total_amount) filter (
          where p.status = 'paid' and (p.confirmed_at at time zone 'Asia/Ho_Chi_Minh')::date = (timezone('Asia/Ho_Chi_Minh', now()))::date
        ), 0) as paid_today,
        coalesce(sum(p.total_amount) filter (where p.status = 'debt'), 0) as open_debt
       from work_orders wo
       left join payments p on p.work_order_id = wo.id
       where true ${technicianFilter}`,
      params,
    );

    return jsonOk({ metrics: result.rows[0] });
  } catch (error) {
    return handleRouteError(error);
  }
}
