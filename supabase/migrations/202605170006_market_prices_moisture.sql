-- เพิ่ม moisture_pct และ price_type ใน market_prices
-- moisture_pct: ความชื้น เช่น 30.0 = ข้าวโพดสด, 14.5 = ข้าวโพดแห้งมาตรฐาน
-- price_type: 'market' = ราคาประกาศ, 'member' = ราคาสมาชิก KaonA

alter table public.market_prices
  add column if not exists moisture_pct numeric(5,1) default null,
  add column if not exists price_type   text        not null default 'market'
    check (price_type in ('market','member'));

comment on column public.market_prices.moisture_pct is 'ความชื้น % เช่น 30.0 หรือ 14.5';
comment on column public.market_prices.price_type   is 'market=ราคาประกาศ, member=ราคาสมาชิก';

-- backfill: ราคาเดิมเป็น market ทั้งหมด (default แล้ว)
-- ── seed ราคาเริ่มต้น (เฉพาะถ้า ยังไม่มีราคาข้าวโพด active อยู่เลย) ──────
-- ป้องกันการ overwrite ราคาจริงที่ admin กรอกไว้แล้ว
do $$ begin
  if not exists (
    select 1 from public.market_prices
    where crop_type = 'ข้าวโพด' and is_active = true
  ) then
    insert into public.market_prices
      (crop_type, price_per_kg, moisture_pct, price_type, effective_date, note, is_active)
    values
      ('ข้าวโพด', 0, 30.0,  'market', current_date, 'ราคาเริ่มต้น — กรุณาอัปเดตก่อนใช้งาน', true),
      ('ข้าวโพด', 0, 14.5,  'market', current_date, 'ราคาเริ่มต้น — กรุณาอัปเดตก่อนใช้งาน', true);
  end if;
end $$;
