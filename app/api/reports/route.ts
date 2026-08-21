import { requireUser } from "@/lib/auth";
import { todayInVietnam, vietnamDateRangeUtc } from "@/lib/date-ranges";
import { query } from "@/lib/db";
import { handleRouteError, HttpError, jsonOk } from "@/lib/http";

export const runtime = "nodejs";

const MAX_REPORT_RANGE_DAYS = 366;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

export async function GET(request: Request) {
  try {
    await requireUser(["admin", "dispatcher", "accountant"]);
    const { searchParams } = new URL(request.url);
    const today = todayInVietnam();
    const from = searchParams.get("from") || today;
    const to = searchParams.get("to") || today;
    const range = vietnamDateRangeUtc(from, to);
    const rangeDays = Math.round((range.end.getTime() - range.start.getTime()) / MS_PER_DAY);
    if (rangeDays > MAX_REPORT_RANGE_DAYS) {
      throw new HttpError(422, `Khoảng ngày báo cáo không được vượt quá ${MAX_REPORT_RANGE_DAYS} ngày`);
    }
    const rangeParams = [range.start, range.end];
    const dailyParams = [from, to, range.start, range.end];

    const [summary, byDisplayStatus, daily, byStatus, byTechnician, materials] = await Promise.all([
      query(
        `select
           (
             select count(*)
             from work_orders wo
             where wo.created_at >= $1 and wo.created_at < $2
           ) as order_count,
           (
             select coalesce(sum(pt.amount), 0)
             from payment_transactions pt
             where pt.collected_at >= $1 and pt.collected_at < $2
           ) as paid_revenue,
           (
             select coalesce(sum(p.debt_amount), 0)
             from payments p
             where p.confirmed_at >= $1 and p.confirmed_at < $2
               and p.debt_amount > 0
           ) as open_debt,
           (
             select coalesce(sum(p.labor_amount), 0)
             from payments p
             where p.confirmed_at >= $1 and p.confirmed_at < $2
           ) as labor_amount,
           (
             select coalesce(sum(p.material_amount), 0)
             from payments p
             where p.confirmed_at >= $1 and p.confirmed_at < $2
           ) as material_amount,
           (
             select coalesce(sum(p.vat_amount), 0)
             from payments p
             where p.confirmed_at >= $1 and p.confirmed_at < $2
           ) as vat_amount,
           (
             select coalesce(sum(p.total_amount), 0)
             from payments p
             where p.confirmed_at >= $1 and p.confirmed_at < $2
           ) as gross_amount,
           (
             select coalesce(sum(pt.amount), 0)
             from payment_transactions pt
             where pt.collected_at >= $1 and pt.collected_at < $2
           ) as collected_amount`,
        rangeParams,
      ),
      query(
        `with scoped as (
           select wo.*
           from work_orders wo
           where wo.created_at >= $1 and wo.created_at < $2
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
        rangeParams,
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
           select (coalesce(wo.accepted_at, wo.updated_at) at time zone 'Asia/Ho_Chi_Minh')::date as day,
                  count(*) as completed_count
           from work_orders wo
           where wo.status in ('completed', 'awaiting_payment', 'paid', 'debt')
             and coalesce(wo.accepted_at, wo.updated_at) >= $3 and coalesce(wo.accepted_at, wo.updated_at) < $4
           group by 1
         ),
         paid as (
           select (pt.collected_at at time zone 'Asia/Ho_Chi_Minh')::date as day,
                  coalesce(sum(pt.amount), 0) as paid_revenue
           from payment_transactions pt
           where pt.collected_at >= $3 and pt.collected_at < $4
           group by 1
         ),
         debt as (
           select (p.confirmed_at at time zone 'Asia/Ho_Chi_Minh')::date as day,
                  coalesce(sum(p.debt_amount), 0) as open_debt
           from payments p
           where p.confirmed_at is not null
             and p.confirmed_at >= $3 and p.confirmed_at < $4
             and p.debt_amount > 0
           group by 1
         )
         select d.day::text as date,
                coalesce(co.created_count, 0) as created_count,
                coalesce(c.completed_count, 0) as completed_count,
                coalesce(p.paid_revenue, 0) as paid_revenue,
                coalesce(db.open_debt, 0) as open_debt
         from days d
         left join created_orders co on co.day = d.day
         left join completed_orders c on c.day = d.day
         left join paid p on p.day = d.day
         left join debt db on db.day = d.day
         order by d.day`,
        dailyParams,
      ),
      query(
        `select wo.status, count(*) as count
         from work_orders wo
         where wo.created_at >= $1 and wo.created_at < $2
         group by wo.status
         order by count desc`,
        rangeParams,
      ),
      query(
        `with active_counts as (
           select work_order_id, count(*)::numeric as count
           from work_order_assignments
           where unassigned_at is null
           group by work_order_id
         ),
         tech_collected as (
           select
             coalesce(u.full_name, 'Chưa phân công') as technician_name,
             woa.work_order_id,
             pt.amount / coalesce(ac.count, 1) as allocated_amount
           from payment_transactions pt
           left join work_order_assignments woa on woa.work_order_id = pt.work_order_id and woa.unassigned_at is null
           left join active_counts ac on ac.work_order_id = pt.work_order_id
           left join technicians t on t.id = woa.technician_id
           left join users u on u.id = t.user_id
           where pt.collected_at >= $1 and pt.collected_at < $2
         ),
         tech_orders as (
           select
             coalesce(u.full_name, 'Chưa phân công') as technician_name,
             woa.work_order_id
           from work_order_assignments woa
           join work_orders wo on wo.id = woa.work_order_id
           left join technicians t on t.id = woa.technician_id
           left join users u on u.id = t.user_id
           where woa.unassigned_at is null
             and (
               (wo.created_at >= $1 and wo.created_at < $2)
               or (coalesce(wo.accepted_at, wo.updated_at) >= $1 and coalesce(wo.accepted_at, wo.updated_at) < $2 and wo.status in ('completed', 'awaiting_payment', 'paid', 'debt'))
               or exists (select 1 from payment_transactions pt where pt.work_order_id = wo.id and pt.collected_at >= $1 and pt.collected_at < $2)
             )
         ),
         combined as (
           select
             coalesce(tc.technician_name, to_list.technician_name) as technician_name,
             coalesce(to_list.work_order_id, tc.work_order_id) as work_order_id,
             tc.allocated_amount
           from tech_collected tc
           full outer join tech_orders to_list
             on to_list.technician_name = tc.technician_name
            and to_list.work_order_id = tc.work_order_id
         )
         select
           technician_name,
           count(distinct work_order_id) as order_count,
           coalesce(sum(allocated_amount), 0) as paid_revenue
         from combined
         group by technician_name
         order by paid_revenue desc, order_count desc`,
        rangeParams,
      ),
      query(
        `select wom.name, sum(wom.quantity) as quantity, sum(wom.line_total) as total_amount
         from work_order_materials wom
         join work_orders wo on wo.id = wom.work_order_id
         join payments p on p.work_order_id = wo.id
         where p.confirmed_at >= $1 and p.confirmed_at < $2
         group by wom.name
         order by total_amount desc
         limit 50`,
        rangeParams,
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
