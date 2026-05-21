# Issue #220 — Harvest Timing: Moisture vs Baht Calculator (v1)

**Type:** Feature Spec / Product Design
**Status:** Draft — Ready for Review
**Author:** KaonA-Agri Product
**Relates to:** `app/admin/harvest/timing/`, `src/features/admin-harvest/harvest-moisture-preview.tsx`

---

## 1. Proposed Issue Title

> **[Feature] Moisture vs Baht Decision Calculator — farmer & admin advisory tool (v1)**

---

## 2. PR Scope

| รายการ | รวมใน PR นี้ |
|---|:---:|
| Calculator UI (farmer — LINE Mini App) | ✅ |
| Calculator UI (admin — harvest timing page) | ✅ |
| Formula engine (pure function, no API) | ✅ |
| Thai copy + disclaimer | ✅ |
| Verdict indicator (คุ้ม / ใกล้เคียง / ไม่คุ้ม) | ✅ |
| Database migration | ❌ |
| Auth / RLS changes | ❌ |
| AI recommendation | ❌ |
| Weather / dryer queue integration | ❌ |
| Save/persist calculation result | ❌ |
| Automatic decision or optimization | ❌ |

**ไฟล์ที่ต้องสร้าง:**
- `src/features/harvest-calculator/moisture-calculator.ts` — formula engine (pure, testable)
- `src/features/harvest-calculator/moisture-calculator-form.tsx` — shared UI form (≤200 บรรทัด)
- `app/harvest/calculator/page.tsx` — farmer entry point (LINE Mini App)
- เพิ่ม tab ใน `app/admin/harvest/timing/page.tsx` — admin entry point

---

## 3. Business Context

เกษตรกรต้องตัดสินใจว่า **ขายตอนนี้** หรือ **รอให้ข้าวโพดแห้งลงก่อน**:

```
ความชื้นสูง  → น้ำหนักมาก  → ราคาต่อกก. ถูก
ความชื้นต่ำ  → น้ำหนักน้อย → ราคาต่อกก. แพง
```

ปัจจุบันเกษตรกรประเมินเองในหัว ซึ่งมักเกิดความผิดพลาดและขาดข้อมูลสนับสนุน Calculator นี้จะช่วยให้เห็นตัวเลขเปรียบเทียบชัดเจนก่อนตัดสินใจ โดย **ไม่ตัดสินใจแทน**

---

## 4. Formula Section

### 4.1 Wet Basis Moisture Conversion (standard grain industry formula)

น้ำหนักข้าวโพดหลังลดความชื้นจาก M₁ → M₂:

```
W₂ = W₁ × (100 − M₁) / (100 − M₂)
```

| ตัวแปร | ความหมาย | หน่วย |
|---|---|---|
| W₁ | น้ำหนักปัจจุบัน (ความชื้นสูง) | กก. หรือ ตัน |
| M₁ | ความชื้นปัจจุบัน | % |
| W₂ | น้ำหนักหลังลดความชื้น | กก. หรือ ตัน |
| M₂ | ความชื้นเป้าหมาย | % |

**ข้อจำกัด:** M₁ ต้องมากกว่า M₂ เสมอ และทั้งคู่ต้องอยู่ระหว่าง 1–50%

### 4.2 Gross Value

```
มูลค่าปัจจุบัน  = W₁ × P₁
มูลค่าหลังลด    = W₂ × P₂ − C_dry
```

| ตัวแปร | ความหมาย | หน่วย |
|---|---|---|
| P₁ | ราคารับซื้อที่ความชื้น M₁ | บาท/กก. |
| P₂ | ราคารับซื้อที่ความชื้น M₂ | บาท/กก. |
| C_dry | ค่าอบ/หักลดโดยประมาณ (ถ้ามี) | บาท |

### 4.3 ผลต่าง (Difference)

```
Δ = มูลค่าหลังลด − มูลค่าปัจจุบัน
```

### 4.4 Verdict Threshold

| เงื่อนไข | Verdict | สี |
|---|---|---|
| Δ > +500 บาท/ตัน | **คุ้มค่า** | เขียว |
| −500 ≤ Δ ≤ +500 บาท/ตัน | **ใกล้เคียงกัน** | เหลือง |
| Δ < −500 บาท/ตัน | **ไม่คุ้มค่า** | แดง |

> threshold 500 บาท/ตัน เป็นค่า default — admin ปรับได้ในอนาคต (Phase 2)

---

## 5. v1 Inputs

| Input | Label (TH) | ประเภท | Required | Default | Validation |
|---|---|---|---|---|---|
| `moisture_current` | ความชื้นปัจจุบัน (%) | number | ✅ | — | 1–50 |
| `moisture_target` | ความชื้นเป้าหมาย (%) | number | ✅ | 14 | 1–50, < moisture_current |
| `weight_kg` | น้ำหนักโดยประมาณ (กก.) | number | ✅ | — | > 0 |
| `price_current` | ราคา ณ ความชื้นปัจจุบัน (บาท/กก.) | number | ✅ | — | > 0 |
| `price_target` | ราคา ณ ความชื้นเป้าหมาย (บาท/กก.) | number | ✅ | — | > 0 |
| `drying_cost` | ค่าอบ/หักลด (บาท) — ไม่บังคับ | number | ❌ | 0 | ≥ 0 |

> **หมายเหตุ:** ราคา P₁ และ P₂ กรอกเอง ไม่ดึงจาก market_prices อัตโนมัติ (v1) เพื่อให้ง่ายที่สุด

---

## 6. v1 Outputs

| Output | Label (TH) | สูตร |
|---|---|---|
| น้ำหนักหลังลดความชื้น | น้ำหนักหลังอบ (กก.) | W₂ = W₁ × (100−M₁)/(100−M₂) |
| น้ำหนักที่ลดไป | น้ำหนักที่หายไป (กก.) | W₁ − W₂ |
| มูลค่าปัจจุบัน | รายได้ถ้าขายตอนนี้ | W₁ × P₁ |
| มูลค่าหลังลด | รายได้ถ้ารอขาย | W₂ × P₂ − C_dry |
| ผลต่าง | ได้เพิ่ม / เสียเพิ่ม | Δ |
| Verdict | คุ้มค่า / ใกล้เคียงกัน / ไม่คุ้มค่า | threshold rule |

---

## 7. UI Wireframe (Text)

### 7.1 Farmer View — `/harvest/calculator`

```
┌────────────────────────────────────┐
│  🌽 คำนวณความคุ้มค่า — ขายเลย vs รอ  │
│  เครื่องมือช่วยตัดสินใจเบื้องต้น       │
└────────────────────────────────────┘

── ข้อมูลของคุณ ──────────────────────

ความชื้นปัจจุบัน (%)
[ 28          ]

ความชื้นเป้าหมาย (%)
[ 14          ]  ← ค่า default จากโรงงาน

น้ำหนักโดยประมาณ (กก.)
[ 5,000       ]

ราคาตอนนี้ (บาท/กก.)
[ 4.20        ]

ราคาหลังลดความชื้น (บาท/กก.)
[ 5.50        ]

ค่าอบ/หักลด (บาท) — ไม่บังคับ
[ 0           ]

         [ คำนวณ ]

── ผลการคำนวณ ────────────────────────

  ขายตอนนี้          รอขาย
  5,000 กก.          4,186 กก.
  ฿21,000            ฿23,021

         ┌──────────────┐
         │  ✅ คุ้มค่า   │  ← สีเขียว
         │  +฿2,021     │
         └──────────────┘

  น้ำหนักที่ลดไป: 814 กก.

── ⚠️ ข้อควรระวัง ─────────────────────
  ตัวเลขนี้เป็นการประมาณการเบื้องต้น
  ราคาและเงื่อนไขจริงขึ้นกับโรงงาน
  ณ วันรับซื้อจริง
──────────────────────────────────────
```

### 7.2 Admin View — tab ใน `/admin/harvest/timing`

เหมือน Farmer View แต่:
- แสดงในรูปแบบ panel ขนาดกะทัดรัด (ไม่ใช่ full-page)
- label อังกฤษ + ไทยคู่กัน เช่น "Current Moisture (%)"
- ไม่มี mobile shell wrapper

---

## 8. Thai Copy — Farmer-Friendly

| Element | Copy |
|---|---|
| หัวข้อหน้า | "คำนวณความคุ้มค่า — ขายเลย vs รอให้แห้ง" |
| คำอธิบาย | "กรอกข้อมูลเพื่อดูว่าการรอให้ข้าวโพดแห้งลงจะได้เงินมากขึ้นไหม" |
| ปุ่ม | "คำนวณ" |
| ผลลัพธ์ขายเลย | "ถ้าขายตอนนี้" |
| ผลลัพธ์รอขาย | "ถ้ารอให้ความชื้นลดเหลือ X%" |
| Verdict: คุ้มค่า | "✅ คุ้มค่า — การรอน่าจะได้เงินมากขึ้น +฿X" |
| Verdict: ใกล้เคียงกัน | "🟡 ใกล้เคียงกัน — ได้เพิ่มขึ้นหรือน้อยลงไม่มาก" |
| Verdict: ไม่คุ้มค่า | "🔴 ไม่คุ้มค่า — น้ำหนักที่เสียไปมากกว่าราคาที่ได้เพิ่ม" |
| Disclaimer | "⚠️ ตัวเลขนี้เป็นการประมาณการเบื้องต้นเท่านั้น ราคาและเงื่อนไขจริงขึ้นอยู่กับโรงงาน ณ วันรับซื้อจริง ไม่ใช่ราคายืนยัน" |
| Placeholder ความชื้น | "เช่น 28" |
| Placeholder ราคา | "เช่น 4.50" |
| label ค่าอบ | "ค่าอบหรือหักลดโดยประมาณ (ถ้าไม่มีใส่ 0)" |

---

## 9. Admin vs Member Visibility

| Feature | Farmer (LINE Mini App) | Admin (harvest/timing) |
|---|:---:|:---:|
| เห็น Calculator | ✅ | ✅ |
| กรอกข้อมูลและคำนวณ | ✅ | ✅ |
| เห็น Verdict | ✅ | ✅ |
| บันทึกผลลัพธ์ | ❌ v1 | ❌ v1 |
| ดูผลของ farmer คนอื่น | ❌ | ❌ v1 |
| ปรับ threshold | ❌ | ❌ v1 |

> ทั้ง farmer และ admin เห็น calculator เดียวกัน เพียงแต่ UI wrapper ต่างกัน (MobileAppShell vs AdminWebShell)

---

## 10. Risk Disclaimers

ต้องแสดงทุกครั้งหลังแสดงผลการคำนวณ:

1. **ประมาณการเท่านั้น** — ตัวเลขนี้คำนวณจากข้อมูลที่กรอก ไม่ใช่ราคายืนยันจากโรงงาน
2. **ราคาจริงขึ้นกับโรงงาน** — โรงงานอาจมีเงื่อนไขการรับซื้อ การหักลด หรือ grade ที่แตกต่าง
3. **ความชื้นจริงอาจต่างจากที่ประมาณ** — วัดความชื้นจริงก่อนนำส่งโรงงานทุกครั้ง
4. **ไม่รับรองผลการตัดสินใจ** — เครื่องมือนี้ช่วยประกอบการตัดสินใจเท่านั้น

---

## 11. Data Model

**ไม่มี migration ใน PR นี้** — Calculator ทำงานเป็น pure client-side computation ทั้งหมด

ถ้าต้องการบันทึกผล (Phase 2) ให้เพิ่ม column ใน `harvest_bookings` หรือ `planting_cycles`:

```
-- Phase 2 only — ไม่รวมใน PR นี้
calculator_moisture_current   numeric
calculator_moisture_target    numeric
calculator_weight_kg          numeric
calculator_verdict            text   -- 'worth_it' | 'similar' | 'not_worth_it'
calculator_delta_baht         numeric
calculator_run_at             timestamptz
```

---

## 12. Acceptance Criteria

### Functional
- [ ] กรอก inputs ครบ 5 fields (drying_cost optional) → กด คำนวณ → เห็น output ทันที
- [ ] Formula W₂ = W₁ × (100−M₁)/(100−M₂) คำนวณถูกต้อง (verified ด้วย unit test)
- [ ] Verdict แสดงสีและข้อความถูกต้องตาม threshold
- [ ] moisture_target ≥ moisture_current → แสดง error "ความชื้นเป้าหมายต้องน้อยกว่าความชื้นปัจจุบัน"
- [ ] Input ค่าลบหรือ 0 → ไม่คำนวณ แสดง validation message
- [ ] Disclaimer แสดงทุกครั้งหลังผลคำนวณ

### Visibility
- [ ] Farmer เข้าได้จากเมนูหลักใน FarmerHome หรือ `/harvest/calculator`
- [ ] Admin เห็นใน tab ของ `/admin/harvest/timing`

### Quality
- [ ] ไม่มี API call — pure client-side
- [ ] ไฟล์ทุกไฟล์ผ่าน line limit (page ≤150, component ≤200, formula engine ≤100)
- [ ] `npx tsc --noEmit` ผ่าน 0 errors
- [ ] `npx next build` ผ่าน

---

## 13. Out of Scope (v1)

| รายการ | เหตุผล |
|---|---|
| ดึงราคาจาก market_prices อัตโนมัติ | ความซับซ้อนเกินจำเป็น — กรอกเองก่อน |
| Weather risk (ฝน/ลม) | Phase 2 |
| Dryer queue waiting time | Phase 2 |
| Harvester availability | Phase 2 |
| บันทึก/ประวัติการคำนวณ | Phase 2 — ต้องมี migration |
| ปรับ threshold โดย admin | Phase 2 |
| Actual sale result learning loop | Phase 3 |
| AI / optimization recommendation | ไม่อยู่ใน roadmap ปัจจุบัน |
| Multi-crop support | เริ่มด้วยข้าวโพดก่อน |

---

## 14. Future Extension Path

```
v1  (PR นี้)    : calculator แบบ stateless, ไม่บันทึก
v2  (Phase 2)   : บันทึกผลคำนวณใน planting_cycles
                  ดึงราคาจาก market_prices อัตโนมัติ
                  ปรับ threshold โดย admin
v3  (Phase 2+)  : เพิ่ม weather risk score (ฝน 3 วัน)
                  เพิ่ม dryer queue estimate
                  เพิ่ม harvester availability
v4  (Phase 3)   : actual sale result learning loop
                  เปรียบเทียบผลจริง vs ที่คำนวณ
                  แสดง accuracy ย้อนหลัง
```
