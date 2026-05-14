-- เพิ่ม address fields แยกย่อย ใน members
alter table public.members
  add column if not exists house_no     text,
  add column if not exists moo          text,
  add column if not exists subdistrict  text,
  add column if not exists district     text,
  add column if not exists province     text;

comment on column public.members.house_no    is 'บ้านเลขที่';
comment on column public.members.moo         is 'หมู่ที่';
comment on column public.members.subdistrict is 'ตำบล/แขวง';
comment on column public.members.district    is 'อำเภอ/เขต';
comment on column public.members.province    is 'จังหวัด';
