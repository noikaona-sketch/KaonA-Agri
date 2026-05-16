-- Migration: add seed_variety_id FK + product_code to products
-- seed_variety_id: FK to seed_varieties, nullable (required only when product_type=seed AND is_active=true)
-- product_code: human-readable code e.g. SEED-789, optional

alter table public.products
  add column if not exists seed_variety_id uuid
    references public.seed_varieties(id) on delete set null,
  add column if not exists product_code text;

create index if not exists idx_products_seed_variety_id
  on public.products(seed_variety_id)
  where seed_variety_id is not null;

create unique index if not exists idx_products_product_code
  on public.products(product_code)
  where product_code is not null and deleted_at is null;

comment on column public.products.seed_variety_id is
  'FK to seed_varieties — required when product_type=seed AND is_active=true';
comment on column public.products.product_code is
  'Human-readable code e.g. SEED-789 — optional, unique among non-deleted products';
