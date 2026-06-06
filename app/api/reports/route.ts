import { requireUser } from "@/lib/auth";
import { query } from "@/lib/db";
import { handleRouteError, jsonOk } from "@/lib/http";
import { todayInVietnam } from "@/components/ops/format";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    await requireUser(["admin", "dispatcher", "accountant"]);
    const { searchParams } = new URL(request.url);
    const today = todayInVietnam();
    const from = searchParams.get("from") || today;
    const to = searchParams.get("to") || today;

    const [summary, byStatus, byTechnician, materials] = await Promise.all([
      query(
        `select
           count(*) as order_count,
           coalesce(sum(p.total_amount) filter (where p.status = 'paid'), 0) as paid_revenue,
           coalesce(sum(p.total_amount) filter (where p.status = 'debt'), 0) as open_debt,
           coalesce(sum(p.total_amount), 0) as gross_amount
         from work_orders wo
         left join payments p on p.work_order_id = wo.id
         where (wo.created_at at time zone 'Asia/Ho_Chi_Minh')::date between $1::date and $2::date`,
        [from, to],
      ),
      query(
        `select wo.status, count(*) as count
         from work_orders wo
         where (wo.created_at at time zone 'Asia/Ho_Chi_Minh')::date between $1::date and $2::date
         group by wo.status
         order by count desc`,
        [from, to],
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
         where (wo.created_at at time zone 'Asia/Ho_Chi_Minh')::date between $1::date and $2::date
         group by u.full_name
         order by order_count desc`,
        [from, to],
      ),
      query(
        `select wom.name, sum(wom.quantity) as quantity, sum(wom.line_total) as total_amount
         from work_order_materials wom
         join work_orders wo on wo.id = wom.work_order_id
         where (wo.created_at at time zone 'Asia/Ho_Chi_Minh')::date between $1::date and $2::date
         group by wom.name
         order by total_amount desc
         limit 50`,
        [from, to],
      ),
    ]);

    return jsonOk({
      range: { from, to },
      summary: summary.rows[0],
      byStatus: byStatus.rows,
      byTechnician: byTechnician.rows,
      materials: materials.rows,
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
