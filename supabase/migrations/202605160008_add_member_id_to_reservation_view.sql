-- Fix admin_seed_reservations view: expose member_id for POS member filter
drop view if exists public.admin_seed_reservations;

create view public.admin_seed_reservations as
select
  sr.id, sr.reservation_no, sr.status, sr.stock_deducted,
  sr.qty_reserved, sr.qty_received, sr.price_per_bag, sr.total_amount,
  sr.pickup_date, sr.note, sr.created_at,
  sr.product_id, sr.member_id,
  sr.source_channel, sr.attachment_url, sr.attachment_path,
  sr.qty_sold, sr.qty_remaining, sr.closed_at,
  m.full_name   as member_name,
  m.phone       as member_phone,
  p.name        as product_name,
  p.category    as product_category,
  p.unit        as product_unit,
  p.seed_variety as variety_name,
  p.crop_type,
  sr.variety_name  as variety_name_snapshot,
  sr.supplier_name,
  sr.sale_order_id
from public.seed_reservations sr
join  public.members  m on m.id  = sr.member_id
left join public.products p on p.id = sr.product_id
order by sr.created_at desc;
