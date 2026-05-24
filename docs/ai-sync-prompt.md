# KaonA-Agri — AI Collaboration Prompt

> ใช้ prompt นี้สั่ง Codex หรือ GPT ให้อัปเดต 2 ไฟล์หลักพร้อมกัน
> ทุกครั้งที่งานเสร็จ หรือต้องการ sync สถานะ

---

## 2 ไฟล์หลักที่ต้อง sync เสมอ

| ไฟล์ | หน้าที่ | อัปเดตเมื่อ |
|---|---|---|
| `docs/codex-issues.md` | งานที่เหลือ + spec สำหรับ Codex | มี issue เสร็จ / issue ใหม่ |
| `app/admin/system-map/page.tsx` | แสดงสถานะระบบใน admin | % เปลี่ยน / todo เปลี่ยน |

---

## Prompt สำหรับ Codex

ใช้เมื่อ: สั่ง Codex ทำงาน และอยากให้ update สถานะหลังเสร็จ

```
Read docs/codex-issues.md carefully.

Your task: implement [ISSUE_ID] — [ISSUE_TITLE]

After completing the implementation:

1. Update docs/codex-issues.md
   - Move [ISSUE_ID] row to "✅ Done" status in the summary table
   - Remove the full issue spec section (### Issue [ISSUE_ID] ...)
   - Update the count in the summary (e.g. "Code issues: 2 ตัว" → "Code issues: 1 ตัว")

2. Update app/admin/system-map/page.tsx
   Find the system this issue belongs to in SYSTEMS array and:
   - Move the item from todo[] to done[] with "✅" prefix
   - Remove the issue ID from codex[] array
   - Adjust pct() function if the feature is now working
     (e.g., if intake is now active, increase base score by 5-10)

3. Commit both files together:
   git add docs/codex-issues.md app/admin/system-map/page.tsx
   git commit -m "docs: sync status after [ISSUE_ID] completion"

Rules:
- tsc --noEmit must pass before committing
- next build must pass before committing  
- Never change pct() to return a hardcoded high number
- pct() must still use real metrics from m (Metrics) and a (Activity)
```

---

## Prompt สำหรับ GPT / Claude (planning & review)

ใช้เมื่อ: ต้องการ review สถานะ หรือเพิ่ม issue ใหม่

```
You are helping maintain KaonA-Agri project status.

Project files to read:
- docs/codex-issues.md — remaining work items with specs
- app/admin/system-map/page.tsx — SYSTEMS array with current status

Context:
- Stack: Next.js 14, Supabase, TypeScript, LINE LIFF
- Repo: noikaona-sketch/KaonA-Agri
- Live admin: kaon-a-agri.vercel.app/admin/system-map

Task: [YOUR TASK HERE]

Examples:
- "Add new issue for [feature] to docs/codex-issues.md"
- "Update system map pct for [system] — [feature] is now done"
- "Review what's blocking Pilot and summarize"
- "Add Phase 2 issue for [new feature]"

After any change, ensure both files stay in sync:
- codex-issues.md summary table reflects current status
- system-map SYSTEMS array done[]/todo[]/codex[] arrays match
```

---

## วิธีใช้จริง

### กรณี 1: Codex ทำ issue เสร็จ
```
[ใช้ Codex prompt ด้านบน แทนที่ ISSUE_ID และ ISSUE_TITLE]
เช่น: implement Z1-1 — LINE push approve/reject
```

### กรณี 2: เพิ่ม feature ใหม่ที่ไม่ได้วางแผนไว้
```
[ใช้ GPT/Claude prompt]
Task: "Add new issue ZX-N for [feature description] 
      to docs/codex-issues.md with full spec,
      and add it to todo[] of [system_id] in system-map"
```

### กรณี 3: Pavee ทำงานเองเสร็จ (เช่น ตั้ง LINE token)
```
[ใช้ GPT/Claude prompt]
Task: "Mark Z0-3 (LINE token) as done.
      Remove from pavee[] in comms system in system-map.
      Update codex-issues.md status table."
```

### กรณี 4: ต้องการ sync ทั้งหมด (หลังทำงานไปเยอะ)
```
[ใช้ GPT/Claude prompt]
Task: "Read both files and reconcile them.
      Check that every item in codex[] and pavee[] arrays 
      in system-map also appears in codex-issues.md.
      Check that every ✅ Done item in codex-issues.md 
      is in done[] not todo[] in system-map.
      Report any inconsistencies and fix them."
```

---

## กฎ sync ที่ต้องรักษา

```
codex-issues.md          ↔     system-map SYSTEMS[]
─────────────────────────────────────────────────────
Issue pending (### Issue) ↔ appears in codex[] or pavee[]
Issue removed (done)      ↔ removed from codex[]/pavee[]
                              moved from todo[] to done[]
New issue added           ↔ added to todo[] + codex[]/pavee[]
pct() function            ↔ reflects reality (uses m + a params)
```

---

## สิ่งที่ห้ามทำ

- ❌ เพิ่ม hardcoded `pct:() => 100` โดยไม่ใช้ metrics จริง
- ❌ ลบ issue ออกจาก codex-issues.md โดยไม่ย้ายไป done[] ใน system-map
- ❌ commit โดยไม่ผ่าน `tsc --noEmit` + `next build`
- ❌ แก้ไขไฟล์อื่นนอกจาก 2 ไฟล์นี้ (เว้นแต่จำเป็น)

---

## Quick reference: System IDs

| id | ระบบ |
|---|---|
| `member` | ระบบสมาชิก |
| `plot` | ระบบแปลงและการปลูก |
| `harvest` | ระบบรับซื้อ |
| `intake` | Intake Data Layer |
| `staff` | ระบบเจ้าหน้าที่ |
| `noburn` | ระบบไม่เผา |
| `inspection` | ระบบตรวจแปลง |
| `seed` | ระบบเมล็ด/ร้านค้า |
| `calculator` | ระบบตัดสินใจเกี่ยว |
| `comms` | ระบบสื่อสาร |
| `report` | ระบบรายงาน |
| `stock` | ระบบสต็อก/คลัง |
| `truck` | ระบบรถร่วม |

---

*อัปเดต: พ.ค. 2569*
