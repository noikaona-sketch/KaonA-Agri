-- Fix plots_read_auth policy: ใช้ deleted_at IS NULL แต่ column ไม่มีใน plots table
-- Drop policy เดิมที่ผิด แล้วสร้างใหม่ให้ถูกต้อง

drop policy if exists plots_read_auth on public.plots;

-- ให้ authenticated user อ่านได้ทุก row (RLS จำกัดเพิ่มเติมด้วย can_access_member)
create policy plots_read_auth
  on public.plots for select
  using (true);
