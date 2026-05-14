-- เพิ่ม LINE profile columns ใน members
alter table public.members
  add column if not exists line_display_name text,
  add column if not exists line_picture_url  text;

comment on column public.members.line_display_name is 'ชื่อ LINE ของสมาชิก (จาก LINE profile)';
comment on column public.members.line_picture_url  is 'URL รูปโปรไฟล์ LINE';
