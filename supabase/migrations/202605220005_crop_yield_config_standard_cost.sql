-- เพิ่มต้นทุนมาตรฐานต่อไร่ใน crop_yield_config
-- ใช้เป็น fallback เมื่อเกษตรกรไม่ได้กรอกต้นทุนเอง
-- logic: เกษตรกรกรอก → ใช้ของเกษตรกร, ไม่กรอก → ใช้ค่ามาตรฐาน admin

alter table public.crop_yield_config
  add column if not exists standard_cost_per_rai_burn    numeric(12,2) default null,
  add column if not exists standard_cost_per_rai_no_burn numeric(12,2) default null,
  add column if not exists standard_price_per_kg         numeric(8,4)  default null;

comment on column public.crop_yield_config.standard_cost_per_rai_burn
  is 'ต้นทุนมาตรฐาน/ไร่ สำหรับเกษตรกรที่เผาตอซัง (fallback)';
comment on column public.crop_yield_config.standard_cost_per_rai_no_burn
  is 'ต้นทุนมาตรฐาน/ไร่ สำหรับเกษตรกรที่ไม่เผาตอซัง (fallback)';
comment on column public.crop_yield_config.standard_price_per_kg
  is 'ราคามาตรฐาน บาท/กก. สำหรับใช้คำนวณรายได้โดยประมาณ (fallback)';

-- seed ค่าเริ่มต้น ข้าวโพด (ปรับตามราคาตลาดในพื้นที่ได้)
update public.crop_yield_config
  set
    standard_cost_per_rai_burn    = 4500,
    standard_cost_per_rai_no_burn = 4200,
    standard_price_per_kg         = 4.50
  where crop_type = 'ข้าวโพด';
