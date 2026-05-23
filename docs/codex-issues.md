# KaonA-Agri — GitHub Issues for Codex

> **Stack:** Next.js 14 · Supabase · TypeScript · LINE LIFF
> **Repo:** noikaona-sketch/KaonA-Agri
> **Rules:** page ≤150 lines · component ≤200 · API route ≤80 · `tsc --noEmit` + `next build` must pass before every commit
> **Ref:** `docs/master-plan.md` for full spec · `docs/intake-data-layer-spec.md` for Zone 3

---

## 🔴 MILESTONE 1 — Pilot Blockers (Zone 0)

> ทำก่อนทุกอย่าง — ไม่ code แต่ต้อง verify

---

### Issue Z0-2 · Run all migrations on Supabase production

**Labels:** `infra` `pilot-blocker`

**Context:**
82 migration files exist under `supabase/migrations/`. None confirmed applied to production.

**Steps:**
1. Run `supabase db push` against production URL
2. Verify each table exists: `members`, `plots`, `planting_cycles`, `harvest_bookings`, `pickup_slots`, `pickup_locations`, `moisture_deductions`, `market_prices`, `campaign_announcements`, `intake_quota_templates`, `no_burn_requests`, `inspections`, `products`, `product_stock`, `stock_movements`
3. Confirm RLS is enabled on all tables
4. Document any migration failures in `docs/migration-log.md`

**Done when:** `supabase db diff` returns no changes

---

### Issue Z0-3 · Set LINE Channel Access Token in Vercel

**Labels:** `infra` `pilot-blocker`

**Context:**
`src/lib/line/push-message.ts` exists but `LINE_CHANNEL_ACCESS_TOKEN` env var is not set.
All LINE push notifications silently fail.

**Steps:**
1. Add `LINE_CHANNEL_ACCESS_TOKEN` to Vercel environment variables (Production + Preview)
2. Test by calling `POST /api/admin/seed-reservations` confirm → should send LINE push to farmer
3. Verify `pushLineMessage()` in `src/lib/line/push-message.ts` returns 200

**Done when:** farmer receives LINE message after admin action

---

### Issue Z0-4 · Verify RLS with real users (3 roles)

**Labels:** `security` `pilot-blocker`

**Context:**
RLS policies exist in migrations but have never been tested with real LINE-authenticated users.

**Steps:**
1. Create 3 test accounts: farmer A, farmer B, admin
2. Login as farmer A → confirm can only see own: plots, planting_cycles, harvest_bookings, no_burn_requests
3. Login as farmer B → confirm cannot see farmer A's data
4. Login as admin → confirm can see all
5. Document results in `docs/rls-verification.md`

**Files to check:**
- `app/api/auth/line/` — session creation
- All `select` queries in `app/api/member/` — should be scoped to member_id

**Done when:** farmer A cannot access farmer B's data in any API call

---

### Issue Z0-5 · Write Backup & Rollback SOP

**Labels:** `docs` `pilot-blocker`

**Output file:** `docs/backup-rollback-sop.md`

**Must cover:**
- How to take Supabase snapshot before deploy
- How to rollback Vercel deployment (use Vercel dashboard instant rollback)
- How to reverse a bad migration (`supabase migration repair`)
- Who to contact if LINE channel breaks
- Emergency: how to put site in maintenance mode

---

## 🟡 MILESTONE 2 — Member System (Zone 1)

---

### Issue Z1-1 · LINE push on member approve/reject

**Labels:** `feature` `line` `pilot-blocker`
**Difficulty:** Easy
**Files to modify:**
- `app/api/admin/members/approve/route.ts` (or wherever approval is handled)
- Uses existing: `src/lib/line/push-message.ts`

**Acceptance criteria:**
- Admin approves member → farmer receives LINE: "ยินดีด้วย! บัญชีของคุณได้รับการอนุมัติแล้ว เปิดแอปได้เลย 🌽"
- Admin rejects member → farmer receives LINE: "ขออภัย บัญชีของคุณยังไม่ได้รับการอนุมัติ กรุณาติดต่อเจ้าหน้าที่"
- If LINE push fails → approval still succeeds (fail silently, log error)
- `tsc --noEmit` passes · `next build` passes

**Implementation hint:**
```typescript
// After updating member status to 'approved':
await pushLineMessage(member.line_uid, {
  type: 'text',
  text: 'ยินดีด้วย! บัญชีของคุณได้รับการอนุมัติแล้ว เปิดแอปได้เลย 🌽'
}).catch(console.error) // fail silently
```

---

### Issue Z1-2 · UAT test script: member registration flow

**Labels:** `testing` `docs`
**Output file:** `docs/uat-member-flow.md`

**Script must cover (step by step with expected result):**
1. Open LINE → tap KaonA mini app → land on registration page
2. Fill all required fields → submit
3. Admin sees pending member in admin panel
4. Admin clicks approve
5. Farmer receives LINE notification
6. Farmer opens app → sees approved home screen with onboarding checklist
7. Farmer registers plot → cycle → completes checklist
8. Admin sees member in approved list with correct data

**Each step:** action | expected result | pass/fail checkbox

---

### Issue Z1-3 · RLS verification: member sees only own data

**Labels:** `security`
**Difficulty:** Medium

**Files to check and fix if needed:**
- `app/api/member/my-report/route.ts` — must filter by `member_id`
- `app/api/member/plots/route.ts` — must filter by `member_id`
- `app/api/member/harvest-bookings/route.ts` — must filter by `member_id`
- `app/api/member/harvest-booking/dryer-status/route.ts` — public data ok

**Pattern to verify (every member API):**
```typescript
// MUST have this — never return all rows
.eq('member_id', resolvedMemberId)
```

**Done when:** verified all member APIs scope to authenticated user only

---

### Issue Z1-4 · Admin manual (1 page)

**Labels:** `docs`
**Output file:** `docs/admin-manual.md`

**Sections:**
1. วิธี approve / reject สมาชิก
2. วิธี import CSV สมาชิก + review errors
3. วิธีตั้งราคารับซื้อ + ส่วนลดตามความชื้น
4. วิธีดู harvest queue + ตั้ง quota รายวัน
5. วิธีดูรายงาน
6. วิธีสร้าง pickup slot จาก template

---

## 🟡 MILESTONE 3 — Harvest Booking (Zone 2)

---

### Issue Z2-1 · Staff UI: record actual weight and moisture at intake

**Labels:** `feature` `staff` `pilot-blocker`
**Difficulty:** Medium

**New file:** `src/features/staff-intake/intake-form.tsx` (≤200 lines)
**New page:** `app/harvest/intake/page.tsx` (≤60 lines)
**New API:** `app/api/admin/harvest-bookings/complete/route.ts` (≤80 lines)

**Form fields:**
- Booking ID or member phone (lookup)
- Gross weight kg (number, required)
- Actual moisture % (number, required)
- Quality grade (select: A / B / C / reject)
- Scale ticket number (text)
- Notes (optional)

**API flow:**
1. Find booking by ID or member+date+location
2. Update `harvest_bookings` set:
   - `actual_received_kg = gross_weight`
   - `actual_moisture_pct = moisture`
   - `status = 'completed'`
   - `actual_completed_at = now()`
3. Return updated booking

**Acceptance criteria:**
- Staff can search booking by member phone
- Staff can submit actual weight → booking status changes to `completed`
- `tsc --noEmit` passes · `next build` passes
- Component ≤200 lines · page ≤60 lines · API ≤80 lines

---

### Issue Z2-2 · Admin: complete harvest booking with actual data

**Labels:** `feature` `admin`
**Difficulty:** Medium

**File to modify:** `src/features/admin-harvest/harvest-complete-form.tsx`

**Add fields to existing complete form:**
- actual_received_kg
- actual_moisture_pct
- quality_grade (A/B/C/reject)
- scale_ticket_no

**Connect to:** `PATCH /api/admin/harvest-bookings/[id]` — add these fields to the update payload

**Done when:** admin can mark booking complete with actual measurements visible in queue list

---

### Issue Z2-3 · Expected vs Actual report

**Labels:** `feature` `report`
**Difficulty:** Medium

**New file:** `src/features/admin-reports/expected-vs-actual-report.tsx` (≤200 lines)
**New API:** `app/api/admin/reports/expected-vs-actual/route.ts` (≤80 lines)
**Add tab to:** `app/admin/reports/page.tsx`

**API query:** `harvest_bookings` where `status = 'completed'`, select:
- `estimated_tonnage` vs `actual_received_kg`
- `estimated_moisture` vs `actual_moisture_pct`
- `member_id` → member name
- `scheduled_date`
- `pickup_location_id` → location name

**Report shows:**
- Table: member | วันที่ | น้ำหนักคาด | น้ำหนักจริง | ต่าง | ความชื้นคาด | ความชื้นจริง
- Summary: % accuracy น้ำหนัก, % accuracy ความชื้น
- Filter: date range, location

**Done when:** tab `📊 คาด vs จริง` shows in `/admin/reports` with real data

---

### Issue Z2-4 · UAT test script: harvest booking flow

**Labels:** `testing` `docs`
**Output file:** `docs/uat-booking-flow.md`

**Script covers:**
1. Farmer books harvest date from `/harvest/book`
2. Farmer sees dryer queue 7 days
3. Admin sees booking in queue
4. Admin sees peak-day alert if quota exceeded
5. Staff records actual weight
6. Farmer sees completed booking
7. Farmer edits booking (change date)
8. Farmer cancels booking

---

## 🟣 MILESTONE 4 — Intake Data Layer (Zone 3)

> This is the most critical missing piece. Read `docs/intake-data-layer-spec.md` fully before starting.

---

### Issue Z3-1 · Migration: harvest_bookings economics fields + factory_api_keys + intake_logs

**Labels:** `database` `pilot-blocker`
**Difficulty:** Easy

**New file:** `supabase/migrations/202605230001_harvest_intake_economics.sql`

**Must add to `harvest_bookings`:**
```sql
intake_source       text not null default 'manual'  -- 'manual'|'factory_api'|'csv_import'
intake_source_ref   text          -- transaction ref from factory system
intake_by           uuid references members(id)
intake_location_id  uuid references pickup_locations(id)
gross_weight_kg     numeric(12,2)
deduct_pct          numeric(5,2)
net_weight_kg       numeric(12,2)
scale_ticket_no     text          -- idempotency key per location
price_per_kg        numeric(8,4)
bonus_per_kg        numeric(8,4) default 0
gross_amount        numeric(14,2)
deduct_amount       numeric(14,2) default 0
net_amount          numeric(14,2)
payment_method      text  -- 'transfer'|'cash'|'credit'|'debit_account'
payment_ref         text
quality_grade       text  -- 'A'|'B'|'C'|'reject'
rejection_reason    text
```

**New tables:**
```sql
public.factory_api_keys (id, name, key_hash, location_id, is_active, last_used_at, created_at)
public.intake_logs (id, booking_id, source, raw_payload jsonb, processed_at, processed_by, status, error_message)
```

**Done when:** `supabase db push` succeeds, all columns visible in Supabase dashboard

---

### Issue Z3-2 · Shared calculation engine: calculateIntake()

**Labels:** `feature` `core`
**Difficulty:** Medium

**New file:** `src/lib/intake/calculate-intake.ts` (≤100 lines)

**Function signature:**
```typescript
export type IntakeInput = {
  gross_weight_kg : number
  moisture_pct    : number
  member_id       : string
  location_id     : string
  weigh_at        : Date
}

export type IntakeResult = {
  net_weight_kg    : number
  deduct_pct       : number
  deduct_kg        : number
  base_price       : number
  price_adjust     : number
  bonus_per_kg     : number
  final_price      : number
  gross_amount     : number
  bonus_amount     : number
  net_amount       : number
  applied_promos   : { id: string; title: string; bonus_per_kg: number }[]
}

export async function calculateIntake(
  input: IntakeInput,
  supabase: SupabaseClient
): Promise<IntakeResult>
```

**Logic (in order):**
1. Query `moisture_deductions` → find nearest `moisture_pct` row → get `weight_deduct_pct`, `price_adjust_per_kg`
2. `net_weight_kg = gross_weight_kg * (1 - weight_deduct_pct/100)`
3. Query `market_prices` → latest active price for location/crop
4. Query `campaign_announcements` → active promos (`promo_type` not null, date in range)
5. Apply `isPromoApplicable()` from `src/features/harvest-calculator/moisture-calculator.ts`
6. Sum all applicable bonuses
7. `final_price = base_price + price_adjust + total_bonus`
8. `net_amount = net_weight_kg * final_price`

**Must write unit tests** in `/home/claude/test_calculate_intake.ts` before implementing

**Done when:** function returns correct values for known inputs (verify manually)

---

### Issue Z3-3 · Helper libraries for intake

**Labels:** `feature`
**Difficulty:** Medium

**New files (each ≤60 lines):**

`src/lib/intake/find-booking.ts`
```typescript
// Find existing booking for member+date+location, or return null
export async function findBookingForIntake(
  memberId: string, locationId: string, weighAt: Date, supabase: SupabaseClient
): Promise<HarvestBooking | null>
```

`src/lib/intake/verify-factory-key.ts`
```typescript
// Verify Bearer token against factory_api_keys table (bcrypt compare)
// Returns { location_id } or throws 401
export async function verifyFactoryKey(
  authHeader: string | null, supabase: SupabaseClient
): Promise<{ location_id: string }>
```

`src/lib/intake/send-intake-receipt.ts`
```typescript
// Send LINE push with intake result to farmer
// Fail silently — never block intake on LINE failure
export async function sendIntakeReceipt(
  lineUid: string, result: IntakeResult, bookingId: string
): Promise<void>
```

---

### Issue Z3-4 · Factory API endpoint

**Labels:** `feature` `api`
**Difficulty:** Medium

**New file:** `app/api/intake/factory/route.ts` (≤80 lines)

**Auth:** `Authorization: Bearer {factory_api_key}` — use `verifyFactoryKey()`

**POST body:**
```typescript
{
  scale_ticket_no  : string   // idempotency key — reject duplicate
  member_id        : string   // uuid or phone
  weigh_at         : string   // ISO datetime
  gross_weight_kg  : number
  moisture_pct     : number
  quality_grade?   : 'A'|'B'|'C'|'reject'
}
```

**Flow:**
1. `verifyFactoryKey()` → get location_id
2. Check `intake_logs` for duplicate `scale_ticket_no` → if exists return existing result (idempotent)
3. Resolve member from uuid or phone
4. `findBookingForIntake()` → if null create walk-in booking
5. If `quality_grade === 'reject'` → update booking status = 'rejected' → return early
6. `calculateIntake()`
7. Update `harvest_bookings` with all actual fields
8. Insert `intake_logs` row
9. `sendIntakeReceipt()` (async, don't await)
10. Return receipt

**Done when:** `POST /api/intake/factory` with valid key returns `{ ok: true, net_amount, net_weight_kg }`

---

### Issue Z3-5 · Manual intake entry: API + Staff UI

**Labels:** `feature` `staff`
**Difficulty:** Medium

**New files:**
- `app/api/intake/manual/route.ts` (≤80 lines)
- `src/features/staff-intake/intake-form.tsx` (≤200 lines) — replaces Z2-1

**API:** Same as factory but uses staff session auth instead of API key
- Extra field: `booking_id?` (if known)
- Extra field: `member_phone?` (for walk-in lookup)
- Extra field: `intake_note?`

**UI form fields:**
- Member phone / booking ID search
- Date + location picker
- Gross weight (kg)
- Moisture %
- Quality grade dropdown
- Scale ticket number
- Notes
- **Preview section:** shows calculated net_weight + net_amount before submit
- Submit button → shows success receipt inline

**Done when:** staff submits form → booking updated → farmer gets LINE → admin sees in reports

---

### Issue Z3-6 · CSV import: batch intake from remote locations

**Labels:** `feature` `admin`
**Difficulty:** Hard

**New files:**
- `app/api/intake/csv-import/route.ts` (≤80 lines)
- `src/features/staff-intake/intake-csv-preview.tsx` (≤200 lines)
- Add tab to `app/admin/harvest/page.tsx`

**CSV expected format:**
```
scale_ticket_no,member_phone,gross_weight_kg,moisture_pct,weigh_at,location_name,quality_grade
TK-001,0812345678,5200,28.5,2026-05-23 10:30,จุดรับที่ 2,B
```

**Two-step flow:**
1. `POST /api/intake/csv-import` with `action=preview` → returns `{ valid: Row[], errors: ErrorRow[] }`
2. Admin reviews preview table → clicks confirm → `POST /api/intake/csv-import` with `action=commit`
3. Commit: process all valid rows in single DB transaction, fail entire batch if any row throws

**Preview UI shows:**
- Green rows: valid
- Red rows: error with reason (member not found, duplicate ticket, invalid moisture)
- Summary: X valid, Y errors
- Confirm button (only if valid rows > 0)

**Done when:** admin uploads CSV → previews → confirms → all bookings updated → LINE batch sent

---

### Issue Z3-7 · Intake receipt page

**Labels:** `feature`
**Difficulty:** Easy

**New files:**
- `app/api/intake/receipt/[id]/route.ts` (≤60 lines)
- `app/intake/receipt/[id]/page.tsx` (≤80 lines)

**Access:** farmer, staff, admin (check booking.member_id matches session OR session is staff/admin)

**Shows:**
- Member name + เลขสมาชิก
- วันที่ + จุดรับ + เลขใบชั่ง
- น้ำหนักรวม → หัก % → น้ำหนักสุทธิ
- ราคาฐาน → +ตามความชื้น → +โบนัส → ราคาจริง
- รายชื่อโปรโมชั่นที่ได้รับ
- **ยอดเงินสุทธิ** (large, bold, green)
- Print button (use `window.print()`)

---

### Issue Z3-8 · Staff real-time queue board for intake day

**Labels:** `feature` `staff`
**Difficulty:** Medium

**New file:** `src/features/staff-intake/intake-queue-board.tsx` (≤200 lines)
**Add to:** `app/harvest/intake/page.tsx`

**Shows for today at current location:**
- List of confirmed bookings sorted by time
- Each row: farmer name · estimated tonnage · moisture · drying_preference · status badge
- Dryer quota bar: booked/capacity_kg_dryer (color: green→yellow→red)
- Dry quota bar: booked/capacity_kg_dry
- ⚠️ badge when quota > 80%
- "กรอกผล" button → opens intake-form pre-filled with booking data

**Refresh:** poll every 60 seconds OR use Supabase realtime subscription on `harvest_bookings`

---

### Issue Z3-9 · End-of-day reconciliation

**Labels:** `feature` `admin`
**Difficulty:** Hard

**New page:** `app/admin/harvest/reconcile/page.tsx` (≤150 lines)
**New API:** `app/api/admin/harvest/reconcile/route.ts` (≤80 lines)

**Flow:**
1. Admin selects date + location → sees all bookings for that day
2. Table: planned | completed | no-show
3. Admin clicks "ปิดรับวันนี้" → API:
   - Flag all `status='planned'` for that date+location as `status='no_show'`
   - Lock: set `locked_at = now()` on all completed bookings (prevent edit)
   - Generate daily summary
4. Export button → CSV of the day's intake

**Done when:** admin can close day, no-shows are flagged, summary exportable

---

### Issue Z3-10 · Admin: manage factory API keys

**Labels:** `feature` `admin`
**Difficulty:** Easy

**New page:** `app/admin/harvest/api-keys/page.tsx` (≤100 lines)
**New API:** `app/api/admin/factory-api-keys/route.ts` (≤80 lines)

**Features:**
- List all API keys with: name, location, is_active, last_used_at
- Create new key: name + location → system generates key → show **once** (never again)
- Deactivate key (soft delete: is_active = false)

**Security:** Store only `key_hash = bcrypt(key)` in DB. Return plain key once at creation only.

---

## 🟢 MILESTONE 5 — Staff System (Zone 4)

---

### Issue Z4-3 · Leader home: view group members + booking status

**Labels:** `feature` `staff`
**Difficulty:** Easy

**File to modify:** `app/page.tsx` — `LeaderHome` or `StaffHome` function (currently returns same as staff)

**Add to leader view:**
- List of members in their group (`member_group_members` where `group_id = leader's group`)
- Each member row: name · status (approved/pending) · last booking date · no-burn status
- Count: total members · approved · pending

**Data from:**
```typescript
// Get leader's group
supabase.from('member_group_members').select('group_id').eq('member_id', leaderId)
// Get group members
supabase.from('member_group_members').select('member:members(...)').eq('group_id', groupId)
```

---

### Issue Z4-4 · Inspector: complete task list with result entry

**Labels:** `feature` `inspector`
**Difficulty:** Medium

**Context:** Inspector task list UI exists but has incomplete result form.

**File to fix:** `src/features/inspection-tasks/` (check existing files)

**Must work end-to-end:**
1. Inspector opens app → sees assigned inspections list
2. Taps inspection → sees plot details + assignment info
3. Fills result: observation text · GPS (auto-fill from device) · photos (upload) · verdict (pass/fail/needs-review)
4. Submits → `PATCH /api/field/inspections/[id]` → status = 'completed'

---

### Issue Z4-5 · Admin: assign inspection to inspector

**Labels:** `feature` `admin`
**Difficulty:** Medium

**New page:** `app/admin/inspections/assign/page.tsx` (≤120 lines)
**New API:** `app/api/admin/inspections/assign/route.ts` (≤60 lines)

**Flow:**
1. Admin sees list of pending inspections (no assignee)
2. Selects inspector from dropdown (members with role='inspector')
3. Clicks assign → API updates `inspections.assigned_to = inspector_id`
4. Send LINE push to inspector: "คุณมีงานตรวจแปลงใหม่ แตะเพื่อดูรายละเอียด"

---

### Issue Z4-6 · LINE push: notify inspector on new assignment

**Labels:** `feature` `line`
**Difficulty:** Easy

**Modify:** `app/api/admin/inspections/assign/route.ts` (from Z4-5)

**After updating assigned_to:**
```typescript
await pushLineMessage(inspector.line_uid, {
  type: 'text',
  text: `📋 คุณมีงานตรวจแปลงใหม่\nแปลง: ${plot.name}\nเกษตรกร: ${farmer.full_name}\nแตะเพื่อดูรายละเอียด`
}).catch(console.error)
```

---

## 🟠 MILESTONE 6 — No-Burn System (Zone 5)

---

### Issue Z5-1 · LINE push on no-burn approve/reject

**Labels:** `feature` `line`
**Difficulty:** Easy

**File to modify:** `app/api/admin/no-burn/[id]/route.ts` (or wherever approve happens)

**On approve:**
```
🌿 ยินดีด้วย! คำขอโครงการไม่เผาของคุณได้รับการอนุมัติแล้ว
โบนัส +{bonus} บาท/กก. จะถูกคำนวณเมื่อขายผลผลิต
```

**On reject:**
```
❌ ขออภัย คำขอโครงการไม่เผาของคุณยังไม่ผ่านการอนุมัติ
เหตุผล: {rejection_reason}
กรุณาติดต่อเจ้าหน้าที่เพื่อข้อมูลเพิ่มเติม
```

---

### Issue Z5-3 · Link no-burn approval to field inspection trigger

**Labels:** `feature`
**Difficulty:** Hard

**When admin reviews no-burn request and clicks "ส่งตรวจแปลง":**
1. Create new inspection record linked to the no-burn request
2. Set `inspections.related_no_burn_id = no_burn_request_id` (add column if needed)
3. Admin can then assign to inspector via Z4-5
4. When inspection completes as 'pass' → auto-approve no-burn request

**New migration if needed:** add `related_no_burn_id uuid references no_burn_requests(id)` to `inspections`

---

## 🔵 MILESTONE 7 — Communications (Zone 7)

---

### Issue Z7-2 · Broadcast message by group or area

**Labels:** `feature` `admin`
**Difficulty:** Medium

**File to modify:** `app/admin/campaigns/page.tsx` or wherever campaigns are managed

**Add to campaign creation form:**
- Target: `all` | `by_group` | `by_district`
- If `by_group`: multi-select from `member_groups`
- If `by_district`: text input for district name (matches `members.district`)

**New API:** `POST /api/admin/campaigns/broadcast`
```
1. Get target member_ids based on filter
2. For each member: get line_uid from members table
3. Batch push (max 1 req/sec to avoid LINE rate limit)
4. Log success/fail per member in notification table
```

---

### Issue Z7-3 · LINE push message templates

**Labels:** `feature`
**Difficulty:** Easy

**New file:** `src/lib/line/message-templates.ts`

**Templates needed:**
```typescript
memberApproved(memberName: string): LineMessage
memberRejected(memberName: string, reason?: string): LineMessage
seedReservationConfirmed(product: string, qty: number, pickupDate: string): LineMessage
seedReservationCancelled(product: string): LineMessage
intakeReceipt(netKg: number, netAmount: number, bonusAmount: number): LineMessage
quotaAlmostFull(location: string, remaining: number): LineMessage
noBurnApproved(bonus: number): LineMessage
noBurnRejected(reason: string): LineMessage
inspectionAssigned(plotName: string, farmerName: string): LineMessage
```

---

## 📊 MILESTONE 8 — Reports (Zone 8)

---

### Issue Z8-1 · Member summary report

**Labels:** `feature` `report`
**Difficulty:** Easy

**New file:** `src/features/admin-reports/member-summary-report.tsx` (≤150 lines)
**New API:** `app/api/admin/reports/member-summary/route.ts` (≤60 lines)
**Add tab to:** `app/admin/reports/page.tsx`

**Shows:**
- KPI: total · approved · pending · rejected · suspended
- Table: members by registration date (last 30 days)
- Chart: new members per week (use recharts BarChart)
- By district: which areas have most members

---

### Issue Z8-2 · Booking summary report

**Labels:** `feature` `report`
**Difficulty:** Easy

**New file:** `src/features/admin-reports/booking-report.tsx` (≤150 lines)
**New API:** `app/api/admin/reports/bookings/route.ts` (≤60 lines)
**Add tab to:** `app/admin/reports/page.tsx`

**Shows:**
- KPI: total bookings · completed · no-show · cancelled
- Table: daily bookings with tonnage (expected vs actual if available)
- Filter: date range, location

---

### Issue Z8-4 · By-vehicle quality report

**Labels:** `feature` `report`
**Difficulty:** Medium

**New file:** `src/features/admin-reports/by-vehicle-report.tsx` (≤180 lines)
**New API:** `app/api/admin/reports/by-vehicle/route.ts` (≤70 lines)
**Add tab to:** `app/admin/reports/page.tsx`

**Data from:** `harvest_bookings` joined with `member_vehicles` via member_id

**Shows per vehicle/driver:**
- จำนวนเที่ยว
- น้ำหนักรวม
- ความชื้นเฉลี่ย
- quality grade distribution (A/B/C/reject count)
- Sorted by tonnage desc

---

### Issue Z8-5 · Export CSV for reports

**Labels:** `feature` `report`
**Difficulty:** Medium

**Add to each report component:** `<ExportCSV data={rows} filename="report-name.csv" />`

**New shared component:** `src/shared/components/export-csv.tsx` (≤40 lines)

```typescript
// Simple: convert array of objects to CSV and trigger download
function ExportCSV({ data, filename }: { data: object[], filename: string }) {
  function download() {
    const keys = Object.keys(data[0])
    const csv  = [keys.join(','), ...data.map(r => keys.map(k => r[k]).join(','))].join('\n')
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' }) // BOM for Thai
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a'); a.href = url; a.download = filename; a.click()
  }
  return <button className="admin-btn admin-btn--secondary" onClick={download}>📥 Export CSV</button>
}
```

---

## ✅ MILESTONE 9 — UAT & Go-Live (Zone 9)

---

### Issue Z9-1 · UAT script: farmer full flow

**Labels:** `testing` `docs`
**Output:** `docs/uat-farmer-flow.md`

**Full scenario:** สมัคร → onboarding → จองขาย → ดู calculator → แจ้งวันเกี่ยว → รับใบเสร็จ

---

### Issue Z9-2 · UAT script: staff intake flow

**Labels:** `testing` `docs`
**Output:** `docs/uat-staff-flow.md`

**Full scenario:** เปิดแอป → เห็นคิวรับ → กรอก actual weight → ดูยอดรายวัน → ปิดรับ

---

### Issue Z9-3 · UAT script: admin management flow

**Labels:** `testing` `docs`
**Output:** `docs/uat-admin-flow.md`

**Full scenario:** approve member → ตั้งราคา → ดู queue → complete booking → ดูรายงาน

---

### Issue Z9-6 · Complete launch checklist

**Labels:** `docs` `pilot-blocker`

**File:** `docs/launch-checklist.md` (exists, needs all boxes ticked)

**Every item must have:** ✅ done | ❌ not done | ⏳ in progress

---

## Summary

| Milestone | Issues | Pilot Blocking |
|---|---|---|
| M1 Zone 0 Fix | Z0-2, Z0-3, Z0-4, Z0-5 | ✅ |
| M2 Zone 1 Member | Z1-1, Z1-2, Z1-3, Z1-4 | ✅ |
| M3 Zone 2 Booking | Z2-1, Z2-2, Z2-3, Z2-4 | ✅ |
| M4 Zone 3 Intake | Z3-1 through Z3-10 | ✅ |
| M5 Zone 4 Staff | Z4-3, Z4-4, Z4-5, Z4-6 | partial |
| M6 Zone 5 No-burn | Z5-1, Z5-3 | — |
| M7 Zone 7 Comms | Z7-2, Z7-3 | — |
| M8 Zone 8 Reports | Z8-1, Z8-2, Z8-4, Z8-5 | — |
| M9 Zone 9 UAT | Z9-1, Z9-2, Z9-3, Z9-6 | ✅ |
| **Total** | **35 issues** | |

> **Rule for Codex on every issue:**
> 1. Read relevant existing files before writing
> 2. Write to `/home/claude/test_output` and verify first
> 3. Keep line limits: page ≤150 · component ≤200 · API route ≤80
> 4. Run `npx tsc --noEmit` → must be 0 errors
> 5. Run `npx next build` → must pass
> 6. Commit with message format: `feat(ZX-Y): description`
