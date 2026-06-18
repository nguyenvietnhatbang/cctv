import { requireUser } from "@/lib/auth";
import { todayInVietnam, vietnamDayRangeUtc } from "@/lib/date-ranges";
import { query } from "@/lib/db";
import { handleRouteError, jsonOk } from "@/lib/http";
import { requireTechnicianIdForUser } from "@/lib/work-orders";

export const runtime = "nodejs";

export async function GET() {
  try {
    const user = await requireUser();

    const technicianId = user.role === "technician" ? await requireTechnicianIdForUser(user.id) : null;
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

    const todayRange = vietnamDayRangeUtc(todayInVietnam());
    params.push(todayRange.start, todayRange.end);
    const todayStartParam = params.length - 1;
    const todayEndParam = params.length;

    const result = await query<{
      total_today: string;
      todo: string;
      doing: string;
      doing_overdue: string;
      done: string;
      done_overdue: string;
      paused: string;
      cancelled: string;
      other: string;
      paid_today: string;
      open_debt: string;
    }>(
      `select
        count(*) filter (where wo.appointment_at >= $${todayStartParam} and wo.appointment_at < $${todayEndParam}) as total_today,
        count(*) filter (where wo.status in ('pending_assignment', 'assigned', 'accepted', 'traveling')) as todo,
        count(*) filter (where wo.status in ('working', 'awaiting_acceptance') and (wo.appointment_at is null or wo.appointment_at >= now())) as doing,
        count(*) filter (where wo.status in ('working', 'awaiting_acceptance') and wo.appointment_at < now()) as doing_overdue,
        count(*) filter (where wo.status in ('completed', 'awaiting_payment', 'paid', 'debt') and (wo.appointment_at is null or wo.updated_at <= wo.appointment_at)) as done,
        count(*) filter (where wo.status in ('completed', 'awaiting_payment', 'paid', 'debt') and wo.appointment_at is not null and wo.updated_at > wo.appointment_at) as done_overdue,
        count(*) filter (where wo.status = 'paused') as paused,
        count(*) filter (where wo.status = 'cancelled') as cancelled,
        count(*) filter (where wo.status::text not in (
          'pending_assignment', 'assigned', 'accepted', 'traveling',
          'working', 'awaiting_acceptance',
          'completed', 'awaiting_payment', 'paid', 'debt',
          'paused', 'cancelled'
        )) as other,
        coalesce(sum(p.total_amount) filter (
          where p.status = 'paid' and p.confirmed_at >= $${todayStartParam} and p.confirmed_at < $${todayEndParam}
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
