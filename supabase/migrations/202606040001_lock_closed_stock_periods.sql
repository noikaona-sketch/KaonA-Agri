-- Lock closed stock periods and keep an append-only close/reopen audit trail.

alter table public.accounting_periods
  add column if not exists reopened_by uuid references public.members(id),
  add column if not exists closed_by_admin uuid references public.admin_users(id),
  add column if not exists reopened_by_admin uuid references public.admin_users(id),
  add column if not exists reopened_at timestamptz,
  add column if not exists reason text,
  add column if not exists close_reason text,
  add column if not exists reopen_reason text;

alter table public.accounting_periods
  drop constraint if exists accounting_periods_status_check;

alter table public.accounting_periods
  add constraint accounting_periods_status_check
  check (status in ('open','review','closing','closed'));

create table if not exists public.accounting_period_events (
  id uuid primary key default gen_random_uuid(),
  period_id uuid not null references public.accounting_periods(id) on delete restrict,
  action text not null check (action in ('close','reopen','cancel_close')),
  actor_id uuid references public.members(id),
  actor_admin_id uuid references public.admin_users(id),
  reason text,
  previous_status text,
  new_status text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_accounting_period_events_period
  on public.accounting_period_events(period_id, created_at desc);

alter table public.accounting_period_events enable row level security;

drop policy if exists accounting_period_events_read on public.accounting_period_events;
create policy accounting_period_events_read
on public.accounting_period_events for select
using (public.current_member_has_role('admin') or public.current_member_has_role('staff'));

drop policy if exists accounting_period_events_insert_admin on public.accounting_period_events;
create policy accounting_period_events_insert_admin
on public.accounting_period_events for insert
with check (public.current_member_has_role('admin') or public.current_member_has_role('staff'));

create or replace function public.prevent_accounting_period_event_mutation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  raise exception 'closing history is append-only and cannot be changed or deleted'
    using errcode = '45000';
end;
$$;

drop trigger if exists trg_accounting_period_events_append_only on public.accounting_period_events;
create trigger trg_accounting_period_events_append_only
before update or delete on public.accounting_period_events
for each row execute function public.prevent_accounting_period_event_mutation();

create or replace function public.stock_period_status_for(p_at timestamptz)
returns text
language sql
stable
set search_path = public
as $$
  select ap.status
  from public.accounting_periods ap
  where (p_at at time zone 'Asia/Bangkok')::date between ap.start_date and ap.end_date
  order by ap.start_date desc
  limit 1
$$;

create or replace function public.assert_stock_period_open(p_at timestamptz)
returns void
language plpgsql
stable
set search_path = public
as $$
declare
  v_status text;
begin
  select public.stock_period_status_for(p_at) into v_status;
  if v_status = 'closed' then
    raise exception 'งวดสต๊อกนี้ปิดแล้ว กรุณายกเลิกปิดงวดก่อนแก้ไข'
      using errcode = '45000';
  end if;
end;
$$;

create or replace function public.prevent_closed_stock_movement_mutation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_allowed text[] := array['is_locked', 'period_id'];
begin
  if tg_op = 'INSERT' then
    perform public.assert_stock_period_open(new.created_at);
    return new;
  end if;

  if tg_op = 'UPDATE' then
    -- Period close/reopen may only change lock metadata on historical movement rows.
    if (to_jsonb(new) - v_allowed) = (to_jsonb(old) - v_allowed) then
      return new;
    end if;

    perform public.assert_stock_period_open(old.created_at);
    perform public.assert_stock_period_open(new.created_at);
    return new;
  end if;

  if tg_op = 'DELETE' then
    perform public.assert_stock_period_open(old.created_at);
    return old;
  end if;

  return null;
end;
$$;

drop trigger if exists trg_prevent_closed_stock_movement_mutation on public.stock_movements;
create trigger trg_prevent_closed_stock_movement_mutation
before insert or update or delete on public.stock_movements
for each row execute function public.prevent_closed_stock_movement_mutation();

-- Harden the RPC path used by receive/sale/reservation/transfer/adjust writes.
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
) returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_mv_no text;
  v_mv_id uuid;
  v_period_id uuid;
  v_delta numeric;
begin
  perform public.assert_stock_period_open(now());

  select id into v_period_id from public.accounting_periods
  where status in ('open', 'review')
    and (now() at time zone 'Asia/Bangkok')::date between start_date and end_date
  order by start_date desc limit 1;

  if v_period_id is null then
    raise exception 'no open or review stock period is available for today' using errcode = '45000';
  end if;

  v_mv_no := 'MV-' || to_char(now() at time zone 'Asia/Bangkok','YYYY') || '-'
    || lpad(nextval('public.stock_movement_seq')::text, 5, '0');

  v_delta := case
    when p_type in ('receive','transfer_in','adjust_add','return') then  p_qty
    when p_type in ('sale','transfer_out','adjust_sub')            then -p_qty
    else 0
  end;

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

  if p_type not in ('reservation', 'cancel_res') then
    perform public.adjust_stock(p_warehouse_id, p_product_id, p_variety_id, v_delta, p_unit);
  end if;

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

grant execute on function public.stock_period_status_for(timestamptz) to authenticated, service_role;
grant execute on function public.assert_stock_period_open(timestamptz) to authenticated, service_role;
grant execute on function public.create_stock_movement(text, uuid, uuid, uuid, text, text, numeric, numeric, numeric, text, uuid, text, text, uuid, uuid) to authenticated, service_role;
