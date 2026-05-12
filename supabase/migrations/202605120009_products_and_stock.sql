-- Migration: ระบบสินค้า + สต๊อก
-- products: เมล็ดพันธุ์/ปุ๋ย/ยา/อุปกรณ์
-- stock_movements: รับ/จ่าย/ปรับสต๊อก

-- ── 1. products ──────────────────────────────────────────────────────
create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),

  -- ข้อมูลสินค้า
  name text not null,
  brand text,                           -- ชื่อผู้ขาย/ยี่ห้อ
  category text not null default 'seed'
    check (category in ('seed','fertilizer','pesticide','equipment','other')),
  description text,                     -- คำอธิบายทั่วไป

  -- ราคา
  unit text not null default 'kg'
    check (unit in ('kg','g','bag','bottle','box','piece','set','liter')),
  price_per_unit numeric(12,2) not null check (price_per_unit >= 0),

  -- เมล็ดพันธุ์เฉพาะ
  seed_variety text,                    -- พันธุ์ เช่น NK48, Pioneer P3482
  crop_type text,                       -- ชนิดพืช เช่น ข้าวโพด ข้าว
  days_to_harvest integer,              -- จำนวนวันจนถึงเก็บเกี่ยว
  seeds_per_unit integer,               -- เมล็ด/หน่วย (เช่น 80,000 เมล็ด/ถุง)
  expiry_months integer,                -- อายุการเก็บรักษา (เดือน)

  -- คำแนะนำการปลูก
  planting_guide text,                  -- วิธีปลูกโดยละเอียด
  planting_spacing_cm integer,          -- ระยะปลูก (ซม.)
  planting_depth_cm numeric(5,2),       -- ความลึกปลูก (ซม.)
  water_requirement text,               -- ความต้องการน้ำ
  fertilizer_guide text,                -- คำแนะนำปุ๋ย
  pest_disease_guide text,              -- โรค/แมลง และวิธีป้องกัน

  -- สต๊อก
  stock_qty numeric(12,2) not null default 0,
  stock_unit text not null default 'kg',
  min_stock_alert numeric(12,2) default 10,  -- แจ้งเตือนเมื่อต่ำกว่านี้
  is_low_stock boolean generated always as (stock_qty <= min_stock_alert) stored,

  -- สถานะ
  is_active boolean not null default true,
  is_visible_to_members boolean not null default true,  -- แสดงในมือถือสมาชิก
  sort_order integer not null default 0,

  -- metadata
  created_by uuid references public.members(id),
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_products_category on public.products(category) where deleted_at is null;
create index if not exists idx_products_active on public.products(is_active) where deleted_at is null;
create index if not exists idx_products_low_stock on public.products(is_low_stock) where deleted_at is null and is_active = true;

create trigger trg_products_updated_at
before update on public.products
for each row execute function public.set_updated_at();

-- ── 2. stock_movements ───────────────────────────────────────────────
-- บันทึกทุกการเคลื่อนไหวของสต๊อก
create table if not exists public.stock_movements (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  movement_type text not null
    check (movement_type in ('in','out','adjust','reserved','unreserved')),
  qty numeric(12,2) not null,            -- ปริมาณ (บวก=เข้า ลบ=ออก)
  qty_before numeric(12,2) not null,     -- สต๊อกก่อนปรับ
  qty_after  numeric(12,2) not null,     -- สต๊อกหลังปรับ
  ref_type text,                         -- อ้างอิง: 'sale_order'/'purchase'/'adjust'
  ref_id uuid,                           -- ID ของ ref_type
  note text,
  created_by uuid references public.members(id),
  created_at timestamptz not null default now()
);

create index if not exists idx_stock_movements_product on public.stock_movements(product_id, created_at desc);

-- ── 3. function: adjust stock + record movement ──────────────────────
create or replace function public.adjust_product_stock(
  p_product_id uuid,
  p_delta numeric,             -- บวก = เข้า, ลบ = ออก
  p_movement_type text,
  p_ref_type text default null,
  p_ref_id uuid default null,
  p_note text default null,
  p_created_by uuid default null
)
returns numeric                -- returns new stock_qty
language plpgsql
security definer
set search_path = public
as $$
declare
  v_before numeric;
  v_after  numeric;
begin
  -- lock row
  select stock_qty into v_before
  from public.products
  where id = p_product_id
  for update;

  if v_before is null then
    raise exception 'product not found: %', p_product_id;
  end if;

  v_after := v_before + p_delta;

  if v_after < 0 then
    raise exception 'สต๊อกไม่เพียงพอ: มี % เหลือ แต่ต้องการ %', v_before, abs(p_delta);
  end if;

  update public.products
  set stock_qty = v_after, updated_at = now()
  where id = p_product_id;

  insert into public.stock_movements (
    product_id, movement_type, qty, qty_before, qty_after,
    ref_type, ref_id, note, created_by
  ) values (
    p_product_id, p_movement_type, p_delta, v_before, v_after,
    p_ref_type, p_ref_id, p_note, p_created_by
  );

  return v_after;
end;
$$;

grant execute on function public.adjust_product_stock(uuid, numeric, text, text, uuid, text, uuid) to authenticated;
grant execute on function public.adjust_product_stock(uuid, numeric, text, text, uuid, text, uuid) to service_role;

-- ── 4. RLS ───────────────────────────────────────────────────────────
alter table public.products enable row level security;
alter table public.stock_movements enable row level security;

-- products: สมาชิกเห็นเฉพาะ active + visible
create policy products_select_members
on public.products for select
using (
  deleted_at is null and (
    is_active = true and is_visible_to_members = true
    or public.current_member_has_role('admin')
    or public.current_member_has_role('staff')
    or public.current_member_has_role('sales')
  )
);

-- products: admin/staff/sales จัดการได้
create policy products_insert_admin
on public.products for insert
with check (
  public.current_member_has_role('admin')
  or public.current_member_has_role('staff')
);

create policy products_update_admin
on public.products for update
using (
  public.current_member_has_role('admin')
  or public.current_member_has_role('staff')
  or public.current_member_has_role('sales')
);

-- stock_movements: admin/staff เห็นทั้งหมด, สมาชิกเห็นเฉพาะของตัวเอง
create policy stock_movements_select
on public.stock_movements for select
using (
  public.current_member_has_role('admin')
  or public.current_member_has_role('staff')
  or public.current_member_has_role('sales')
  or created_by = public.current_member_id()
);
