-- Migration: unowned plots support
-- ภาคสนามเพิ่มแปลงได้โดยไม่ต้องระบุสมาชิก
-- ระบุสมาชิกทีหลังได้

-- 1. ทำให้ plots.member_id nullable
alter table public.plots
  alter column member_id drop not null;

-- 2. เพิ่ม column สำหรับ tracking
alter table public.plots
  add column if not exists added_by_staff_id uuid
    references public.members(id) on delete set null,
  add column if not exists unowned_note text,        -- หมายเหตุ เช่น "พบระหว่างตรวจ"
  add column if not exists crop_observed text,       -- พืชที่พบ เช่น 'ข้าวโพด'
  add column if not exists observed_stage text       -- สถานะที่เห็น เช่น 'กำลังปลูก'
    check (observed_stage in ('seedling','growing','mature','harvested','unknown') or observed_stage is null),
  add column if not exists observed_days_est int,    -- ประมาณอายุพืช (วัน)
  add column if not exists assigned_to_member_at timestamptz; -- วันที่ระบุสมาชิก

-- 3. อัปเดต RLS — staff เพิ่ม unowned plot ได้
drop policy if exists plots_crud_own_or_admin_staff on public.plots;
create policy plots_crud_own_or_admin_staff
  on public.plots for all
  using (
    member_id = public.current_member_id()
    or member_id is null
    or public.current_member_is_admin_or_staff()
  )
  with check (
    member_id = public.current_member_id()
    or member_id is null
    or public.current_member_is_admin_or_staff()
  );

-- 4. Index สำหรับ unowned plots dashboard
create index if not exists idx_plots_unowned
  on public.plots(status, created_at desc)
  where member_id is null;

create index if not exists idx_plots_staff_added
  on public.plots(added_by_staff_id)
  where added_by_staff_id is not null;
