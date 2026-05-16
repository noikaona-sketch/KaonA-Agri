-- Fix: seed_variety_id ไม่มีใน products — ใช้ seed_variety (text) แทน
-- products.seed_variety = text snapshot เช่น "NK48"
-- ไม่มี FK ไป seed_varieties จาก products table

create or replace view public.admin_seed_reservations as
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
  -- member
  m.full_name  as member_name,
  m.phone      as member_phone,
  -- product master
  p.name       as product_name,
  p.category   as product_category,
  p.unit       as product_unit,
  p.seed_variety as variety_name,   -- text column, not FK
  p.crop_type  as crop_type,
  -- legacy snapshot fallback
  sr.variety_name  as variety_name_snapshot,
  sr.supplier_name,
  -- sale ref
  sr.sale_order_id
from public.seed_reservations sr
join  public.members  m on m.id = sr.member_id
left join public.products p on p.id = sr.product_id
order by sr.created_at desc;
