# Contributing to KaonA-Agri

> **For AI assistants**: Read `docs/SUPABASE_RULES.md` before writing any Supabase query.  
> **For developers**: This is a Thai agricultural management system built with Next.js 14 + Supabase + LINE LIFF.

---

## Must-Read Docs

| File | เมื่อไหร่ต้องอ่าน |
|---|---|
| [`docs/SUPABASE_RULES.md`](./docs/SUPABASE_RULES.md) | ก่อนเขียน Supabase query หรือ TypeScript type ทุกครั้ง |
| [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md) | เมื่อต้องการเข้าใจโครงสร้างระบบ |

---

## Stack

- **Frontend**: Next.js 14 (App Router) + TypeScript + Tailwind (minimal)
- **Backend**: Supabase (PostgreSQL + RLS + RPCs)
- **Auth**: LINE LIFF → `/api/auth/line` → Supabase session
- **Admin Auth**: ENV fallback (`ADMIN_WEB_EMAIL` + `ADMIN_WEB_PASSWORD`) + `admin_users` table
- **Deploy**: Vercel

---

## Folder Structure

```
app/
  admin/          — Admin web pages (protected by middleware)
  api/
    admin/        — Admin API routes (service role, bypass RLS)
    member/       — Member API routes (LINE token verify)
    auth/         — Auth routes (LINE LIFF)
  (mobile pages)  — LINE LIFF member-facing pages

src/
  features/       — Feature components grouped by domain
  shared/         — Shared components, hooks, types
  providers/      — AuthProvider (LIFF bootstrap)
  lib/            — Supabase clients, env helpers

supabase/
  migrations/     — All DB migrations in order

docs/             — Rules and guidelines
```

---

## Key Rules

### 1. Supabase Nested Relations → Always Arrays
See [`docs/SUPABASE_RULES.md`](./docs/SUPABASE_RULES.md) — Rule 1.  
This is the #1 recurring build failure.

### 2. Admin vs Member API Routes
- `/api/admin/*` → use `createServerSupabaseClient()` (service role)
- `/api/member/*` → verify LINE token first, then service role

### 3. Stock Decrement → Server Only
Never call `decrement_lot_balance()` or any stock-modifying RPC from the browser client.

### 4. Do NOT Touch
- `/api/auth/line` — LINE auth flow
- `middleware.ts` — admin route protection
- RLS policies (add new ones carefully, never drop existing)

---

## Before Every PR

```bash
npx tsc --noEmit   # must pass with 0 errors
```

## ⚠️ Missing Import Bug

`npx tsc --noEmit` อาจผ่าน แต่ Next.js build fail เพราะ missing import

**สาเหตุ:** TypeScript ตรวจ type แต่ webpack bundle หา module จริง

**ป้องกัน:** ก่อน commit ตรวจ imports ที่ใช้ใน JSX ทุกตัว:
```bash
npx next build  # หรือดู Vercel build log
```
