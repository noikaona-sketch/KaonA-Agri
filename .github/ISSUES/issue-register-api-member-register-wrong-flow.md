# [BUG] `/api/member/register` ใช้ flow ผิด: ต้องการ member ที่มีอยู่แล้ว แต่ flow จริงยังไม่มี

**Labels:** `bug` `registration` `blocker`  
**Priority:** P0

## ปัญหา

`POST /api/member/register` logic ปัจจุบัน:

```ts
// ค้นหา member ที่มีอยู่แล้วด้วย line_user_id
const { data: member } = await supabase
  .from('members')
  .select('id')
  .eq('line_user_id', lineUserId)
  .maybeSingle();

if (!member) {
  return 404; // ❌ ถ้าไม่มี member → return error
}
```

แต่ `/api/auth/line` สร้าง member row อัตโนมัติแล้วเมื่อ login ครั้งแรก  
→ **conflict ของ intent:** `/api/auth/line` insert member ด้วย `citizen_id_masked: 'PENDING'`  
→ `/api/member/register` ต้องการ update ข้อมูลนั้น  
→ แต่ถ้า `auth_user_id` ยังเป็น null (Issue #1) → RLS block การ update

## ปัญหาเพิ่มเติม: `approvals` upsert conflict key ไม่ครบ

```ts
await supabase.from('approvals').upsert(
  { ... },
  { onConflict: 'member_id,resource_type,resource_id' }
  // ❌ unique index จริงมีเงื่อนไข WHERE status = 'pending'
  // → partial index ไม่สามารถใช้เป็น onConflict key ตรงๆ ได้
);
```

Migration `202605070029` สร้าง partial unique index:
```sql
create unique index if not exists uq_approvals_member_pending
on public.approvals(member_id, resource_type, resource_id)
WHERE status = 'pending'; -- partial!
```
Supabase upsert `onConflict` กับ partial index อาจ error หรือ insert ซ้ำได้

## วิธีแก้

1. แก้ให้ `/api/member/register` ใช้ `register_member_mvp()` RPC function ที่มีอยู่แล้วใน DB (migration #27) แทนการ update ตรง
2. ทดสอบ approvals upsert กับ partial index — อาจต้องเปลี่ยนเป็น insert + on conflict do nothing

## Acceptance Criteria

- [ ] `POST /api/member/register` อัปเดต `full_name`, `phone`, `citizen_id_masked`, `address` ได้สำเร็จ
- [ ] approval record ถูกสร้างโดยไม่มี duplicate
- [ ] ไม่มี 404 สำหรับ user ที่เพิ่ง login ครั้งแรก
