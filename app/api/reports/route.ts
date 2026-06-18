import { requireUser } from "@/lib/auth";
import { todayInVietnam, vietnamDateRangeUtc } from "@/lib/date-ranges";
import { query } from "@/lib/db";
import { handleRouteError, jsonOk } from "@/lib/http";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    await requireUser(["admin", "dispatcher", "accountant"]);
    const { searchParams } = new URL(request.url);
    const today = todayInVietnam();
    const from = searchParams.get("from") || today;
    const to = searchParams.get("to") || today;
    const range = vietnamDateRangeUtc(from, to);
    const params = [from, to, range.start, range.end];

    const [summary, byDisplayStatus, daily, byStatus, byTechnician, materials] = await Promise.all([
      query(
        `select
           count(*) as order_count,
           coalesce(sum(p.total_amount) filter (where p.status = 'paid'), 0) as paid_revenue,
           coalesce(sum(p.total_amount) filter (where p.status = 'debt'), 0) as open_debt,
           coalesce(sum(p.total_amount), 0) as gross_amount
         from work_orders wo
         left join payments p on p.work_order_id = wo.id
         where wo.created_at >= $3 and wo.created_at < $4`,
        params,
      ),
      query(
        `with scoped as (
           select wo.*
           from work_orders wo
           where wo.created_at >= $3 and wo.created_at < $4
         ),
         buckets as (
           select 'todo' as status, 'Việc chưa làm' as label,
                  count(*) filter (where status in ('pending_assignment', 'assigned', 'accepted', 'traveling')) as count
           from scoped
           union all
           select 'doing', 'Đang làm',
                  count(*) filter (where status in ('working', 'awaiting_acceptance') and (appointment_at is null or appointment_at >= now()))
           from scoped
           union all
           select 'doing_overdue', 'Đang làm quá hạn',
                  count(*) filter (where status in ('working', 'awaiting_acceptance') and appointment_at < now())
           from scoped
           union all
           select 'done', 'Hoàn thành',
                  count(*) filter (where status in ('completed', 'awaiting_payment', 'paid', 'debt') and (appointment_at is null or updated_at <= appointment_at))
           from scoped
           union all
           select 'done_overdue', 'Hoàn thành quá hạn',
                  count(*) filter (where status in ('completed', 'awaiting_payment', 'paid', 'debt') and appointment_at is not null and updated_at > appointment_at)
           from scoped
           union all
           select 'paused', 'Việc tạm dừng',
                  count(*) filter (where status = 'paused')
           from scoped
           union all
           select 'cancelled', 'Việc đã hủy',
                  count(*) filter (where status = 'cancelled')
           from scoped
           union all
           select 'other', 'Khác',
                  count(*) filter (where status::text not in (
                    'pending_assignment', 'assigned', 'accepted', 'traveling',
                    'working', 'awaiting_acceptance',
                    'completed', 'awaiting_payment', 'paid', 'debt',
                    'paused', 'cancelled'
                  ))
           from scoped
         ),
         totals as (
           select count(*) as total from scoped
         )
         select b.status, b.label, b.count, t.total,
                case when t.total = 0 then 0 else round(b.count * 100.0 / t.total, 1) end as percent
         from buckets b cross join totals t
         order by case b.status
           when 'todo' then 1
           when 'doing' then 2
           when 'doing_overdue' then 3
           when 'done' then 4
           when 'done_overdue' then 5
           when 'paused' then 6
           when 'cancelled' then 7
           when 'other' then 8
           else 9
         end`,
        params,
      ),
      query(
        `with days as (
           select generate_series($1::date, $2::date, interval '1 day')::date as day
         ),
         created_orders as (
           select (wo.created_at at time zone 'Asia/Ho_Chi_Minh')::date as day,
                  count(*) as created_count
           from work_orders wo
           where wo.created_at >= $3 and wo.created_at < $4
           group by 1
         ),
         completed_orders as (
           select (wo.updated_at at time zone 'Asia/Ho_Chi_Minh')::date as day,
                  count(*) as completed_count
           from work_orders wo
           where wo.status in ('completed', 'awaiting_payment', 'paid', 'debt')
             and wo.updated_at >= $3 and wo.updated_at < $4
           group by 1
         ),
         paid as (
           select (p.confirmed_at at time zone 'Asia/Ho_Chi_Minh')::date as day,
                  coalesce(sum(p.total_amount) filter (where p.status = 'paid'), 0) as paid_revenue,
                  coalesce(sum(p.total_amount) filter (where p.status = 'debt'), 0) as open_debt
           from payments p
           where p.confirmed_at is not null
             and p.confirmed_at >= $3 and p.confirmed_at < $4
           group by 1
         )
         select d.day::text as date,
                coalesce(co.created_count, 0) as created_count,
                coalesce(c.completed_count, 0) as completed_count,
                coalesce(p.paid_revenue, 0) as paid_revenue,
                coalesce(p.open_debt, 0) as open_debt
         from days d
         left join created_orders co on co.day = d.day
         left join completed_orders c on c.day = d.day
         left join paid p on p.day = d.day
         order by d.day`,
        params,
      ),
      query(
        `select wo.status, count(*) as count
         from work_orders wo
         where wo.created_at >= $3 and wo.created_at < $4
         group by wo.status
         order by count desc`,
        params,
      ),
      query(
        `select coalesce(u.full_name, 'Chưa phân công') as technician_name,
                count(wo.id) as order_count,
                coalesce(sum(p.total_amount) filter (where p.status = 'paid'), 0) as paid_revenue
         from work_orders wo
         left join work_order_assignments woa on woa.work_order_id = wo.id and woa.unassigned_at is null
         left join technicians t on t.id = woa.technician_id
         left join users u on u.id = t.user_id
         left join payments p on p.work_order_id = wo.id
         where wo.created_at >= $3 and wo.created_at < $4
         group by u.full_name
         order by order_count desc`,
        params,
      ),
      query(
        `select wom.name, sum(wom.quantity) as quantity, sum(wom.line_total) as total_amount
         from work_order_materials wom
         join work_orders wo on wo.id = wom.work_order_id
         where wo.created_at >= $3 and wo.created_at < $4
         group by wom.name
         order by total_amount desc
         limit 50`,
        params,
      ),
    ]);

    return jsonOk({
      range: { from, to },
      summary: summary.rows[0],
      byDisplayStatus: byDisplayStatus.rows,
      daily: daily.rows,
      byStatus: byStatus.rows,
      byTechnician: byTechnician.rows,
      materials: materials.rows,
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
