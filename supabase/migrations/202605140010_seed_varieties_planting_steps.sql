-- เพิ่ม planting_steps (JSON array) ใน seed_varieties
-- format: [{ day: "วันที่ 0", title: "เตรียมดิน", description: "...", icon: "🌱" }]
alter table public.seed_varieties
  add column if not exists planting_steps jsonb default '[]'::jsonb,
  add column if not exists mentor_name    text,
  add column if not exists mentor_phone   text;

comment on column public.seed_varieties.planting_steps is
  'ขั้นตอนการปลูก JSON array [{day,title,description,icon}]';
comment on column public.seed_varieties.mentor_name  is 'ชื่อพี่เลี้ยง/เจ้าหน้าที่';
comment on column public.seed_varieties.mentor_phone is 'เบอร์พี่เลี้ยง';
