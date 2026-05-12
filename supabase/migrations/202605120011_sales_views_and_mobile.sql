-- Migration: เชื่อม planting_cycles กับ products + mobile views

-- ── 1. เพิ่ม product_id ใน planting_cycles ───────────────────────────
alter table public.planting_cycles
  add column if not exists product_id uuid references public.products(id) on delete set null,
  add column if not exists seed_lot_number text,         -- เลข lot เมล็ด
  add column if not exists seed_qty_used numeric(12,2),  -- ปริมาณเมล็ดที่ใช้
  add column if not exists sale_order_id uuid references public.sale_orders(id) on delete set null;

-- ── 2. view: member_product_catalog ──────────────────────────────────
-- สำหรับมือถือสมาชิก — แสดงสินค้าที่สมาชิกสามารถเห็นและจองได้
create or replace view public.member_product_catalog as
select
  p.id,
  p.name,
  p.brand,
  p.category,
  p.description,
  p.unit,
  p.price_per_unit,
  p.seed_variety,
  p.crop_type,
  p.days_to_harvest,
  p.planting_guide,
  p.planting_spacing_cm,
  p.water_requirement,
  p.fertilizer_guide,
  p.stock_qty,
  p.is_low_stock,
  case when p.stock_qty > 0 then true else false end as in_stock,
  p.sort_order
from public.products p
where p.deleted_at is null
  and p.is_active = true
  and p.is_visible_to_members = true
order by p.sort_order, p.category, p.name;

-- ── 3. view: member_order_history ────────────────────────────────────
-- ประวัติสั่งซื้อของสมาชิก (ใช้ในมือถือ)
create or replace view public.member_order_history as
select
  so.id,
  so.order_number,
  so.order_type,
  so.status,
  so.payment_status,
  so.total,
  so.paid_amount,
  so.payment_method,
  so.pickup_date,
  so.reserved_until,
  so.note,
  so.created_at,
  so.member_id,
  coalesce(
    jsonb_agg(
      jsonb_build_object(
        'product_id',   oi.product_id,
        'product_name', oi.product_name,
        'qty',          oi.qty,
        'unit',         oi.product_unit,
        'unit_price',   oi.unit_price,
        'subtotal',     oi.subtotal
      ) order by oi.created_at
    ) filter (where oi.id is not null),
    '[]'::jsonb
  ) as items
from public.sale_orders so
left join public.order_items oi on oi.order_id = so.id
group by so.id;

-- ── 4. view: admin_stock_status ──────────────────────────────────────
-- สรุปสต๊อกสำหรับหลังบ้าน
create or replace view public.admin_stock_status as
select
  p.id,
  p.name,
  p.brand,
  p.category,
  p.unit,
  p.price_per_unit,
  p.stock_qty,
  p.min_stock_alert,
  p.is_low_stock,
  p.is_active,
  coalesce(sold.total_sold, 0) as total_sold_qty,
  coalesce(reserved.total_reserved, 0) as total_reserved_qty,
  p.updated_at
from public.products p
left join (
  select product_id, sum(qty) as total_sold
  from public.order_items oi
  join public.sale_orders so on so.id = oi.order_id
  where so.status = 'completed'
  group by product_id
) sold on sold.product_id = p.id
left join (
  select product_id, sum(qty) as total_reserved
  from public.order_items oi
  join public.sale_orders so on so.id = oi.order_id
  where so.status in ('pending','confirmed','ready')
    and so.order_type = 'reservation'
  group by product_id
) reserved on reserved.product_id = p.id
where p.deleted_at is null
order by p.is_low_stock desc, p.sort_order, p.name;

-- ── 5. function: get_low_stock_alerts ────────────────────────────────
create or replace function public.get_low_stock_alerts()
returns table (
  product_id uuid,
  product_name text,
  category text,
  stock_qty numeric,
  min_stock_alert numeric,
  reserved_qty numeric
)
language sql
stable
security definer
set search_path = public
as $$
  select
    p.id,
    p.name,
    p.category,
    p.stock_qty,
    p.min_stock_alert,
    coalesce(r.reserved, 0)
  from public.products p
  left join (
    select oi.product_id, sum(oi.qty) as reserved
    from public.order_items oi
    join public.sale_orders so on so.id = oi.order_id
    where so.status in ('pending','confirmed','ready')
    group by oi.product_id
  ) r on r.product_id = p.id
  where p.deleted_at is null
    and p.is_active = true
    and p.is_low_stock = true
  order by p.stock_qty asc;
$$;

grant execute on function public.get_low_stock_alerts() to authenticated;
grant execute on function public.get_low_stock_alerts() to service_role;

-- ── 6. function: get_sales_summary ───────────────────────────────────
create or replace function public.get_sales_summary(
  p_from date default (current_date - interval '30 days')::date,
  p_to   date default current_date
)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'total_orders',    count(*),
    'total_revenue',   coalesce(sum(total), 0),
    'total_paid',      coalesce(sum(paid_amount), 0),
    'pending_orders',  count(*) filter (where status in ('pending','confirmed','ready')),
    'sale_orders',     count(*) filter (where order_type = 'sale'),
    'reservations',    count(*) filter (where order_type = 'reservation')
  )
  from public.sale_orders
  where created_at::date between p_from and p_to;
$$;

grant execute on function public.get_sales_summary(date, date) to authenticated;
grant execute on function public.get_sales_summary(date, date) to service_role;
