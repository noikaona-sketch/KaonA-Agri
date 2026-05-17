-- Fix plots_read_auth policy: ใช้ deleted_at IS NULL แต่ column ไม่มีใน plots table
-- Drop policy เดิมที่ผิด แล้วสร้างใหม่ผูกกับ member

drop policy if exists plots_read_auth on public.plots;

-- SELECT: เห็นแค่แปลงของตัวเอง หรือ admin/staff เห็นทั้งหมด
create policy plots_read_auth
  on public.plots for select
  using (
    member_id = public.current_member_id()
    or public.current_member_is_admin_or_staff()
  );
