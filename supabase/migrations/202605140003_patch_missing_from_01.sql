-- Patch: เพิ่มสิ่งที่ขาดจาก migration 01 โดยไม่ re-run ทั้งหมด
-- (migration 01 run ไปแล้วบางส่วน triggers ถูกสร้างแล้ว)

-- yield_ratio และ crop_cycle_days (จาก migration 14001)
alter table public.seed_varieties
  add column if not exists yield_ratio      numeric(8,2) not null default 600,
  add column if not exists crop_cycle_days  int default 90;

-- แก้ trigger loop ใน seed_stock_lots
drop trigger if exists trg_sync_lot_status        on public.seed_stock_lots;
drop trigger if exists trg_seed_lots_updated_at   on public.seed_stock_lots;
drop function if exists public.sync_lot_status();

create or replace function public.seed_lot_before_update()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  new.updated_at := now();
  if new.quantity_balance is not null then
    new.status :=
      case
        when new.status = 'inactive'                        then 'inactive'
        when new.quantity_balance <= 0                      then 'depleted'
        when new.quantity_balance <= new.quantity_in * 0.1  then 'low'
        else 'available'
      end;
  end if;
  return new;
end;
$$;

create trigger trg_seed_lot_before_update
before update on public.seed_stock_lots
for each row execute function public.seed_lot_before_update();

-- stock_movements table
create table if not exists public.stock_movements (
  id            uuid primary key default gen_random_uuid(),
  lot_id        uuid references public.seed_stock_lots(id) on delete cascade,
  product_id    uuid references public.products(id) on delete set null,
  movement_type text not null check (movement_type in ('in','out','adjust','return')),
  qty           numeric(12,2) not null,
  qty_before    numeric(12,2),
  qty_after     numeric(12,2),
  unit          text default 'ถุง',
  ref_type      text,
  ref_id        uuid,
  note          text,
  created_by    uuid references public.members(id),
  created_at    timestamptz not null default now()
);

create index if not exists idx_stock_movements_lot  on public.stock_movements(lot_id, created_at desc);
create index if not exists idx_stock_movements_date on public.stock_movements(created_at desc);

-- auto-log lot movement
create or replace function public.log_lot_movement()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if old.quantity_balance is distinct from new.quantity_balance then
    insert into public.stock_movements(lot_id,movement_type,qty,qty_before,qty_after,unit,ref_type,note)
    values(new.id,
      case when new.quantity_balance > old.quantity_balance then 'in' else 'out' end,
      abs(new.quantity_balance - old.quantity_balance),
      old.quantity_balance, new.quantity_balance, 'ถุง', 'system', 'auto');
  end if;
  return new;
end;
$$;

drop trigger if exists trg_log_lot_movement on public.seed_stock_lots;
create trigger trg_log_lot_movement
after update of quantity_balance on public.seed_stock_lots
for each row execute function public.log_lot_movement();

-- order_items columns
alter table public.order_items
  add column if not exists lot_id         uuid,
  add column if not exists variety_id     uuid,
  add column if not exists stock_deducted boolean not null default false;

do $$
begin
  if not exists (select 1 from information_schema.table_constraints where constraint_name = 'order_items_lot_id_fkey') then
    alter table public.order_items add constraint order_items_lot_id_fkey foreign key (lot_id) references public.seed_stock_lots(id) on delete set null;
  end if;
  if not exists (select 1 from information_schema.table_constraints where constraint_name = 'order_items_variety_id_fkey') then
    alter table public.order_items add constraint order_items_variety_id_fkey foreign key (variety_id) references public.seed_varieties(id) on delete set null;
  end if;
end;
$$;

-- sequences
create sequence if not exists public.seed_reservation_seq start 1;
create sequence if not exists public.sale_order_seq start 1;

alter table public.stock_movements enable row level security;
create policy stock_movements_admin on public.stock_movements for all
  using (public.current_member_has_role('admin') or public.current_member_has_role('staff') or public.current_member_has_role('stock'));
