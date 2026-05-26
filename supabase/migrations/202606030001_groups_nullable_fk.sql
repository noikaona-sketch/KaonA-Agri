-- แก้ FK ที่บังคับ created_by/added_by ให้ nullable
-- เพื่อให้ ENV admin (env-super-admin) สร้างกลุ่มได้

alter table public.member_groups
  alter column created_by drop not null;

alter table public.member_group_members
  alter column added_by drop not null;

-- เพิ่ม is_leader column สำหรับกำหนดหัวหน้ากลุ่ม
alter table public.member_group_members
  add column if not exists is_leader boolean not null default false;
