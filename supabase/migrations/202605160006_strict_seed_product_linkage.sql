-- Migration: strict seed-product linkage
-- 1. products.seed_variety_id FK → seed_varieties
-- 2. products.product_code unique
-- 3. One active seed product per seed_variety_id (unique partial index)
-- 4. seed_reservations.seed_variety_id snapshot column
-- 5. Trigger: block product_id change after reservation created

-- ── products ──────────────────────────────────────────────────────────
alter table public.products
  add column if not exists seed_variety_id uuid
    references public.seed_varieties(id) on delete set null,
  add column if not exists product_code text;

create unique index if not exists idx_products_product_code_unique
  on public.products(product_code)
  where product_code is not null and deleted_at is null;

-- enforce: one active seed product per variety
create unique index if not exists idx_products_one_active_per_variety
  on public.products(seed_variety_id)
  where seed_variety_id is not null
    and is_active = true
    and deleted_at is null;

create index if not exists idx_products_seed_variety_id
  on public.products(seed_variety_id)
  where seed_variety_id is not null;

-- ── seed_reservations ─────────────────────────────────────────────────
alter table public.seed_reservations
  add column if not exists seed_variety_id uuid
    references public.seed_varieties(id) on delete set null;

-- ── trigger: block product_id change after reservation created ─────────
create or replace function public.prevent_reservation_product_change()
returns trigger language plpgsql security definer
set search_path = public as $$
begin
  if old.product_id is not null
    and new.product_id is distinct from old.product_id then
    raise exception
      'Cannot change product_id on reservation % after booking. Cancel and create a new reservation.',
      old.reservation_no;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_prevent_reservation_product_change
  on public.seed_reservations;

create trigger trg_prevent_reservation_product_change
before update on public.seed_reservations
for each row execute function public.prevent_reservation_product_change();
