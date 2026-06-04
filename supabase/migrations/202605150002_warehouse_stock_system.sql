-- ════════════════════════════════════════════════════════════
-- WAREHOUSE & STOCK SYSTEM
-- ════════════════════════════════════════════════════════════

-- 1. warehouses
create table if not exists public.warehouses (
  id          uuid primary key default gen_random_uuid(),
  code        text not null unique,   -- MAIN / KFI / EXT_A / EXT_B
  name        text not null,
  description text,
  is_active   boolean not null default true,
  sort_order  int     not null default 0,
  created_at  timestamptz not null default now()
);

insert into public.warehouses (code, name, sort_order) values
  ('MAIN',  'คลังหลัก (Main)',    1),
  ('KFI',   'KFI Stock',          2),
  ('EXT_A', 'คลังนอก A',          3),
  ('EXT_B', 'คลังนอก B',          4)
on conflict (code) do nothing;

alter table public.warehouses enable row level security;
create policy wh_read   on public.warehouses for select using (true);
create policy wh_admin  on public.warehouses for all
  using (public.current_member_has_role('admin') or public.current_member_has_role('staff'));

-- 2. product_stock — stock ต่อสินค้าต่อคลัง
--    ครอบคลุมทั้ง products และ seed_varieties
create table if not exists public.product_stock (
  id             uuid primary key default gen_random_uuid(),
  warehouse_id   uuid not null references public.warehouses(id) on delete cascade,
  product_id     uuid references public.products(id)       on delete cascade,
  variety_id     uuid references public.seed_varieties(id) on delete cascade,
  -- ต้องมีอย่างใดอย่างหนึ่ง
  constraint chk_product_or_variety check (
    (product_id is not null and variety_id is null) or
    (product_id is null and variety_id is not null)
  ),
  qty_on_hand    numeric(12,2) not null default 0,
  qty_reserved   numeric(12,2) not null default 0,  -- จองแล้วยังไม่รับ
  qty_available  numeric(12,2) generated always as (qty_on_hand - qty_reserved) stored,
  unit           text not null default 'ถุง',
  updated_at     timestamptz not null default now(),
  unique (warehouse_id, product_id),
  unique (warehouse_id, variety_id)
);

create index if not exists idx_product_stock_warehouse on public.product_stock(warehouse_id);
create index if not exists idx_product_stock_product   on public.product_stock(product_id);
create index if not exists idx_product_stock_variety   on public.product_stock(variety_id);

create trigger trg_product_stock_updated_at
  before update on public.product_stock
  for each row execute function public.set_updated_at();

alter table public.product_stock enable row level security;
create policy ps_read  on public.product_stock for select using (true);
create policy ps_admin on public.product_stock for all
  using (public.current_member_has_role('admin') or public.current_member_has_role('staff'));

-- 3. stock_movements — ทุก movement บันทึกที่นี่
create table if not exists public.stock_movements (
  id              uuid primary key default gen_random_uuid(),
  movement_no     text not null unique,  -- MV-2569-00001
  movement_type   text not null
    check (movement_type in (
      'receive',      -- รับเข้าคลัง
      'sale',         -- ขายออก
      'reservation',  -- จองล็อก stock
      'cancel_res',   -- ยกเลิกจอง
      'transfer_out', -- โอนออกจากคลัง
      'transfer_in',  -- โอนเข้าคลัง
      'adjust_add',   -- ปรับเพิ่ม (ตรวจนับ)
      'adjust_sub',   -- ปรับลด (ตรวจนับ)
      'return',       -- รับคืน
      'opening'       -- ยอดยกมา
    )),
  warehouse_id    uuid not null references public.warehouses(id),
  dest_warehouse_id uuid references public.warehouses(id),  -- สำหรับโอน
  product_id      uuid references public.products(id),
  variety_id      uuid references public.seed_varieties(id),
  product_name    text not null,
  unit            text not null default 'ถุง',
  qty             numeric(12,2) not null check (qty > 0),
  unit_cost       numeric(12,2),
  unit_price      numeric(12,2),
  total_amount    numeric(14,2),
  ref_type        text,   -- sale_order / reservation / transfer / adjustment
  ref_id          uuid,
  ref_no          text,
  note            text,
  period_id       uuid references public.accounting_periods(id),
  is_locked       boolean not null default false,
  created_by      uuid references public.members(id),
  created_at      timestamptz not null default now()
);

create index if not exists idx_sm_warehouse   on public.stock_movements(warehouse_id, created_at);
create index if not exists idx_sm_product     on public.stock_movements(product_id);
create index if not exists idx_sm_variety     on public.stock_movements(variety_id);
create index if not exists idx_sm_type        on public.stock_movements(movement_type, created_at);
create index if not exists idx_sm_date        on public.stock_movements(created_at);

alter table public.stock_movements enable row level security;
create policy sm_read  on public.stock_movements for select using (true);
create policy sm_admin on public.stock_movements for all
  using (public.current_member_has_role('admin') or public.current_member_has_role('staff'));

-- 4. stock_transfer_batches — กลุ่มการโอน
create table if not exists public.stock_transfer_batches (
  id              uuid primary key default gen_random_uuid(),
  transfer_no     text not null unique,
  from_warehouse  uuid not null references public.warehouses(id),
  to_warehouse    uuid not null references public.warehouses(id),
  status          text not null default 'pending'
    check (status in ('pending','confirmed','cancelled')),
  note            text,
  created_by      uuid references public.members(id),
  confirmed_by    uuid references public.members(id),
  created_at      timestamptz not null default now(),
  confirmed_at    timestamptz
);

alter table public.stock_transfer_batches enable row level security;
create policy stb_read  on public.stock_transfer_batches for select using (true);
create policy stb_admin on public.stock_transfer_batches for all
  using (public.current_member_has_role('admin') or public.current_member_has_role('staff'));

-- 5. stock_count_sessions — ตรวจนับสต๊อก
create table if not exists public.stock_count_sessions (
  id            uuid primary key default gen_random_uuid(),
  session_no    text not null unique,
  warehouse_id  uuid not null references public.warehouses(id),
  status        text not null default 'open'
    check (status in ('open','submitted','approved','cancelled')),
  counted_at    date not null default current_date,
  note          text,
  created_by    uuid references public.members(id),
  approved_by   uuid references public.members(id),
  created_at    timestamptz not null default now()
);

create table if not exists public.stock_count_items (
  id            uuid primary key default gen_random_uuid(),
  session_id    uuid not null references public.stock_count_sessions(id) on delete cascade,
  product_id    uuid references public.products(id),
  variety_id    uuid references public.seed_varieties(id),
  product_name  text not null,
  unit          text not null,
  qty_system    numeric(12,2) not null,   -- ยอดในระบบ
  qty_counted   numeric(12,2),            -- ยอดที่นับได้จริง
  qty_diff      numeric(12,2) generated always as (
    coalesce(qty_counted, qty_system) - qty_system
  ) stored,
  note          text
);

alter table public.stock_count_sessions enable row level security;
alter table public.stock_count_items     enable row level security;
create policy scs_read on public.stock_count_sessions for select using (true);
create policy scs_admin on public.stock_count_sessions for all
  using (public.current_member_has_role('admin') or public.current_member_has_role('staff'));
create policy sci_read on public.stock_count_items for select using (true);
create policy sci_admin on public.stock_count_items for all
  using (public.current_member_has_role('admin') or public.current_member_has_role('staff'));

-- 6. accounting_periods — ปิดงวด
create table if not exists public.accounting_periods (
  id            uuid primary key default gen_random_uuid(),
  period_year   int  not null,
  period_month  int  not null check (period_month between 1 and 12),
  start_date    date not null,
  end_date      date not null,
  status        text not null default 'open'
    check (status in ('open','closing','closed')),
  closed_by     uuid references public.members(id),
  closed_at     timestamptz,
  note          text,
  created_at    timestamptz not null default now(),
  unique (period_year, period_month)
);

-- seed period ปัจจุบัน
insert into public.accounting_periods (period_year, period_month, start_date, end_date, status)
values (
  extract(year from now())::int,
  extract(month from now())::int,
  date_trunc('month', now())::date,
  (date_trunc('month', now()) + interval '1 month - 1 day')::date,
  'open'
) on conflict do nothing;

alter table public.accounting_periods enable row level security;
create policy ap_read  on public.accounting_periods for select using (true);
create policy ap_admin on public.accounting_periods for all
  using (public.current_member_has_role('admin') or public.current_member_has_role('staff'));

-- 7. cashier_sessions — ปิดรอบแคชเชียร์
create table if not exists public.cashier_sessions (
  id              uuid primary key default gen_random_uuid(),
  session_no      text not null unique,
  warehouse_id    uuid not null references public.warehouses(id),
  opened_by       uuid references public.members(id),
  closed_by       uuid references public.members(id),
  opening_cash    numeric(12,2) not null default 0,
  closing_cash    numeric(12,2),
  total_sales     numeric(14,2) not null default 0,
  total_cash      numeric(14,2) not null default 0,
  total_credit    numeric(14,2) not null default 0,
  total_transfer  numeric(14,2) not null default 0,
  cash_difference numeric(12,2),  -- ผลต่างเงินสด
  status          text not null default 'open'
    check (status in ('open','closed')),
  note            text,
  opened_at       timestamptz not null default now(),
  closed_at       timestamptz
);

alter table public.cashier_sessions enable row level security;
create policy cs_read  on public.cashier_sessions for select using (true);
create policy cs_admin on public.cashier_sessions for all
  using (public.current_member_has_role('admin') or public.current_member_has_role('staff'));

-- ════════════════════════════════════════════
-- SEQUENCES สำหรับ numbering
-- ════════════════════════════════════════════
create sequence if not exists public.stock_movement_seq  start 1;
create sequence if not exists public.stock_transfer_seq  start 1;
create sequence if not exists public.stock_count_seq     start 1;
create sequence if not exists public.cashier_session_seq start 1;

-- ════════════════════════════════════════════
-- FUNCTIONS
-- ════════════════════════════════════════════

-- ฟังก์ชัน: เพิ่ม/ลด stock
create or replace function public.adjust_stock(
  p_warehouse_id uuid,
  p_product_id   uuid default null,
  p_variety_id   uuid default null,
  p_delta        numeric default 0,
  p_unit         text   default 'ถุง'
) returns void language plpgsql security definer as $$
begin
  if p_product_id is not null then
    insert into public.product_stock (warehouse_id, product_id, unit, qty_on_hand)
    values (p_warehouse_id, p_product_id, p_unit, greatest(0, p_delta))
    on conflict (warehouse_id, product_id) do update
      set qty_on_hand = greatest(0, public.product_stock.qty_on_hand + p_delta),
          updated_at  = now();
  elsif p_variety_id is not null then
    insert into public.product_stock (warehouse_id, variety_id, unit, qty_on_hand)
    values (p_warehouse_id, p_variety_id, p_unit, greatest(0, p_delta))
    on conflict (warehouse_id, variety_id) do update
      set qty_on_hand = greatest(0, public.product_stock.qty_on_hand + p_delta),
          updated_at  = now();
  end if;
end;
$$;

-- ฟังก์ชัน: บันทึก movement + ปรับ stock อัตโนมัติ
create or replace function public.create_stock_movement(
  p_type         text,
  p_warehouse_id uuid,
  p_product_id   uuid default null,
  p_variety_id   uuid default null,
  p_product_name text default '',
  p_unit         text default 'ถุง',
  p_qty          numeric default 0,
  p_unit_cost    numeric default null,
  p_unit_price   numeric default null,
  p_ref_type     text   default null,
  p_ref_id       uuid   default null,
  p_ref_no       text   default null,
  p_note         text   default null,
  p_created_by   uuid   default null,
  p_dest_warehouse_id uuid default null
) returns uuid language plpgsql security definer as $$
declare
  v_mv_no text;
  v_mv_id uuid;
  v_period_id uuid;
  v_delta numeric;
begin
  -- ตรวจ period
  select id into v_period_id from public.accounting_periods
  where status = 'open' order by start_date desc limit 1;

  -- movement number
  v_mv_no := 'MV-' || to_char(now() at time zone 'Asia/Bangkok','YYYY') || '-'
    || lpad(nextval('public.stock_movement_seq')::text, 5, '0');

  -- คำนวณ delta
  v_delta := case
    when p_type in ('receive','transfer_in','adjust_add','return','cancel_res') then  p_qty
    when p_type in ('sale','transfer_out','adjust_sub','reservation')           then -p_qty
    else 0
  end;

  -- บันทึก movement
  insert into public.stock_movements (
    movement_no, movement_type, warehouse_id, dest_warehouse_id,
    product_id, variety_id, product_name, unit, qty,
    unit_cost, unit_price, total_amount,
    ref_type, ref_id, ref_no, note, period_id, created_by
  ) values (
    v_mv_no, p_type, p_warehouse_id, p_dest_warehouse_id,
    p_product_id, p_variety_id, p_product_name, p_unit, p_qty,
    p_unit_cost, p_unit_price, p_qty * coalesce(p_unit_price, p_unit_cost, 0),
    p_ref_type, p_ref_id, p_ref_no, p_note, v_period_id, p_created_by
  ) returning id into v_mv_id;

  -- ปรับ stock
  perform public.adjust_stock(p_warehouse_id, p_product_id, p_variety_id, v_delta, p_unit);

  -- โอน: เพิ่มที่ปลายทาง
  if p_type = 'transfer_out' and p_dest_warehouse_id is not null then
    perform public.adjust_stock(p_dest_warehouse_id, p_product_id, p_variety_id, p_qty, p_unit);
    insert into public.stock_movements (
      movement_no, movement_type, warehouse_id,
      product_id, variety_id, product_name, unit, qty,
      ref_type, ref_id, ref_no, note, period_id, created_by
    ) values (
      v_mv_no || '-IN', 'transfer_in', p_dest_warehouse_id,
      p_product_id, p_variety_id, p_product_name, p_unit, p_qty,
      p_ref_type, v_mv_id, v_mv_no, p_note, v_period_id, p_created_by
    );
  end if;

  return v_mv_id;
end;
$$;

grant execute on function public.adjust_stock to authenticated, service_role;
grant execute on function public.create_stock_movement to authenticated, service_role;
