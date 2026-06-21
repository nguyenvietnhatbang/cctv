alter table work_orders
  add column if not exists material_cost numeric(12, 2) not null default 0
  check (material_cost >= 0);

update work_orders wo
set material_cost = coalesce(
  (
    select p.material_amount
    from payments p
    where p.work_order_id = wo.id
  ),
  (
    select sum(wom.line_total)
    from work_order_materials wom
    where wom.work_order_id = wo.id
  ),
  0
);

delete from work_order_materials
where name = 'Vật tư (nhập nhanh)';

update payments p
set material_amount = wo.material_cost,
    labor_amount = wo.labor_cost,
    vat_amount = round((wo.labor_cost + wo.material_cost) * wo.vat_rate / 100, 2),
    total_amount = wo.labor_cost + wo.material_cost
      + round((wo.labor_cost + wo.material_cost) * wo.vat_rate / 100, 2),
    debt_amount = greatest(
      wo.labor_cost + wo.material_cost
        + round((wo.labor_cost + wo.material_cost) * wo.vat_rate / 100, 2)
        - p.paid_amount,
      0
    )
from work_orders wo
where p.work_order_id = wo.id;
