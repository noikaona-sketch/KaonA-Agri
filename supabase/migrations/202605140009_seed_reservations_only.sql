-- สร้าง seed_reservations table (เฉพาะส่วนที่ยังไม่มี)

create sequence if not exists public.seed_reservation_seq start 1;
create sequence if not exists public.sale_order_seq        start 1;

create table if not exists public.seed_reservations (
  id               uuid primary key default gen_random_uuid(),
  reservation_no   text not null unique,
  member_id        uuid not null references public.members(id),
  lot_id           uuid not null references public.seed_stock_lots(id),
  variety_id       uuid not null references public.seed_varieties(id),

  variety_name     text not null,
  lot_no           text not null,
  supplier_name    text,

  qty_reserved     numeric(12,2) not null check (qty_reserved > 0),
  qty_received     numeric(12,2),
  price_per_bag    numeric(12,2) not null,
  total_amount     numeric(14,2) generated always as (
    coalesce(qty_received, qty_reserved) * price_per_bag
  ) stored,

  pickup_date      date,
  pickup_note      text,

  status           text not null default 'pending'
    check (status in ('pending','confirmed','completed','cancelled')),
  stock_deducted   boolean not null default false,

  sale_order_id    uuid references public.sale_orders(id) on delete set null,

  note             text,
  created_by       uuid references public.members(id),
  reviewed_by      uuid references public.members(id),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists idx_seed_res_member on public.seed_reservations(member_id);
create index if not exists idx_seed_res_lot    on public.seed_reservations(lot_id);
create index if not exists idx_seed_res_status on public.seed_reservations(status);

create trigger trg_seed_reservations_updated_at
before update on public.seed_reservations
for each row execute function public.set_updated_at();

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

-- RPC: create_seed_reservation
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
  v_lot     record;
  v_res_no  text;
  v_res_id  uuid;
  v_pending numeric;
begin
  select sl.*, ss.supplier_name as sup_name
  into v_lot
  from public.seed_stock_lots sl
  left join public.seed_suppliers ss on ss.id = sl.supplier_id
  where sl.id = p_lot_id for update;

  if v_lot is null then raise exception 'ไม่พบ LOT'; end if;
  if v_lot.status = 'inactive' then raise exception 'LOT นี้ถูกยกเลิกแล้ว'; end if;
  if v_lot.status = 'depleted' then raise exception 'LOT นี้หมดแล้ว'; end if;

  select coalesce(sum(qty_reserved), 0) into v_pending
  from public.seed_reservations
  where lot_id = p_lot_id and status in ('pending','confirmed');

  if (v_lot.quantity_balance - v_pending) < p_qty then
    raise exception 'สต๊อกไม่เพียงพอ: เหลือจริง % ถุง ต้องการ % ถุง',
      (v_lot.quantity_balance - v_pending), p_qty;
  end if;

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
    coalesce(p_created_by, p_member_id), 'pending'
  ) returning id into v_res_id;

  return jsonb_build_object(
    'reservation_id', v_res_id,
    'reservation_no', v_res_no,
    'variety_name',   v_lot.variety_name,
    'qty_reserved',   p_qty,
    'total_amount',   p_qty * v_lot.price_per_bag
  );
end;
$$;

grant execute on function public.create_seed_reservation(uuid,uuid,numeric,date,text,uuid) to authenticated;
grant execute on function public.create_seed_reservation(uuid,uuid,numeric,date,text,uuid) to service_role;

-- view: admin_seed_reservations
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
