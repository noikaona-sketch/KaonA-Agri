# [BUG] ระบบสมัครสมาชิก: Client ไม่ได้รับ / set Supabase session หลัง auth สำเร็จ

**Labels:** `bug` `auth` `blocker`  
**Depends on:** issue-register-auth-session-missing  
**Priority:** P0

## ปัญหา

`auth-provider.tsx` หลังเรียก `/api/auth/line` สำเร็จ:

```ts
const bootstrapResult: AuthBootstrapResult = {
  ...payload.member,
  // ...
};
setMember(bootstrapResult);
setStatus('approved');
// ❌ ไม่มีการ setSession() ให้ supabase client เลย
```

ผลลัพธ์: แม้ `status === 'approved'` แต่ Supabase browser client ไม่มี session  
→ query ที่ต้องการ auth จาก client จะ fail (RLS block)

## วิธีแก้

```ts
// auth-provider.tsx — หลังได้ member payload
if (payload.session) {
  const supabase = tryCreateSupabaseBrowserClient();
  await supabase?.auth.setSession({
    access_token: payload.session.access_token,
    refresh_token: payload.session.refresh_token,
  });
}
```

## Acceptance Criteria

- [ ] หลัง bootstrap → `supabase.auth.getSession()` return session ที่ valid
- [ ] Supabase client queries จาก browser ผ่าน RLS ได้
