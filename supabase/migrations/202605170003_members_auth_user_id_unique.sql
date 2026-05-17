-- PR 2: ensure auth_user_id uniqueness for safe linking
-- member เก่าที่ auth_user_id = null จะถูก link ตอน login ครั้งแรกผ่าน PR 1 logic
-- migration นี้แค่เพิ่ม unique index เพื่อป้องกัน duplicate anon users

create unique index if not exists idx_members_auth_user_id_unique
  on public.members(auth_user_id)
  where auth_user_id is not null;
