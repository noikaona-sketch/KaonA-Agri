-- Migration: ระบบขาย + จอง + receipt
-- sale_orders: ทั้งการขายทันทีและการจอง (หน้าเดียวกัน)
-- order_items: รายการสินค้าในแต่ละ order

-- ── 1. sale_orders ───────────────────────────────────────────────────
create table if not exists public.sale_orders (
  id uuid primary key default gen_random_uuid(),
  order_number text not null unique,    -- เลขที่ใบสั่ง: SO-2569-00001

  -- ผู้ซื้อ
  member_id uuid not null references public.members(id),

  -- ประเภท: ขายทันที หรือ จอง
  order_type text not null default 'sale'
    check (order_type in ('sale','reservation')),

  -- สถานะ
  status text not null default 'pending'
    check (status in (
      'pending',       -- รอยืนยัน (จอง)
      'confirmed',     -- ยืนยันแล้ว
      'ready',         -- พร้อมรับสินค้า
      'completed',     -- รับสินค้าแล้ว/ชำระแล้ว
      'cancelled'      -- ยกเลิก
    )),

  -- ยอดเงิน
  subtotal numeric(14,2) not null default 0,
  discount numeric(14,2) not null default 0,
  total    numeric(14,2) not null default 0,

  -- การชำระเงิน
  payment_method text
    check (payment_method in ('cash','transfer','credit','debit_account', null)),
  payment_status text not null default 'unpaid'
    check (payment_status in ('unpaid','paid','partial','refunded')),
  paid_amount numeric(14,2) not null default 0,
  paid_at timestamptz,

  -- จอง
  reserved_until timestamptz,           -- วันหมดอายุการจอง
  pickup_date date,                     -- วันนัดรับ

  -- หมายเหตุ
  note text,
  cancel_reason text,

  -- ผู้ทำรายการ
  created_by uuid references public.members(id),  -- staff/admin ที่ขาย
  planting_cycle_id uuid references public.planting_cycles(id),  -- เชื่อมรอบปลูก

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_sale_orders_member on public.sale_orders(member_id);
create index if not exists idx_sale_orders_status on public.sale_orders(status);
create index if not exists idx_sale_orders_type on public.sale_orders(order_type);
create index if not exists idx_sale_orders_created on public.sale_orders(created_at desc);

create trigger trg_sale_orders_updated_at
before update on public.sale_orders
for each row execute function public.set_updated_at();

-- ── 2. order_items ───────────────────────────────────────────────────
create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.sale_orders(id) on delete cascade,
  product_id uuid not null references public.products(id),

  product_name text not null,           -- snapshot ชื่อสินค้าตอนขาย
  product_unit text not null,
  qty numeric(12,2) not null check (qty > 0),
  unit_price numeric(12,2) not null check (unit_price >= 0),
  subtotal numeric(14,2) generated always as (qty * unit_price) stored,

  note text,
  created_at timestamptz not null default now()
);

create index if not exists idx_order_items_order on public.order_items(order_id);
create index if not exists idx_order_items_product on public.order_items(product_id);

-- ── 3. order_number sequence ─────────────────────────────────────────
create sequence if not exists public.sale_order_seq start 1;

create or replace function public.next_order_number()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_year text;
  v_seq  bigint;
begin
  v_year := to_char(now() at time zone 'Asia/Bangkok', 'YYYY');
  v_seq  := nextval('public.sale_order_seq');
  return 'SO-' || v_year || '-' || lpad(v_seq::text, 5, '0');
end;
$$;

grant execute on function public.next_order_number() to authenticated;
grant execute on function public.next_order_number() to service_role;

-- ── 4. create_sale_order RPC ─────────────────────────────────────────
-- สร้าง order พร้อม items และ adjust stock อัตโนมัติ
create or replace function public.create_sale_order(
  p_member_id uuid,
  p_order_type text,                    -- 'sale' | 'reservation'
  p_items jsonb,                        -- [{ product_id, qty, unit_price }]
  p_payment_method text default null,
  p_paid_amount numeric default 0,
  p_discount numeric default 0,
  p_note text default null,
  p_pickup_date date default null,
  p_planting_cycle_id uuid default null,
  p_created_by uuid default null
)
returns jsonb                           -- { order_id, order_number, total }
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order_id     uuid;
  v_order_number text;
  v_subtotal     numeric := 0;
  v_total        numeric;
  v_item         jsonb;
  v_product      record;
  v_reserved_until timestamptz;
begin
  v_order_number := public.next_order_number();

  if p_order_type = 'reservation' then
    v_reserved_until := now() + interval '7 days';
  end if;

  -- คำนวณ subtotal
  for v_item in select * from jsonb_array_elements(p_items) loop
    v_subtotal := v_subtotal + (v_item->>'qty')::numeric * (v_item->>'unit_price')::numeric;
  end loop;

  v_total := v_subtotal - coalesce(p_discount, 0);

  -- สร้าง order
  insert into public.sale_orders (
    order_number, member_id, order_type, status,
    subtotal, discount, total,
    payment_method, payment_status, paid_amount,
    paid_at, reserved_until, pickup_date,
    note, created_by, planting_cycle_id
  ) values (
    v_order_number, p_member_id, p_order_type,
    case when p_order_type = 'sale' then 'completed' else 'pending' end,
    v_subtotal, coalesce(p_discount, 0), v_total,
    p_payment_method,
    case when p_paid_amount >= v_total then 'paid'
         when p_paid_amount > 0 then 'partial'
         else 'unpaid' end,
    coalesce(p_paid_amount, 0),
    case when p_paid_amount >= v_total then now() else null end,
    v_reserved_until, p_pickup_date,
    p_note, p_created_by, p_planting_cycle_id
  ) returning id into v_order_id;

  -- สร้าง order items + adjust stock
  for v_item in select * from jsonb_array_elements(p_items) loop
    select id, name, unit into v_product
    from public.products
    where id = (v_item->>'product_id')::uuid;

    insert into public.order_items (
      order_id, product_id, product_name, product_unit, qty, unit_price, note
    ) values (
      v_order_id,
      (v_item->>'product_id')::uuid,
      v_product.name,
      v_product.unit,
      (v_item->>'qty')::numeric,
      (v_item->>'unit_price')::numeric,
      v_item->>'note'
    );

    -- sale = หักสต๊อกทันที, reservation = จองสต๊อก (reserved)
    perform public.adjust_product_stock(
      (v_item->>'product_id')::uuid,
      -(v_item->>'qty')::numeric,
      case when p_order_type = 'sale' then 'out' else 'reserved' end,
      'sale_order', v_order_id,
      null, p_created_by
    );
  end loop;

  return jsonb_build_object(
    'order_id', v_order_id,
    'order_number', v_order_number,
    'subtotal', v_subtotal,
    'discount', coalesce(p_discount, 0),
    'total', v_total
  );
end;
$$;

grant execute on function public.create_sale_order(uuid, text, jsonb, text, numeric, numeric, text, date, uuid, uuid) to authenticated;
grant execute on function public.create_sale_order(uuid, text, jsonb, text, numeric, numeric, text, date, uuid, uuid) to service_role;

-- ── 5. complete_reservation RPC ──────────────────────────────────────
-- เปลี่ยน reservation → completed เมื่อรับสินค้าและชำระเงิน
create or replace function public.complete_reservation(
  p_order_id uuid,
  p_payment_method text,
  p_paid_amount numeric
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_total numeric;
begin
  select total into v_total from public.sale_orders where id = p_order_id;

  update public.sale_orders
  set
    status         = 'completed',
    payment_method = p_payment_method,
    paid_amount    = p_paid_amount,
    payment_status = case when p_paid_amount >= v_total then 'paid' else 'partial' end,
    paid_at        = now(),
    updated_at     = now()
  where id = p_order_id;

  -- unreserved → out (เปลี่ยนจาก reserved เป็น out จริง)
  insert into public.stock_movements (product_id, movement_type, qty, qty_before, qty_after, ref_type, ref_id, note)
  select
    oi.product_id,
    'out',
    -oi.qty,
    p.stock_qty,
    p.stock_qty,   -- stock ไม่เปลี่ยน เพราะหักไปแล้วตอน reserved
    'sale_order',
    p_order_id,
    'reservation completed'
  from public.order_items oi
  join public.products p on p.id = oi.product_id
  where oi.order_id = p_order_id;
end;
$$;

grant execute on function public.complete_reservation(uuid, text, numeric) to authenticated;
grant execute on function public.complete_reservation(uuid, text, numeric) to service_role;

-- ── 6. RLS ───────────────────────────────────────────────────────────
alter table public.sale_orders enable row level security;
alter table public.order_items enable row level security;

-- sale_orders: สมาชิกเห็นของตัวเอง, admin/staff/sales เห็นทั้งหมด
create policy sale_orders_select
on public.sale_orders for select
using (
  member_id = public.current_member_id()
  or public.current_member_has_role('admin')
  or public.current_member_has_role('staff')
  or public.current_member_has_role('sales')
);

create policy sale_orders_insert_staff
on public.sale_orders for insert
with check (
  public.current_member_has_role('admin')
  or public.current_member_has_role('staff')
  or public.current_member_has_role('sales')
);

create policy sale_orders_update_staff
on public.sale_orders for update
using (
  public.current_member_has_role('admin')
  or public.current_member_has_role('staff')
  or public.current_member_has_role('sales')
);

-- order_items: follow sale_orders
create policy order_items_select
on public.order_items for select
using (
  exists (
    select 1 from public.sale_orders so
    where so.id = order_id
      and (
        so.member_id = public.current_member_id()
        or public.current_member_has_role('admin')
        or public.current_member_has_role('staff')
        or public.current_member_has_role('sales')
      )
  )
);

create policy order_items_insert_staff
on public.order_items for insert
with check (
  public.current_member_has_role('admin')
  or public.current_member_has_role('staff')
  or public.current_member_has_role('sales')
);
