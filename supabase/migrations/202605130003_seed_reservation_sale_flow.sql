-- Migration: Seed Reservation → Sale Flow
-- เชื่อม order_items กับ seed_stock_lots
-- สร้าง seed_reservations table
-- RPC ที่ทำทุก step ใน transaction เดียว

-- ── 1. เพิ่ม lot_id ใน order_items ──────────────────────────────────
alter table public.order_items
  add column if not exists lot_id           uuid references public.seed_stock_lots(id) on delete set null,
  add column if not exists variety_id       uuid references public.seed_varieties(id)  on delete set null,
  add column if not exists stock_deducted   boolean not null default false;

-- ── 2. seed_reservations ─────────────────────────────────────────────
-- จองล่วงหน้า ยังไม่ตัด stock จริง
create table if not exists public.seed_reservations (
  id               uuid primary key default gen_random_uuid(),
  reservation_no   text not null unique,    -- RV-2569-00001
  member_id        uuid not null references public.members(id),
  lot_id           uuid not null references public.seed_stock_lots(id),
  variety_id       uuid not null references public.seed_varieties(id),

  -- snapshot
  variety_name     text not null,
  lot_no           text not null,
  supplier_name    text,

  -- ปริมาณ
  qty_reserved     numeric(12,2) not null check (qty_reserved > 0),
  qty_received     numeric(12,2),           -- ปริมาณที่รับจริง (ตอน convert → sale)
  price_per_bag    numeric(12,2) not null,
  total_amount     numeric(14,2) generated always as (
    coalesce(qty_received, qty_reserved) * price_per_bag
  ) stored,

  -- วันนัดรับ
  pickup_date      date,
  pickup_note      text,

  -- สถานะ
  status           text not null default 'pending'
    check (status in (
      'pending',    -- รอยืนยัน
      'confirmed',  -- ยืนยันแล้ว รอรับ
      'completed',  -- รับสินค้าแล้ว stock ถูกตัด
      'cancelled'   -- ยกเลิก
    )),
  stock_deducted   boolean not null default false,

  -- เชื่อม sale order ตอน convert
  sale_order_id    uuid references public.sale_orders(id) on delete set null,

  note             text,
  created_by       uuid references public.members(id),
  reviewed_by      uuid references public.members(id),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create sequence if not exists public.seed_reservation_seq start 1;

create index if not exists idx_seed_res_member  on public.seed_reservations(member_id);
create index if not exists idx_seed_res_lot     on public.seed_reservations(lot_id);
create index if not exists idx_seed_res_status  on public.seed_reservations(status);
create index if not exists idx_seed_res_pickup  on public.seed_reservations(pickup_date);

create trigger trg_seed_reservations_updated_at
before update on public.seed_reservations
for each row execute function public.set_updated_at();

-- ── 3. RPC: create_seed_reservation ──────────────────────────────────
-- สร้างการจองเมล็ดพันธุ์ — ตรวจ balance server-side ก่อน
-- ไม่ตัด stock จริงจนกว่าจะ convert
create or replace function public.create_seed_reservation(
  p_member_id    uuid,
  p_lot_id       uuid,
  p_qty          numeric,
  p_pickup_date  date default null,
  p_note         text default null,
  p_created_by   uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_lot       record;
  v_variety   record;
  v_res_no    text;
  v_res_id    uuid;
  v_pending   numeric;
begin
  -- lock lot row
  select sl.*, ss.supplier_name as sup_name
  into v_lot
  from public.seed_stock_lots sl
  left join public.seed_suppliers ss on ss.id = sl.supplier_id
  where sl.id = p_lot_id
  for update;

  if v_lot is null then
    raise exception 'ไม่พบ LOT';
  end if;
  if v_lot.status = 'inactive' then
    raise exception 'LOT นี้ถูกยกเลิกแล้ว';
  end if;
  if v_lot.status = 'depleted' then
    raise exception 'LOT นี้หมดแล้ว';
  end if;

  -- นับ pending reservations ของ lot นี้
  select coalesce(sum(qty_reserved), 0) into v_pending
  from public.seed_reservations
  where lot_id = p_lot_id
    and status in ('pending','confirmed');

  -- ตรวจ balance ที่ยังใช้ได้จริง
  if (v_lot.quantity_balance - v_pending) < p_qty then
    raise exception 'สต๊อกไม่เพียงพอ: คงเหลือ % ถุง กำลังถูกจอง % ถุง เหลือจริง % ถุง ต้องการ % ถุง',
      v_lot.quantity_balance, v_pending,
      (v_lot.quantity_balance - v_pending), p_qty;
  end if;

  -- variety info
  select * into v_variety from public.seed_varieties where id = v_lot.variety_id;

  -- เลขที่จอง
  v_res_no := 'RV-' || to_char(now() at time zone 'Asia/Bangkok','YYYY') || '-'
    || lpad(nextval('public.seed_reservation_seq')::text, 5, '0');

  insert into public.seed_reservations (
    reservation_no, member_id, lot_id, variety_id,
    variety_name, lot_no, supplier_name,
    qty_reserved, price_per_bag,
    pickup_date, note, created_by, status
  ) values (
    v_res_no, p_member_id, p_lot_id, v_lot.variety_id,
    v_lot.variety_name, v_lot.lot_no, v_lot.sup_name,
    p_qty, v_lot.price_per_bag,
    p_pickup_date, p_note,
    coalesce(p_created_by, p_member_id),
    'pending'
  ) returning id into v_res_id;

  -- notify สมาชิก
  perform public.push_notification(
    p_member_id,
    '🌾 จองเมล็ดพันธุ์แล้ว',
    v_res_no || ' — ' || v_lot.variety_name || ' ' || p_qty || ' ถุง รอยืนยันจาก admin',
    'seed_reservation', v_res_id
  );

  return jsonb_build_object(
    'reservation_id', v_res_id,
    'reservation_no', v_res_no,
    'variety_name',   v_lot.variety_name,
    'lot_no',         v_lot.lot_no,
    'qty_reserved',   p_qty,
    'price_per_bag',  v_lot.price_per_bag,
    'total_amount',   p_qty * v_lot.price_per_bag
  );
end;
$$;

grant execute on function public.create_seed_reservation(uuid, uuid, numeric, date, text, uuid) to authenticated;
grant execute on function public.create_seed_reservation(uuid, uuid, numeric, date, text, uuid) to service_role;

-- ── 4. RPC: convert_reservation_to_sale ──────────────────────────────
-- admin/staff ยืนยันรับสินค้า → ตัด stock จริง → สร้าง sale_order
create or replace function public.convert_reservation_to_sale(
  p_reservation_id uuid,
  p_qty_actual     numeric,              -- ปริมาณจริงที่รับ (อาจต่างจากที่จอง)
  p_payment_method text default 'debit_account'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_res       record;
  v_lot       record;
  v_order_no  text;
  v_order_id  uuid;
  v_result    jsonb;
begin
  -- lock reservation
  select * into v_res
  from public.seed_reservations
  where id = p_reservation_id
  for update;

  if v_res is null then
    raise exception 'ไม่พบการจอง';
  end if;
  if v_res.status not in ('pending','confirmed') then
    raise exception 'ไม่สามารถ convert ได้ สถานะปัจจุบัน: %', v_res.status;
  end if;
  if v_res.stock_deducted then
    raise exception 'ตัด stock ไปแล้ว';
  end if;

  -- ตัด lot balance จริง
  select public.decrement_lot_balance(
    v_res.lot_id,
    p_qty_actual,
    'seed_reservation',
    p_reservation_id
  ) into v_result;

  -- สร้าง sale_order
  v_order_no := 'SO-' || to_char(now() at time zone 'Asia/Bangkok','YYYY') || '-'
    || lpad(nextval('public.sale_order_seq')::text, 5, '0');

  insert into public.sale_orders (
    order_number, member_id, order_type, status,
    subtotal, discount, total,
    payment_method, payment_status, paid_amount,
    paid_at
  ) values (
    v_order_no, v_res.member_id, 'sale', 'completed',
    p_qty_actual * v_res.price_per_bag, 0, p_qty_actual * v_res.price_per_bag,
    p_payment_method,
    case when p_payment_method = 'debit_account' then 'unpaid' else 'paid' end,
    case when p_payment_method = 'debit_account' then 0 else p_qty_actual * v_res.price_per_bag end,
    case when p_payment_method != 'debit_account' then now() else null end
  ) returning id into v_order_id;

  -- order items พร้อม lot reference
  insert into public.order_items (
    order_id, product_id, lot_id, variety_id,
    product_name, product_unit, qty, unit_price, stock_deducted
  )
  select
    v_order_id,
    p.id,
    v_res.lot_id,
    v_res.variety_id,
    v_res.variety_name,
    'ถุง',
    p_qty_actual,
    v_res.price_per_bag,
    true
  from public.products p
  where p.id = (
    select product_id from public.planting_cycles
    where id = (
      select id from public.planting_cycles
      where source_order_id = v_order_id limit 1
    ) limit 1
  )
  limit 1;

  -- อัปเดต reservation
  update public.seed_reservations
  set status         = 'completed',
      stock_deducted = true,
      qty_received   = p_qty_actual,
      sale_order_id  = v_order_id,
      updated_at     = now()
  where id = p_reservation_id;

  -- notify สมาชิก
  perform public.push_notification(
    v_res.member_id,
    '✅ รับเมล็ดพันธุ์แล้ว',
    v_res.reservation_no || ' — ' || v_res.variety_name
      || ' ' || p_qty_actual || ' ถุง เลขที่ ' || v_order_no,
    'sale_order', v_order_id
  );

  return jsonb_build_object(
    'order_id',        v_order_id,
    'order_number',    v_order_no,
    'reservation_no',  v_res.reservation_no,
    'qty_actual',      p_qty_actual,
    'total_amount',    p_qty_actual * v_res.price_per_bag,
    'stock_result',    v_result
  );
end;
$$;

grant execute on function public.convert_reservation_to_sale(uuid, numeric, text) to service_role;

-- ── 5. RPC: cancel_reservation ───────────────────────────────────────
create or replace function public.cancel_reservation(
  p_reservation_id uuid,
  p_reason         text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_res record;
begin
  select * into v_res from public.seed_reservations
  where id = p_reservation_id for update;

  if v_res is null then raise exception 'ไม่พบการจอง'; end if;
  if v_res.stock_deducted then raise exception 'รับสินค้าไปแล้ว ไม่สามารถยกเลิกได้'; end if;

  update public.seed_reservations
  set status = 'cancelled', note = coalesce(p_reason, note), updated_at = now()
  where id = p_reservation_id;

  perform public.push_notification(
    v_res.member_id,
    '⛔ ยกเลิกการจองเมล็ดพันธุ์',
    v_res.reservation_no || ' — ' || v_res.variety_name || ' ถูกยกเลิก'
      || coalesce(': ' || p_reason, ''),
    'seed_reservation', p_reservation_id
  );
end;
$$;

grant execute on function public.cancel_reservation(uuid, text) to service_role;

-- ── 6. view: admin_seed_reservations ─────────────────────────────────
create or replace view public.admin_seed_reservations as
select
  sr.id, sr.reservation_no, sr.status, sr.stock_deducted,
  sr.qty_reserved, sr.qty_received, sr.price_per_bag, sr.total_amount,
  sr.pickup_date, sr.note, sr.created_at,
  m.full_name as member_name, m.phone as member_phone,
  sv.variety_name, sv.crop_type,
  ss.supplier_name,
  sl.lot_no, sl.quantity_balance as lot_balance,
  sr.sale_order_id
from public.seed_reservations sr
join public.members m on m.id = sr.member_id
join public.seed_varieties sv on sv.id = sr.variety_id
join public.seed_stock_lots sl on sl.id = sr.lot_id
left join public.seed_suppliers ss on ss.id = sl.supplier_id
order by sr.created_at desc;

-- ── 7. RLS ────────────────────────────────────────────────────────────
alter table public.seed_reservations enable row level security;

create policy seed_res_member_select on public.seed_reservations
  for select using (
    member_id = public.current_member_id()
    or public.current_member_has_role('admin')
    or public.current_member_has_role('staff')
    or public.current_member_has_role('sales')
  );

create policy seed_res_member_insert on public.seed_reservations
  for insert with check (
    member_id = public.current_member_id()
    or public.current_member_has_role('admin')
    or public.current_member_has_role('staff')
  );

create policy seed_res_admin_update on public.seed_reservations
  for update using (
    public.current_member_has_role('admin')
    or public.current_member_has_role('staff')
    or public.current_member_has_role('sales')
  );
