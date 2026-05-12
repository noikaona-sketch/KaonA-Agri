# [BUG] ระบบสมัครสมาชิก: `/api/auth/line` ไม่ได้สร้าง Supabase Auth session

**Labels:** `bug` `auth` `blocker`  
**Priority:** P0 — ระบบสมัครสมาชิกยังใช้งานไม่ได้จนกว่าจะแก้

## ปัญหา

`POST /api/auth/line` ทำแค่:
1. Verify LINE ID token กับ LINE API ✅
2. หา/สร้าง row ใน `public.members` ✅
3. Return JSON `{ member: ... }` ✅

**แต่ขาดขั้นตอนสำคัญ:**  
ไม่มีการเรียก `supabase.auth.admin.createUser()` หรือ `signInWithIdToken()` เลย  
→ `members.auth_user_id` จะเป็น `null` ตลอด  
→ RLS ทุก policy ใช้ `auth.uid() → members.auth_user_id` ไม่ได้  
→ user เข้าแอปได้แต่ดึง/เขียนข้อมูลจาก Supabase ไม่ได้เลย

## Root Cause

```ts
// app/api/auth/line/route.ts — บรรทัดที่สร้าง member ใหม่
const insertedMember = await supabase
  .from('members')
  .insert({
    line_user_id: verifyData.sub,
    full_name: verifyData.name ?? 'LINE Member',
    citizen_id_masked: 'PENDING',
    status: 'pending',
    // ❌ auth_user_id ไม่ถูก set!
  })
```

สำหรับ member เดิมที่มีอยู่แล้ว ก็ไม่มีการสร้าง Supabase session return กลับไปให้ client

## วิธีแก้ (แนวทาง)

ใน `POST /api/auth/line`:

```ts
// 1. สร้าง / หา Supabase Auth user ด้วย service role
const { data: authUser } = await supabase.auth.admin.getUserByEmail(...)
// หรือ upsert ผ่าน admin API โดยใช้ line_user_id เป็น email placeholder

// 2. อัปเดต members.auth_user_id
await supabase.from('members').update({ auth_user_id: authUser.id }).eq('line_user_id', verifyData.sub)

// 3. สร้าง session token สำหรับ client
const { data: session } = await supabase.auth.admin.createSession({ user_id: authUser.id })

// 4. Return session ไปพร้อม member
return NextResponse.json({ member: ..., session: { access_token, refresh_token } })
```

Client (`auth-provider.tsx`) ต้องรับ `session` แล้วเรียก:
```ts
await supabaseClient.auth.setSession({ access_token, refresh_token })
```

## Acceptance Criteria

- [ ] หลัง `/api/auth/line` สำเร็จ → `members.auth_user_id` ไม่เป็น null
- [ ] Client มี Supabase session ที่ใช้กับ RLS ได้
- [ ] `auth.uid()` ใน DB match กับ `members.auth_user_id`
- [ ] RLS policy ทดสอบผ่านด้วย demo seed accounts
