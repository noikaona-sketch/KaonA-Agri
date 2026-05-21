# สรุป Issues ระบบสมัครสมาชิก — วิเคราะห์ ณ วันที่ 12 พ.ค. 2569

## ทำไมระบบสมัครสมาชิกยังใช้งานไม่ได้

ปัญหาหลักคือ **auth flow ขาด Supabase session** ทำให้ทุกอย่างพัง:

```
LINE Login → LIFF ID Token
     ↓
/api/auth/line  ← verify token ✅, สร้าง member row ✅
     ↓
     ❌ ไม่ได้สร้าง Supabase Auth user
     ❌ ไม่ได้ set auth_user_id ใน members table
     ❌ ไม่ได้ return session token ให้ client
     ↓
Client → status = 'approved' แต่ Supabase client ไม่มี session
     ↓
RLS block ทุก query → ระบบพัง
```

---

## Issues ที่ต้องแก้ (เรียงตาม priority)

| # | ไฟล์ | ปัญหา | Priority |
|---|---|---|---|
| [1](issue-register-auth-session-missing.md) | `/api/auth/line/route.ts` | ไม่สร้าง Supabase Auth user + ไม่ set `auth_user_id` | **P0 Blocker** |
| [2](issue-register-flow-no-supabase-session-on-client.md) | `auth-provider.tsx` | Client ไม่ได้รับ/set Supabase session หลัง auth | **P0 Blocker** |
| [3](issue-register-api-member-register-wrong-flow.md) | `/api/member/register/route.ts` | Flow ผิด + approvals partial index conflict | **P0 Blocker** |
| [4](issue-register-ocr-not-configured.md) | `/api/ocr/id-card/route.ts` | `OCR_API_KEY` ไม่ได้ตั้งค่า → 503 ทุกครั้ง | P1 |
| [5](issue-register-pending-approval-panel-css-var-missing.md) | `pending-approval-panel.tsx` | CSS variables `--line-soft`, `--text-muted` ไม่มีในระบบ | P2 |
| [6](issue-register-env-vars-missing-docs.md) | README / `.env.example` | `SUPABASE_SERVICE_ROLE_KEY`, `LINE_CHANNEL_ID`, `OCR_API_KEY` ไม่มีใน docs | P1 |

---

## Flow ที่ถูกต้องหลังแก้ Issues P0

```
LINE LIFF Login
     ↓
ensureLiffIdToken() → LINE ID Token
     ↓
POST /api/auth/line
  1. verify token กับ LINE API
  2. supabase.auth.admin.createUser() หรือ getUserById()  ← ต้องเพิ่ม
  3. upsert members row พร้อม auth_user_id              ← ต้องเพิ่ม
  4. supabase.auth.admin.createSession()                ← ต้องเพิ่ม
  5. return { member, session: { access_token, refresh_token } }
     ↓
auth-provider.tsx
  supabase.auth.setSession({ access_token, refresh_token })  ← ต้องเพิ่ม
  setStatus('approved')
     ↓
/member/register — MemberRegistrationMVP
  กรอก fullName, phone, citizenId, address
     ↓
POST /api/member/register
  verify token อีกครั้ง
  update members row ด้วยข้อมูลที่กรอก
  สร้าง approvals record
     ↓
status = 'pending_approval' → รอ admin อนุมัติ
```
| [7](issue-admin-member-import-execution-phase-2.md) | Admin import flow (phase 2) | Safe import flow with preview, confirm execution, repair review, audit logging, rollback safety | P1 |

