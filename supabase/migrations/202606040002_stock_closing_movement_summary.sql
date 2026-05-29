-- Aggregate monthly stock movements in SQL for stock closing snapshots.

create index if not exists idx_sm_closing_period_warehouse_item
  on public.stock_movements(created_at, warehouse_id, product_id, variety_id, movement_type);

create or replace function public.stock_closing_movement_summary(
  p_start_date date,
  p_end_date date,
  p_warehouse_id uuid default null
)
returns table (
  warehouse_id uuid,
  product_id uuid,
  variety_id uuid,
  product_name text,
  unit text,
  receive_qty numeric,
  out_qty numeric,
  transfer_in_qty numeric,
  transfer_out_qty numeric,
  adjustment_qty numeric,
  reserved_qty numeric,
  movement_count bigint
)
language sql
stable
security definer
set search_path = public
as $$
  select
    sm.warehouse_id,
    sm.product_id,
    sm.variety_id,
    max(sm.product_name) as product_name,
    max(sm.unit) as unit,
    coalesce(sum(sm.qty) filter (where sm.movement_type in ('receive', 'return')), 0) as receive_qty,
    coalesce(sum(sm.qty) filter (where sm.movement_type = 'sale'), 0) as out_qty,
    coalesce(sum(sm.qty) filter (where sm.movement_type = 'transfer_in'), 0) as transfer_in_qty,
    coalesce(sum(sm.qty) filter (where sm.movement_type = 'transfer_out'), 0) as transfer_out_qty,
    coalesce(sum(case
      when sm.movement_type = 'adjust_add' then sm.qty
      when sm.movement_type = 'adjust_sub' then -sm.qty
      else 0
    end), 0) as adjustment_qty,
    coalesce(sum(case
      when sm.movement_type = 'reservation' then sm.qty
      when sm.movement_type = 'cancel_res' then -sm.qty
      else 0
    end), 0) as reserved_qty,
    count(*) as movement_count
  from public.stock_movements sm
  where sm.created_at >= p_start_date::timestamptz
    and sm.created_at < (p_end_date + 1)::timestamptz
    and (p_warehouse_id is null or sm.warehouse_id = p_warehouse_id)
  group by sm.warehouse_id, sm.product_id, sm.variety_id
  order by max(sm.product_name);
$$;

grant execute on function public.stock_closing_movement_summary(date, date, uuid) to authenticated;
