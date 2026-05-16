-- Fix: cannot alter view column order with CREATE OR REPLACE
-- Must DROP and recreate to add product_id column

drop view if exists public.admin_seed_reservations;

create view public.admin_seed_reservations as
select
  sr.id,
  sr.reservation_no,
  sr.status,
  sr.stock_deducted,
  sr.qty_reserved,
  sr.qty_received,
  sr.price_per_bag,
  sr.total_amount,
  sr.pickup_date,
  sr.note,
  sr.created_at,
  sr.product_id,
  m.full_name        as member_name,
  m.phone            as member_phone,
  p.name             as product_name,
  p.category         as product_category,
  p.unit             as product_unit,
  p.seed_variety     as variety_name,
  p.crop_type        as crop_type,
  sr.variety_name    as variety_name_snapshot,
  sr.supplier_name,
  sr.sale_order_id
from public.seed_reservations sr
join  public.members  m on m.id  = sr.member_id
left join public.products p on p.id = sr.product_id
order by sr.created_at desc;
