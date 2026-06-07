-- Security hardening: make public views execute with SECURITY INVOKER semantics.
--
-- Supabase's security_definer_view lint is raised for owner-executed views. These
-- views do not need SECURITY DEFINER because the app already models access via
-- table RLS plus current_member_id()/current_member_has_role() predicates. Keep
-- member-facing views scoped to the current member where they contain member data,
-- and keep admin/reporting views empty for anon/member callers.

-- ── Farming/admin map views ───────────────────────────────────────────
create or replace view public.farming_map_view
with (security_invoker = true) as
select
  pc.id as cycle_id,
  pc.member_id,
  m.full_name as member_name,
  pc.crop_name,
  pc.season_year,
  pc.status,
  pc.planted_at,
  pc.expected_harvest_at,
  pc.actual_harvest_at,
  pc.area_planted_rai,
  pc.estimated_yield_kg,
  pc.actual_yield_kg,
  pc.quota_kg,
  pc.seed_qty_used,
  case
    when pc.expected_harvest_at is not null then pc.expected_harvest_at
    when pc.planted_at is not null and p.days_to_harvest is not null then
      pc.planted_at + p.days_to_harvest
    else null
  end as harvest_date_estimated,
  case
    when pc.expected_harvest_at is not null then
      (pc.expected_harvest_at - current_date)
    when pc.planted_at is not null and p.days_to_harvest is not null then
      (pc.planted_at + p.days_to_harvest - current_date)
    else null
  end as days_to_harvest,
  mp.price_per_kg,
  coalesce(pc.estimated_yield_kg, 0) * coalesce(mp.price_per_kg, 0) as estimated_revenue,
  pl.lat,
  pl.lng,
  pl.name as plot_name,
  pl.area_rai as plot_area_rai,
  pl.province,
  case
    when pc.status in ('harvested','completed') then 'grey'
    when pc.expected_harvest_at <= current_date + 14
      or (pc.planted_at + coalesce(p.days_to_harvest, 999)) <= current_date + 14 then 'red'
    when pc.expected_harvest_at <= current_date + 30
      or (pc.planted_at + coalesce(p.days_to_harvest, 999)) <= current_date + 30 then 'orange'
    when pc.status in ('planted','growing','flowering','maturing') then 'green'
    else 'blue'
  end as map_color
from public.planting_cycles pc
join public.members m on m.id = pc.member_id
join public.plots pl on pl.id = pc.plot_id
left join public.products p on p.id = pc.product_id
left join lateral (
  select price_per_kg from public.market_prices
  where crop_type = pc.crop_name and is_active = true
  order by effective_date desc limit 1
) mp on true
where pc.status not in ('cancelled')
  and pl.lat is not null
  and pl.lng is not null
  and (
    auth.role() = 'service_role'
    or pc.member_id = public.current_member_id()
    or public.current_member_has_role('admin')
    or public.current_member_has_role('staff')
    or public.current_member_has_role('field')
    or public.current_member_has_role('inspector')
  );

create or replace view public.harvest_calendar
with (security_invoker = true) as
select
  date_trunc('week', harvest_date_estimated) as week_start,
  count(*) as plot_count,
  sum(estimated_yield_kg) as total_estimated_kg,
  sum(estimated_revenue) as total_estimated_revenue,
  array_agg(distinct crop_name) as crop_types,
  array_agg(cycle_id) as cycle_ids
from public.farming_map_view
where harvest_date_estimated is not null
  and harvest_date_estimated between current_date and current_date + interval '180 days'
  and map_color != 'grey'
  and (
    auth.role() = 'service_role'
    or public.current_member_has_role('admin')
    or public.current_member_has_role('staff')
    or public.current_member_has_role('field')
    or public.current_member_has_role('inspector')
  )
group by date_trunc('week', harvest_date_estimated)
order by week_start;

create or replace view public.member_farm_dashboard
with (security_invoker = true) as
select
  pc.member_id,
  count(*) as total_cycles,
  count(*) filter (where pc.status = 'planted')  as planted_count,
  count(*) filter (where pc.status = 'growing')  as growing_count,
  count(*) filter (where pc.status = 'harvested') as harvested_count,
  coalesce(sum(pc.area_planted_rai), 0) as total_area_rai,
  coalesce(sum(pc.estimated_yield_kg), 0) as total_estimated_yield_kg,
  coalesce(sum(pc.actual_yield_kg), 0) as total_actual_yield_kg,
  coalesce(sum(pc.quota_kg), 0) as total_quota_kg,
  min(case when pc.status not in ('harvested','cancelled')
    then coalesce(pc.expected_harvest_at, pc.planted_at + 90)
    else null
  end) as next_harvest_date
from public.planting_cycles pc
where pc.status not in ('cancelled')
  and (
    auth.role() = 'service_role'
    or pc.member_id = public.current_member_id()
    or public.current_member_has_role('admin')
    or public.current_member_has_role('staff')
    or public.current_member_has_role('field')
  )
group by pc.member_id;

-- ── Member sales/catalog views ────────────────────────────────────────
create or replace view public.member_product_catalog
with (security_invoker = true) as
select
  p.id,
  p.name,
  p.brand,
  p.category,
  p.description,
  p.unit,
  p.price_per_unit,
  p.seed_variety,
  p.crop_type,
  p.days_to_harvest,
  p.planting_guide,
  p.planting_spacing_cm,
  p.water_requirement,
  p.fertilizer_guide,
  p.stock_qty,
  p.is_low_stock,
  case when p.stock_qty > 0 then true else false end as in_stock,
  p.sort_order
from public.products p
where p.deleted_at is null
  and p.is_active = true
  and p.is_visible_to_members = true
order by p.sort_order, p.category, p.name;

create or replace view public.member_order_history
with (security_invoker = true) as
select
  so.id,
  so.order_number,
  so.order_type,
  so.status,
  so.payment_status,
  so.total,
  so.paid_amount,
  so.payment_method,
  so.pickup_date,
  so.reserved_until,
  so.note,
  so.created_at,
  so.member_id,
  coalesce(
    jsonb_agg(
      jsonb_build_object(
        'product_id',   oi.product_id,
        'product_name', oi.product_name,
        'qty',          oi.qty,
        'unit',         oi.product_unit,
        'unit_price',   oi.unit_price,
        'subtotal',     oi.subtotal
      ) order by oi.created_at
    ) filter (where oi.id is not null),
    '[]'::jsonb
  ) as items
from public.sale_orders so
left join public.order_items oi on oi.order_id = so.id
where auth.role() = 'service_role'
   or so.member_id = public.current_member_id()
   or public.current_member_has_role('admin')
   or public.current_member_has_role('staff')
   or public.current_member_has_role('sales')
group by so.id;

create or replace view public.member_seed_variety_catalog
with (security_invoker = true) as
select
  sv.id, sv.variety_name, sv.crop_type,
  sv.days_to_harvest, sv.seed_per_rai_kg, sv.yield_per_rai,
  sv.planting_spacing, sv.season, sv.bag_weight_kg,
  sv.price_per_bag, sv.planting_guide, sv.fertilizer_guide,
  sv.notes, sv.sort_order,
  ss.supplier_name,
  coalesce(
    (select sum(sl.quantity_balance)
     from public.seed_stock_lots sl
     where sl.variety_id = sv.id and sl.status = 'available'), 0
  ) as stock_available,
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

-- ── Admin seed/stock views ────────────────────────────────────────────
create or replace view public.admin_seed_lot_status
with (security_invoker = true) as
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
  and (
    auth.role() = 'service_role'
    or public.current_member_has_role('admin')
    or public.current_member_has_role('staff')
    or public.current_member_has_role('sales')
  )
order by sl.status = 'available' desc, sl.received_date desc;

create or replace view public.admin_seed_reservations
with (security_invoker = true) as
select
  sr.id, sr.reservation_no, sr.status, sr.stock_deducted,
  sr.qty_reserved, sr.qty_received, sr.price_per_bag, sr.total_amount,
  sr.pickup_date, sr.note, sr.created_at,
  sr.product_id, sr.member_id,
  sr.source_channel, sr.attachment_url, sr.attachment_path,
  sr.qty_sold, sr.qty_remaining, sr.closed_at,
  m.full_name   as member_name,
  m.phone       as member_phone,
  p.name        as product_name,
  p.category    as product_category,
  p.unit        as product_unit,
  p.seed_variety as variety_name,
  p.crop_type,
  sr.variety_name  as variety_name_snapshot,
  sr.supplier_name,
  sr.sale_order_id
from public.seed_reservations sr
join  public.members  m on m.id  = sr.member_id
left join public.products p on p.id = sr.product_id
where auth.role() = 'service_role'
   or public.current_member_has_role('admin')
   or public.current_member_has_role('staff')
   or public.current_member_has_role('sales')
order by sr.created_at desc;

create or replace view public.admin_stock_status
with (security_invoker = true) as
select
  p.id,
  p.name,
  p.brand,
  p.category,
  p.unit,
  p.price_per_unit,
  p.stock_qty,
  p.min_stock_alert,
  p.is_low_stock,
  p.is_active,
  coalesce(sold.total_sold, 0) as total_sold_qty,
  coalesce(reserved.total_reserved, 0) as total_reserved_qty,
  p.updated_at
from public.products p
left join (
  select product_id, sum(qty) as total_sold
  from public.order_items oi
  join public.sale_orders so on so.id = oi.order_id
  where so.status = 'completed'
  group by product_id
) sold on sold.product_id = p.id
left join (
  select product_id, sum(qty) as total_reserved
  from public.order_items oi
  join public.sale_orders so on so.id = oi.order_id
  where so.status in ('pending','confirmed','ready')
    and so.order_type = 'reservation'
  group by product_id
) reserved on reserved.product_id = p.id
where p.deleted_at is null
  and (
    auth.role() = 'service_role'
    or public.current_member_has_role('admin')
    or public.current_member_has_role('staff')
    or public.current_member_has_role('sales')
  )
order by p.is_low_stock desc, p.sort_order, p.name;

-- ── Admin/service reporting views ─────────────────────────────────────
create or replace view public.provider_rating_summary
with (security_invoker = true) as
select
  m.id                             as member_id,
  m.full_name,
  m.phone,
  count(r.id)                      as total_ratings,
  round(avg(r.score_punctuality),2) as avg_punctuality,
  round(avg(r.score_quality),2)     as avg_quality,
  round(avg(r.score_loss),2)        as avg_loss,
  round(avg(r.score_cleanliness),2) as avg_cleanliness,
  round(avg(r.score_safety),2)      as avg_safety,
  round(avg(r.score_total),2)       as avg_total,
  case
    when avg(r.score_total) >= 4.5 then 'A+'
    when avg(r.score_total) >= 4.0 then 'A'
    when avg(r.score_total) >= 3.5 then 'B+'
    when avg(r.score_total) >= 3.0 then 'B'
    else 'C'
  end                              as overall_grade,
  max(r.created_at)                as last_rated_at
from public.members m
join public.member_roles mr on mr.member_id = m.id and mr.role = 'truck_owner'
left join public.service_provider_ratings r on r.provider_member_id = m.id
where auth.role() = 'service_role'
   or public.current_member_has_role('admin')
   or public.current_member_has_role('staff')
group by m.id, m.full_name, m.phone;

create or replace view public.harvest_bookings_full
with (security_invoker = true) as
select
  hb.id,
  hb.planting_cycle_id,
  hb.member_id,
  hb.scheduled_date,
  hb.scheduled_time_start,
  hb.scheduled_time_end,
  hb.status,
  hb.truck_type,
  hb.truck_status,
  hb.truck_lat,
  hb.truck_lng,
  hb.truck_updated_at,
  hb.actual_date,
  hb.actual_yield_kg,
  hb.quality_grade,
  hb.quality_moisture,
  hb.quality_note,
  hb.note,
  m.full_name as member_name,
  m.phone     as member_phone,
  pl.name     as plot_name,
  pl.lat      as plot_lat,
  pl.lng      as plot_lng,
  pl.province as plot_province,
  pc.crop_name,
  pc.planted_at,
  pc.expected_harvest_at,
  pc.area_planted_rai,
  pc.estimated_yield_kg,
  pc.quota_kg,
  tm.full_name as truck_member_name,
  tm.phone     as truck_member_phone,
  hb.external_truck_name,
  hb.external_truck_plate,
  hb.external_truck_phone,
  sgq.grade_a_moisture_max,
  sgq.grade_b_moisture_max,
  sgq.buyer_spec,
  p.name  as product_name,
  p.brand as product_brand,
  p.seed_variety
from public.harvest_bookings hb
join public.members m on m.id = hb.member_id
join public.planting_cycles pc on pc.id = hb.planting_cycle_id
join public.plots pl on pl.id = coalesce(hb.plot_id, pc.plot_id)
left join public.members tm on tm.id = hb.truck_member_id
left join public.products p on p.id = pc.product_id
left join public.seed_quality_grades sgq on sgq.product_id = p.id
where auth.role() = 'service_role'
   or hb.member_id = public.current_member_id()
   or hb.truck_member_id = public.current_member_id()
   or public.current_member_has_role('admin')
   or public.current_member_has_role('staff')
   or public.current_member_has_role('field');

create or replace view public.vehicle_harvest_summary
with (security_invoker = true) as
select
  pv.id                                        as vehicle_id,
  pv.provider_id,
  pv.vehicle_type,
  pv.brand,
  pv.plate_number,
  sp.team_name                                 as provider_name,
  sp.phone                                     as provider_phone,
  count(hb.id)                                 as total_jobs,
  count(hb.id) filter (where hb.status = 'completed') as completed_jobs,
  sum(hb.actual_received_kg) filter (where hb.status = 'completed') as total_kg,
  count(*) filter (where hb.quality_grade = 'A') as grade_a_count,
  count(*) filter (where hb.quality_grade = 'B') as grade_b_count,
  count(*) filter (where hb.quality_grade = 'C') as grade_c_count,
  count(*) filter (where hb.quality_grade = 'reject') as grade_reject_count,
  round(avg(hb.quality_moisture) filter (where hb.quality_moisture is not null), 2) as avg_moisture,
  round(
    count(*) filter (where hb.quality_grade = 'A')::numeric
    / nullif(count(*) filter (where hb.quality_grade is not null), 0) * 100
  , 1)                                          as grade_a_pct,
  round(avg(r.score_total), 2)                  as avg_rating,
  round(avg(r.score_punctuality), 2)            as avg_punctuality,
  round(avg(r.score_quality), 2)                as avg_quality,
  round(avg(r.score_loss), 2)                   as avg_loss,
  count(r.id)                                   as rating_count,
  max(hb.actual_completed_at)                   as last_job_at
from public.provider_vehicles pv
join public.service_providers sp on sp.id = pv.provider_id
left join public.harvest_bookings hb on hb.provider_vehicle_id = pv.id
left join public.service_provider_ratings r on r.provider_vehicle_id = pv.id
where auth.role() = 'service_role'
   or public.current_member_has_role('admin')
   or public.current_member_has_role('staff')
group by pv.id, pv.provider_id, pv.vehicle_type, pv.brand,
         pv.plate_number, sp.team_name, sp.phone;

-- Do not leave implicit PUBLIC/anon access on these public-schema views.
revoke all on
  public.farming_map_view,
  public.harvest_calendar,
  public.admin_seed_lot_status,
  public.member_product_catalog,
  public.admin_seed_reservations,
  public.admin_stock_status,
  public.member_farm_dashboard,
  public.provider_rating_summary,
  public.member_order_history,
  public.harvest_bookings_full,
  public.vehicle_harvest_summary,
  public.member_seed_variety_catalog
from public;

revoke all on
  public.farming_map_view,
  public.harvest_calendar,
  public.admin_seed_lot_status,
  public.member_product_catalog,
  public.admin_seed_reservations,
  public.admin_stock_status,
  public.member_farm_dashboard,
  public.provider_rating_summary,
  public.member_order_history,
  public.harvest_bookings_full,
  public.vehicle_harvest_summary,
  public.member_seed_variety_catalog
from anon;

grant select on
  public.farming_map_view,
  public.harvest_calendar,
  public.admin_seed_lot_status,
  public.member_product_catalog,
  public.admin_seed_reservations,
  public.admin_stock_status,
  public.member_farm_dashboard,
  public.provider_rating_summary,
  public.member_order_history,
  public.harvest_bookings_full,
  public.vehicle_harvest_summary,
  public.member_seed_variety_catalog
to authenticated;

grant select on
  public.farming_map_view,
  public.harvest_calendar,
  public.admin_seed_lot_status,
  public.member_product_catalog,
  public.admin_seed_reservations,
  public.admin_stock_status,
  public.member_farm_dashboard,
  public.provider_rating_summary,
  public.member_order_history,
  public.harvest_bookings_full,
  public.vehicle_harvest_summary,
  public.member_seed_variety_catalog
to service_role;
