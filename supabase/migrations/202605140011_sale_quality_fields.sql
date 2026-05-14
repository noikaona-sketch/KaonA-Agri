-- เพิ่ม quality fields หลังการขาย/เกี่ยว
-- สมาชิกและรถเกี่ยวจะเห็นข้อมูลนี้

alter table public.sale_appointments
  add column if not exists scheduled_date date,
  add column if not exists quality_moisture  numeric(5,2),  -- % ความชื้น
  add column if not exists quality_grade     text           -- A/B/C
    check (quality_grade in ('A','B','C','reject') or quality_grade is null),
  add column if not exists quality_note      text,
  add column if not exists quality_recorded_at timestamptz,
  add column if not exists quality_recorded_by uuid references public.members(id);

-- อัปเดต scheduled_date จาก appointment_date ถ้า column เดิมชื่อต่างกัน
-- (ตรวจก่อนว่า appointment_date มีอยู่หรือเปล่า)
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'sale_appointments'
      and column_name = 'appointment_date'
  ) then
    update public.sale_appointments
    set scheduled_date = appointment_date
    where scheduled_date is null;
  end if;
end;
$$;

alter table public.harvest_bookings
  add column if not exists quality_moisture  numeric(5,2),
  add column if not exists quality_grade     text
    check (quality_grade in ('A','B','C','reject') or quality_grade is null),
  add column if not exists quality_note      text,
  add column if not exists truck_status      text
    check (truck_status in ('pending','on_way','harvesting','done') or truck_status is null),
  add column if not exists quality_recorded_by uuid references public.members(id);

-- view: member เห็นผลการขาย + คุณภาพ
create or replace view public.member_sale_history as
select
  sa.id,
  sa.appointment_number,
  sa.member_id,
  sa.planting_cycle_id,
  pc.crop_name,
  pc.season_year,
  sa.scheduled_date,
  sa.estimated_qty_kg,
  sa.actual_qty_kg,
  sa.price_per_kg,
  sa.total_amount,
  sa.status,
  sa.payment_status,
  sa.paid_amount,
  sa.quality_moisture,
  sa.quality_grade,
  sa.quality_note,
  sa.quality_recorded_at,
  sa.note,
  sa.created_at
from public.sale_appointments sa
join public.planting_cycles pc on pc.id = sa.planting_cycle_id
order by sa.created_at desc;

-- market_prices: ดูราคาล่าสุดได้จาก view
create or replace view public.latest_market_prices as
select distinct on (crop_type)
  id, crop_type, price_per_kg, effective_date, note
from public.market_prices
where is_active = true
order by crop_type, effective_date desc;
