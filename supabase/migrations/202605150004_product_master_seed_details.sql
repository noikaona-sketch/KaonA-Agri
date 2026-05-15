-- #179 Product Master: seed details + bag weight
alter table public.products
  add column if not exists bag_weight_kg numeric(10,2);

alter table public.products
  drop constraint if exists products_bag_weight_kg_positive;

alter table public.products
  add constraint products_bag_weight_kg_positive
  check (bag_weight_kg is null or bag_weight_kg > 0);
