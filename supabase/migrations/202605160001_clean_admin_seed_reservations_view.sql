-- Migration: Clean admin_seed_reservations view — product_id based (no lot JOIN)
-- ยกเลิก lot_no / lot_balance / seed_stock_lots dependency

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
  -- product master (new path)
  p.name       as product_name,
  p.category   as product_category,
  p.unit       as product_unit,
  -- seed metadata via variety link (optional)
  sv.variety_name,
  sv.crop_type,
  -- legacy snapshot columns (fallback)
  sr.variety_name  as variety_name_snapshot,
  sr.supplier_name,
  -- sale ref
  sr.sale_order_id
from public.seed_reservations sr
join  public.members m  on m.id  = sr.member_id
left join public.products p  on p.id  = sr.product_id
left join public.seed_varieties sv on sv.id = p.seed_variety_id
order by sr.created_at desc;
