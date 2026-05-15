-- #185 Connect seed reservations to Product Master seed products
alter table if exists public.seed_reservations
  add column if not exists product_id uuid references public.products(id) on delete set null;

create index if not exists idx_seed_reservations_product_id on public.seed_reservations(product_id);
