import { requireUser } from "@/lib/auth";
import { todayInVietnam, vietnamDateRangeUtc } from "@/lib/date-ranges";
import { query } from "@/lib/db";
import { handleRouteError, HttpError, jsonOk } from "@/lib/http";
import { OPS_MANAGER_ROLES } from "@/lib/types";
import { hasPermission } from "@/lib/permissions";
import { z } from "zod";

export const runtime = "nodejs";

const MAX_RANGE_DAYS = 366;

const technicianIdSchema = z.string().uuid();

export async function GET(request: Request) {
  try {
    const user = await requireUser(OPS_MANAGER_ROLES);
    if (!await hasPermission(user.role, "technicians.view_performance")) {
      throw new HttpError(403, "Bạn không có quyền xem hiệu suất kỹ thuật viên");
    }
    const { searchParams } = new URL(request.url);
    const today = todayInVietnam();
    const from = searchParams.get("from") || today;
    const to = searchParams.get("to") || today;
    const range = vietnamDateRangeUtc(from, to);
    const rangeDays = Math.round((range.end.getTime() - range.start.getTime()) / 86_400_000);
    if (rangeDays > MAX_RANGE_DAYS) throw new HttpError(422, `Khoảng ngày không được vượt quá ${MAX_RANGE_DAYS} ngày`);

    const requestedTechnicianId = searchParams.get("technicianId");
    const technicianId = requestedTechnicianId ? technicianIdSchema.parse(requestedTechnicianId) : null;
    const params = [range.start, range.end, technicianId];

    const performance = await query(
      `with active_counts as (
         select work_order_id, count(*)::numeric as count
         from work_order_assignments
         where unassigned_at is null
         group by work_order_id
       ),
       tech_collected as (
         select
           woa.technician_id,
           coalesce(sum(pt.amount / coalesce(ac.count, 1)), 0) as paid_revenue
         from payment_transactions pt
         join work_order_assignments woa on woa.work_order_id = pt.work_order_id and woa.unassigned_at is null
         left join active_counts ac on ac.work_order_id = pt.work_order_id
         where pt.collected_at >= $1 and pt.collected_at < $2
           and ($3::uuid is null or woa.technician_id = $3)
         group by woa.technician_id
       ),
       tech_settled as (
         select
           woa.technician_id,
           coalesce(sum(p.labor_amount / coalesce(ac.count, 1)), 0) as labor_amount,
           coalesce(sum(p.material_amount / coalesce(ac.count, 1)), 0) as material_amount
         from payments p
         join work_order_assignments woa on woa.work_order_id = p.work_order_id and woa.unassigned_at is null
         left join active_counts ac on ac.work_order_id = p.work_order_id
         where p.confirmed_at >= $1 and p.confirmed_at < $2
           and ($3::uuid is null or woa.technician_id = $3)
         group by woa.technician_id
       ),
       scoped_assignments as (
         select assignment.id as assignment_id, assignment.technician_id, assignment.work_order_id,
                assignment.check_in_at, work_order.status, work_order.code,
                customer.name as customer_name,
                (
                  coalesce(work_order.accepted_at, work_order.updated_at) >= $1
                  and coalesce(work_order.accepted_at, work_order.updated_at) < $2
                  and work_order.status in ('awaiting_acceptance', 'completed', 'awaiting_payment', 'paid', 'debt')
                ) as is_completed_in_range
         from work_order_assignments assignment
         join work_orders work_order on work_order.id = assignment.work_order_id
         join customers customer on customer.id = work_order.customer_id
         left join payments payment on payment.work_order_id = work_order.id
         left join payment_transactions pt on pt.work_order_id = work_order.id
         where assignment.unassigned_at is null
           and ($3::uuid is null or assignment.technician_id = $3)
           and (
             (work_order.created_at >= $1 and work_order.created_at < $2)
             or (coalesce(work_order.accepted_at, work_order.updated_at) >= $1 and coalesce(work_order.accepted_at, work_order.updated_at) < $2 and work_order.status in ('completed', 'awaiting_payment', 'paid', 'debt'))
             or (payment.confirmed_at >= $1 and payment.confirmed_at < $2)
             or (pt.collected_at >= $1 and pt.collected_at < $2)
             or exists (
               select 1 from work_order_field_sessions fs
               where fs.assignment_id = assignment.id
                 and fs.check_in_at < $2 and coalesce(fs.check_out_at, now()) > $1
             )
           )
       ),
       recorded_time as (
         select session.assignment_id,
                sum(greatest(0, extract(epoch from (least(coalesce(session.check_out_at, $2::timestamptz), $2::timestamptz) - greatest(session.check_in_at, $1::timestamptz))) / 60)) as minutes
         from work_order_field_sessions session
         join scoped_assignments assignment on assignment.assignment_id = session.assignment_id
         where session.check_in_at < $2 and coalesce(session.check_out_at, $2::timestamptz) > $1
         group by session.assignment_id
       ),
       estimated_time as (
         select assignment.assignment_id,
                greatest(0, extract(epoch from (least(coalesce(end_history.changed_at, $2::timestamptz), $2::timestamptz) - greatest(assignment.check_in_at, $1::timestamptz))) / 60) as minutes
         from scoped_assignments assignment
         left join recorded_time on recorded_time.assignment_id = assignment.assignment_id
         left join lateral (
           select history.changed_at
           from work_order_status_history history
           where history.work_order_id = assignment.work_order_id
             and history.changed_at >= assignment.check_in_at
             and history.to_status in ('awaiting_acceptance', 'paused', 'completed', 'cancelled')
           order by history.changed_at
           limit 1
         ) end_history on true
         where recorded_time.assignment_id is null and assignment.check_in_at is not null
       )
       select technician.id, technician.user_id, user_account.full_name, user_account.phone, user_account.email,
              technician.service_area, technician.status, technician.jobs_today,
              count(distinct assignment.work_order_id) as order_count,
              count(distinct assignment.work_order_id) filter (where assignment.is_completed_in_range) as completed_count,
              count(distinct assignment.work_order_id) filter (where assignment.status = 'working') as doing_count,
              count(distinct assignment.work_order_id) filter (where assignment.status = 'paused') as paused_count,
              coalesce(tc.paid_revenue, 0) as paid_revenue,
              coalesce(ts.labor_amount, 0) as labor_amount,
              coalesce(ts.material_amount, 0) as material_amount,
              coalesce(sum(recorded_time.minutes), 0) as recorded_minutes,
              coalesce(sum(estimated_time.minutes), 0) as estimated_minutes
       from (
         select t.id, t.user_id, t.service_area, t.status,
                count(assignment.id) filter (where order_item.appointment_at is not null and (order_item.appointment_at at time zone 'Asia/Ho_Chi_Minh')::date = timezone('Asia/Ho_Chi_Minh', now())::date and assignment.unassigned_at is null) as jobs_today
         from technicians t
         left join work_order_assignments assignment on assignment.technician_id = t.id
         left join work_orders order_item on order_item.id = assignment.work_order_id
         group by t.id
       ) technician
       join users user_account on user_account.id = technician.user_id and user_account.status = 'active'
       left join scoped_assignments assignment on assignment.technician_id = technician.id
       left join tech_collected tc on tc.technician_id = technician.id
       left join tech_settled ts on ts.technician_id = technician.id
       left join recorded_time on recorded_time.assignment_id = assignment.assignment_id
       left join estimated_time on estimated_time.assignment_id = assignment.assignment_id
       where ($3::uuid is null or technician.id = $3)
       group by technician.id, technician.user_id, technician.service_area, technician.status, technician.jobs_today, user_account.id, tc.paid_revenue, ts.labor_amount, ts.material_amount
       order by completed_count desc, order_count desc, user_account.full_name`,
      params,
    );

    const details = technicianId ? await query(
      `select assignment.work_order_id, assignment.code, assignment.customer_name, assignment.status,
              coalesce(recorded.minutes, 0) as recorded_minutes, coalesce(estimated.minutes, 0) as estimated_minutes
       from (
         select distinct assignment.id as assignment_id, assignment.work_order_id, work_order.code, customer.name as customer_name, work_order.status, assignment.check_in_at
         from work_order_assignments assignment
         join work_orders work_order on work_order.id = assignment.work_order_id
         join customers customer on customer.id = work_order.customer_id
         left join payments payment on payment.work_order_id = work_order.id
         left join payment_transactions pt on pt.work_order_id = work_order.id
         where assignment.technician_id = $3 and assignment.unassigned_at is null
           and (
             (work_order.created_at >= $1 and work_order.created_at < $2)
             or (coalesce(work_order.accepted_at, work_order.updated_at) >= $1 and coalesce(work_order.accepted_at, work_order.updated_at) < $2 and work_order.status in ('completed', 'awaiting_payment', 'paid', 'debt'))
             or (payment.confirmed_at >= $1 and payment.confirmed_at < $2)
             or (pt.collected_at >= $1 and pt.collected_at < $2)
             or exists (
               select 1 from work_order_field_sessions fs
               where fs.assignment_id = assignment.id
                 and fs.check_in_at < $2 and coalesce(fs.check_out_at, now()) > $1
             )
           )
       ) assignment
       left join lateral (
         select sum(greatest(0, extract(epoch from (least(coalesce(session.check_out_at, $2::timestamptz), $2::timestamptz) - greatest(session.check_in_at, $1::timestamptz))) / 60)) as minutes
         from work_order_field_sessions session where session.assignment_id = assignment.assignment_id and session.check_in_at < $2 and coalesce(session.check_out_at, $2::timestamptz) > $1
       ) recorded on true
       left join lateral (
         select greatest(0, extract(epoch from (least(coalesce(history.changed_at, $2::timestamptz), $2::timestamptz) - greatest(assignment.check_in_at, $1::timestamptz))) / 60) as minutes
         from work_order_status_history history
         where recorded.minutes is null and assignment.check_in_at is not null and history.work_order_id = assignment.work_order_id and history.changed_at >= assignment.check_in_at and history.to_status in ('awaiting_acceptance', 'paused', 'completed', 'cancelled')
         order by history.changed_at limit 1
       ) estimated on true
       order by assignment.code`, params) : { rows: [] };

    return jsonOk({ range: { from, to }, technicians: performance.rows, workOrders: details.rows });
  } catch (error) {
    return handleRouteError(error);
  }
}
