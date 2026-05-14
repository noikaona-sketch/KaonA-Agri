-- Migration: แก้ trigger loop + stock movement view

-- ── 1. แก้ trigger loop ────────────────────────────────────────────────
-- ปัญหา: trg_sync_lot_status (BEFORE UPDATE of quantity_balance)
--   → update status → fire trg_seed_lots_updated_at (BEFORE UPDATE)
--   → loop → stack depth limit exceeded

-- แก้: รวม sync_lot_status เข้าใน updated_at trigger เป็น trigger เดียว
-- และใช้ BEFORE UPDATE (ไม่ใช่ AFTER) เพื่อแก้ new.status ใน row เดิม

drop trigger if exists trg_sync_lot_status on public.seed_stock_lots;
drop trigger if exists trg_seed_lots_updated_at on public.seed_stock_lots;
drop function if exists public.sync_lot_status();

create or replace function public.seed_lot_before_update()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  -- อัปเดต updated_at
  new.updated_at := now();

  -- sync status จาก quantity_balance (ทำในครั้งเดียวไม่ loop)
  if new.quantity_balance is not null then
    new.status :=
      case
        when new.status = 'inactive'                          then 'inactive'
        when new.quantity_balance <= 0                        then 'depleted'
        when new.quantity_balance <= new.quantity_in * 0.1   then 'low'
        else 'available'
      end;
  end if;

  return new;
end;
$$;

create trigger trg_seed_lot_before_update
before update on public.seed_stock_lots
for each row execute function public.seed_lot_before_update();

-- ── 2. seed_varieties: เพิ่ม yield_ratio ─────────────────────────────
-- ค่าเริ่มต้น: 600 กก.ข้าวโพดต่อ 1 กก.เมล็ด
alter table public.seed_varieties
  add column if not exists yield_ratio  numeric(8,2) default 600
    check (yield_ratio > 0),             -- กก.ผลผลิตต่อ กก.เมล็ด
  add column if not exists crop_cycle_days int default 90; -- วันปลูกถึงเก็บ (override days_to_harvest)

comment on column public.seed_varieties.yield_ratio is
  'ผลผลิตต่อเมล็ด (กก./กก.) เช่น 600 = 1 กก.เมล็ด → 600 กก.ข้าวโพด';

-- ── 3. stock_movements table ─────────────────────────────────────────
-- บันทึกการเคลื่อนไหวสต๊อกรายวัน
create table if not exists public.stock_movements (
  id            uuid primary key default gen_random_uuid(),
  lot_id        uuid references public.seed_stock_lots(id) on delete cascade,
  product_id    uuid references public.products(id) on delete set null,
  movement_type text not null check (movement_type in (
    'in',        -- รับเข้า
    'out',       -- จ่ายออก (ขาย/จอง)
    'adjust',    -- ปรับยอด
    'return'     -- คืนสินค้า
  )),
  qty           numeric(12,2) not null,
  qty_before    numeric(12,2),
  qty_after     numeric(12,2),
  unit          text default 'ถุง',
  ref_type      text,        -- 'sale_order' | 'seed_reservation' | 'manual'
  ref_id        uuid,
  note          text,
  created_by    uuid references public.members(id),
  created_at    timestamptz not null default now()
);

create index if not exists idx_stock_movements_lot     on public.stock_movements(lot_id, created_at desc);
create index if not exists idx_stock_movements_product on public.stock_movements(product_id, created_at desc);
create index if not exists idx_stock_movements_date    on public.stock_movements(created_at desc);

-- ── 4. trigger: บันทึก movement อัตโนมัติเมื่อ lot balance เปลี่ยน ──
create or replace function public.log_lot_movement()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  -- บันทึกเฉพาะเมื่อ quantity_balance เปลี่ยน
  if old.quantity_balance is distinct from new.quantity_balance then
    insert into public.stock_movements (
      lot_id, movement_type, qty, qty_before, qty_after, unit, ref_type, note
    ) values (
      new.id,
      case when new.quantity_balance > old.quantity_balance then 'adjust' else 'out' end,
      abs(new.quantity_balance - old.quantity_balance),
      old.quantity_balance,
      new.quantity_balance,
      'ถุง',
      'system',
      'auto from lot update'
    );
  end if;
  return new;
end;
$$;

create trigger trg_log_lot_movement
after update of quantity_balance on public.seed_stock_lots
for each row execute function public.log_lot_movement();

-- ── 5. view: stock daily summary ─────────────────────────────────────
create or replace view public.stock_daily_summary as
select
  date_trunc('day', sm.created_at at time zone 'Asia/Bangkok')::date as movement_date,
  sl.variety_name,
  ss.supplier_name,
  count(*)                                          as txn_count,
  sum(case when sm.movement_type = 'in'  then sm.qty else 0 end) as qty_in,
  sum(case when sm.movement_type = 'out' then sm.qty else 0 end) as qty_out,
  sum(case when sm.movement_type = 'adjust' and sm.qty > 0 then sm.qty else 0 end) as qty_adjust_in,
  sum(case when sm.movement_type = 'adjust' and sm.qty < 0 then abs(sm.qty) else 0 end) as qty_adjust_out,
  min(sm.qty_before) filter (where sm.created_at = (
    select min(created_at) from public.stock_movements where lot_id = sm.lot_id
      and date_trunc('day', created_at at time zone 'Asia/Bangkok')::date =
          date_trunc('day', sm.created_at at time zone 'Asia/Bangkok')::date
  )) as opening_balance,
  max(sm.qty_after) filter (where sm.created_at = (
    select max(created_at) from public.stock_movements where lot_id = sm.lot_id
      and date_trunc('day', created_at at time zone 'Asia/Bangkok')::date =
          date_trunc('day', sm.created_at at time zone 'Asia/Bangkok')::date
  )) as closing_balance
from public.stock_movements sm
join public.seed_stock_lots sl on sl.id = sm.lot_id
left join public.seed_suppliers ss on ss.id = sl.supplier_id
group by 1, sl.id, sl.variety_name, ss.supplier_name
order by 1 desc, sl.variety_name;

-- ── 6. RLS ────────────────────────────────────────────────────────────
alter table public.stock_movements enable row level security;

create policy stock_movements_admin on public.stock_movements
  for all using (
    public.current_member_has_role('admin')
    or public.current_member_has_role('staff')
    or public.current_member_has_role('stock')
  );
