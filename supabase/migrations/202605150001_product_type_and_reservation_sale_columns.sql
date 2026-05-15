-- Idempotent compatibility columns for product-centric POS/reservation flow
alter table if exists public.products
  add column if not exists product_type text;

alter table if exists public.products
  drop constraint if exists chk_products_product_type;

alter table if exists public.products
  add constraint chk_products_product_type
  check (product_type is null or product_type in ('seed','fertilizer','chemical','other'));

update public.products
set product_type = case
  when lower(coalesce(category, '')) like '%seed%' or lower(coalesce(category, '')) like '%เมล็ด%' then 'seed'
  when lower(coalesce(category, '')) like '%fert%' or lower(coalesce(category, '')) like '%ปุ๋ย%' then 'fertilizer'
  when lower(coalesce(category, '')) like '%chem%' or lower(coalesce(category, '')) like '%สาร%' then 'chemical'
  else 'other'
end
where product_type is null;

alter table if exists public.sale_orders
  add column if not exists source_type text;

alter table if exists public.sale_orders
  add column if not exists reservation_id uuid;

alter table if exists public.sale_orders
  drop constraint if exists chk_sale_orders_source_type;

alter table if exists public.sale_orders
  add constraint chk_sale_orders_source_type
  check (source_type is null or source_type in ('walk_in','reservation'));

alter table if exists public.order_items
  add column if not exists product_name_snapshot text;
