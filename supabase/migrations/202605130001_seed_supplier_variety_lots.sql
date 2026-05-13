-- Migration: Seed Supplier / Variety / Stock Lot
-- Extracted concepts from K_farm — adapted for KaonA-Agri (Next.js + Supabase RLS)

-- ── 1. seed_suppliers ────────────────────────────────────────────────
create table if not exists public.seed_suppliers (
  id            uuid primary key default gen_random_uuid(),
  supplier_name text not null,
  contact_name  text,
  phone         text,
  address       text,
  credit_terms  text,                          -- 'เงินสด' | 'เครดิต 15 วัน' ฯลฯ
  active_status text not null default 'active'
    check (active_status in ('active','inactive')),
  note          text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists idx_seed_suppliers_active on public.seed_suppliers(active_status);

create trigger trg_seed_suppliers_updated_at
before update on public.seed_suppliers
for each row execute function public.set_updated_at();

-- ── 2. seed_varieties ────────────────────────────────────────────────
create table if not exists public.seed_varieties (
  id               uuid primary key default gen_random_uuid(),
  supplier_id      uuid references public.seed_suppliers(id) on delete set null,
  variety_name     text not null,
  crop_type        text not null default 'ข้าวโพด',

  -- ข้อมูลเมล็ด
  days_to_harvest  int,                         -- วันถึงเก็บเกี่ยว
  seed_per_rai_kg  numeric(8,2),                -- กก.เมล็ด/ไร่
  yield_per_rai    numeric(8,2),                -- ตัน/ไร่ เฉลี่ย
  planting_spacing text,                        -- '75×25 ซม.'
  season           text,                        -- 'ต้นฝน / ปลายฝน'

  -- ราคา/น้ำหนัก
  bag_weight_kg    numeric(8,2) default 1,      -- น้ำหนักต่อถุง
  price_per_bag    numeric(12,2),               -- ราคาต่อถุง (auto-fill ลงใน lot)

  -- คู่มือ
  planting_guide   text,
  fertilizer_guide text,
  pest_guide       text,
  notes            text,

  -- flags
  active_status    text not null default 'active'
    check (active_status in ('active','inactive')),
  show_to_farmer   boolean not null default true,  -- แสดงในมือถือสมาชิก

  sort_order       int not null default 0,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists idx_seed_varieties_supplier on public.seed_varieties(supplier_id);
create index if not exists idx_seed_varieties_active   on public.seed_varieties(active_status, show_to_farmer);

create trigger trg_seed_varieties_updated_at
before update on public.seed_varieties
for each row execute function public.set_updated_at();

-- ── 3. seed_stock_lots ───────────────────────────────────────────────
-- lot-based stock intake — ไม่ตัด stock จาก client โดยตรง
create table if not exists public.seed_stock_lots (
  id               uuid primary key default gen_random_uuid(),
  variety_id       uuid not null references public.seed_varieties(id) on delete restrict,
  supplier_id      uuid references public.seed_suppliers(id) on delete set null,

  -- snapshot ณ ตอนรับสินค้า
  variety_name     text not null,
  supplier_name    text,

  -- lot info
  lot_no           text not null,               -- เลข LOT จากผู้ผลิต
  received_date    date not null default current_date,

  -- ปริมาณ
  quantity_in      numeric(12,2) not null check (quantity_in > 0),  -- จำนวนรับเข้า
  quantity_balance numeric(12,2) not null,                          -- คงเหลือ (server-managed)
  bag_weight_kg    numeric(8,2) not null default 1,
  total_weight_kg  numeric(12,2) generated always as (quantity_in * bag_weight_kg) stored,

  -- ราคา
  price_per_bag    numeric(12,2) not null,
  total_cost       numeric(14,2) generated always as (quantity_in * price_per_bag) stored,

  -- สถานะ
  status           text not null default 'available'
    check (status in ('available','low','depleted','inactive')),

  -- auto-update status เมื่อ quantity_balance เปลี่ยน
  note             text,
  created_by       uuid references public.members(id),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),

  constraint uq_lot_no unique (variety_id, lot_no)
);

create index if not exists idx_seed_lots_variety on public.seed_stock_lots(variety_id);
create index if not exists idx_seed_lots_status  on public.seed_stock_lots(status);
create index if not exists idx_seed_lots_date    on public.seed_stock_lots(received_date desc);

create trigger trg_seed_lots_updated_at
before update on public.seed_stock_lots
for each row execute function public.set_updated_at();

-- auto-update lot status เมื่อ balance เปลี่ยน
create or replace function public.sync_lot_status()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  new.status :=
    case
      when new.quantity_balance <= 0                        then 'depleted'
      when new.quantity_balance <= new.quantity_in * 0.1   then 'low'
      else 'available'
    end;
  return new;
end;
$$;

create trigger trg_sync_lot_status
before update of quantity_balance on public.seed_stock_lots
for each row execute function public.sync_lot_status();

-- ── 4. RPC: decrement_lot_balance ────────────────────────────────────
-- เรียกจาก API route เท่านั้น — ไม่เปิดให้ client เรียกตรง
create or replace function public.decrement_lot_balance(
  p_lot_id    uuid,
  p_qty       numeric,
  p_ref_type  text default 'sale_order',
  p_ref_id    uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_lot    record;
  v_new_bal numeric;
begin
  select * into v_lot
  from public.seed_stock_lots
  where id = p_lot_id
  for update;

  if v_lot is null then
    raise exception 'ไม่พบ lot: %', p_lot_id;
  end if;

  if v_lot.status = 'inactive' then
    raise exception 'LOT นี้ถูกยกเลิกแล้ว';
  end if;

  if v_lot.quantity_balance < p_qty then
    raise exception 'สต๊อกไม่เพียงพอ: มี % ถุง แต่ต้องการ % ถุง',
      v_lot.quantity_balance, p_qty;
  end if;

  v_new_bal := v_lot.quantity_balance - p_qty;

  update public.seed_stock_lots
  set quantity_balance = v_new_bal, updated_at = now()
  where id = p_lot_id;

  return jsonb_build_object(
    'lot_id',        p_lot_id,
    'lot_no',        v_lot.lot_no,
    'qty_deducted',  p_qty,
    'balance_after', v_new_bal,
    'status_after',  case
      when v_new_bal <= 0                       then 'depleted'
      when v_new_bal <= v_lot.quantity_in * 0.1 then 'low'
      else 'available'
    end
  );
end;
$$;

-- service_role เท่านั้น (เรียกจาก API route)
grant execute on function public.decrement_lot_balance(uuid, numeric, text, uuid) to service_role;

-- ── 5. views ─────────────────────────────────────────────────────────
-- สำหรับ admin stock status
create or replace view public.admin_seed_lot_status as
select
  sl.id, sl.lot_no, sl.received_date, sl.status,
  sl.quantity_in, sl.quantity_balance,
  sl.bag_weight_kg, sl.total_weight_kg,
  sl.price_per_bag, sl.total_cost,
  sl.note,
  sv.variety_name, sv.crop_type, sv.days_to_harvest,
  ss.supplier_name, ss.phone as supplier_phone,
  round((sl.quantity_balance::numeric / nullif(sl.quantity_in,0)) * 100, 1) as balance_pct
from public.seed_stock_lots sl
join public.seed_varieties sv on sv.id = sl.variety_id
left join public.seed_suppliers ss on ss.id = sl.supplier_id
where sl.status != 'inactive'
order by sl.status = 'available' desc, sl.received_date desc;

-- สำหรับสมาชิกดูพันธุ์เมล็ด
create or replace view public.member_seed_variety_catalog as
select
  sv.id, sv.variety_name, sv.crop_type,
  sv.days_to_harvest, sv.seed_per_rai_kg, sv.yield_per_rai,
  sv.planting_spacing, sv.season, sv.bag_weight_kg,
  sv.price_per_bag, sv.planting_guide, sv.fertilizer_guide,
  sv.notes, sv.sort_order,
  ss.supplier_name,
  -- stock คงเหลือรวม (นับเฉพาะ available lots)
  coalesce(
    (select sum(sl.quantity_balance)
     from public.seed_stock_lots sl
     where sl.variety_id = sv.id and sl.status = 'available'), 0
  ) as stock_available,
  -- มีสต๊อกไหม
  exists(
    select 1 from public.seed_stock_lots sl
    where sl.variety_id = sv.id and sl.status = 'available'
      and sl.quantity_balance > 0
  ) as in_stock
from public.seed_varieties sv
left join public.seed_suppliers ss on ss.id = sv.supplier_id
where sv.active_status = 'active'
  and sv.show_to_farmer = true
order by sv.sort_order, sv.crop_type, sv.variety_name;

-- ── 6. RLS ────────────────────────────────────────────────────────────
alter table public.seed_suppliers    enable row level security;
alter table public.seed_varieties    enable row level security;
alter table public.seed_stock_lots   enable row level security;

-- suppliers: ทุกคนอ่านได้ (ข้อมูล supplier เป็น public)
create policy seed_suppliers_select on public.seed_suppliers
  for select using (true);
create policy seed_suppliers_manage on public.seed_suppliers
  for all using (public.current_member_has_role('admin') or public.current_member_has_role('staff'));

-- varieties: สมาชิกเห็นเฉพาะ active+show_to_farmer
create policy seed_varieties_member_select on public.seed_varieties
  for select using (
    (active_status = 'active' and show_to_farmer = true)
    or public.current_member_has_role('admin')
    or public.current_member_has_role('staff')
  );
create policy seed_varieties_manage on public.seed_varieties
  for all using (public.current_member_has_role('admin') or public.current_member_has_role('staff'));

-- lots: admin/staff เท่านั้น (สมาชิกเห็นผ่าน view เท่านั้น)
create policy seed_lots_admin_only on public.seed_stock_lots
  for all using (
    public.current_member_has_role('admin')
    or public.current_member_has_role('staff')
  );
