# UI/UX Design System + Mobile Navigation (Issue #3)

## 1) Objective
Define a practical mobile-first UI/UX system for the KaonA Agri LINE Mini App MVP, including reusable visual tokens, component behavior, and a role-aware navigation model that is optimized for one-hand use on mobile.

## 2) Design principles
1. **Mobile-first always**: primary target is in-app mobile webview via LINE LIFF.
2. **Task-first flows**: prioritize completion of core workflows (register, submit evidence, track status).
3. **Consistency over novelty**: shared patterns for forms, status, and approvals.
4. **Clarity for mixed digital literacy**: plain language, high contrast, explicit status labels.
5. **Progressive disclosure**: show essential information first; expand for details.
6. **Low-friction actions**: key actions reachable within thumb zone and <=2 taps from home.

## 3) Visual design tokens

### 3.1 Color tokens
- `primary`: `#2E7D32` (agri green)
- `primary-pressed`: `#1B5E20`
- `accent`: `#F9A825` (attention/highlight)
- `bg`: `#F7F9F7`
- `surface`: `#FFFFFF`
- `text-primary`: `#1A1F1C`
- `text-secondary`: `#4E5A53`
- `border`: `#D8E0DB`
- `success`: `#2E7D32`
- `warning`: `#ED6C02`
- `danger`: `#D32F2F`
- `info`: `#0288D1`

### 3.2 Typography tokens
- Font stack: `LINE Seed Sans` fallback to `Noto Sans Thai, system-ui, sans-serif`.
- `heading-lg`: 24/32, weight 700.
- `heading-md`: 20/28, weight 700.
- `heading-sm`: 18/24, weight 600.
- `body-md`: 16/24, weight 400.
- `body-sm`: 14/20, weight 400.
- `caption`: 12/16, weight 400.

### 3.3 Spacing + radius tokens
- Spacing scale: `4, 8, 12, 16, 20, 24, 32`.
- Corner radius: `8` (input/button), `12` (card), `16` (bottom sheet).
- Shadow levels:
  - `shadow-1`: subtle card elevation.
  - `shadow-2`: elevated floating action and sticky bars.

## 4) Core component standards

### 4.1 App shell
- Sticky top app bar with page title and contextual action.
- Optional role badge in top area (e.g., `farmer`, `inspector`).
- Sticky bottom navigation for primary destinations.
- Safe-area padding support for iOS/Android webview insets.

### 4.2 Buttons
- Variants: `primary`, `secondary`, `ghost`, `danger`.
- Minimum touch target: 44x44 px.
- Loading state must lock repeated submissions.
- Disabled state requires contrast-compliant styling.

### 4.3 Form inputs
- Labels always visible above fields (no label-only placeholders).
- Helper text and validation text below field.
- Error style includes color + icon + short guidance.
- For camera/GPS fields, show acquisition status and retry action.

### 4.4 Cards and lists
- Use card layout for plot, booking, request, and inspection summaries.
- Every operational card includes:
  - primary title,
  - status chip,
  - last-updated date,
  - one clear primary action.

### 4.5 Status chips
- Canonical statuses:
  - `draft`
  - `submitted`
  - `under_review`
  - `approved`
  - `rejected`
  - `needs_update`
  - `scheduled`
  - `completed`
- Each status must map to a stable color token and plain-language tooltip/description.

## 5) Mobile navigation system

## 5.1 Bottom navigation (global)
Use a 4-tab baseline with role-conditional behavior:
1. **Home**
2. **Tasks**
3. **Records**
4. **Profile**

Rules:
- Max 4 visible tabs to avoid crowding.
- Current tab label and icon are both highlighted.
- Preserve tab history within session.
- Deep links can open child pages while keeping parent tab active.

## 5.2 Role-based default landing and task emphasis
- `farmer`: Home highlights registration status, plot summary, and quick submit actions.
- `leader`: Home highlights member verification/support queue.
- `inspector`: Tasks opens assigned inspections by default.
- `truck_owner`: Tasks shows assigned operation visibility items.
- `staff`/`admin`: Tasks opens approval queues and pending reviews.

## 5.3 Navigation map (MVP)
- **Home tab**
  - Role dashboard
  - Alerts and status summary
- **Tasks tab**
  - Seed booking tasks
  - No-burn tasks
  - Inspection tasks (role-based)
  - Approval queue (staff/admin)
- **Records tab**
  - Member profile/status
  - Plot list/detail
  - Planting cycle detail
  - Photo history/evidence
- **Profile tab**
  - Account info
  - Role info
  - Help/contact

## 5.4 Contextual quick actions
- Floating or sticky quick actions are allowed only for top-priority tasks:
  - Register member
  - Add plot
  - Submit no-burn evidence
  - Submit inspection result
- Do not show more than 2 quick actions on one screen.

## 6) Interaction patterns
1. **Single-page forms** for short input sets; **stepper forms** for long data capture.
2. **Autosave draft** for long workflows (especially evidence submission).
3. **Inline validation first**, blocking summary at submit.
4. **Confirmation modal** only for destructive/irreversible actions.
5. **Offline/intermittent handling**: show pending upload state with retry controls.

## 7) Accessibility + localization baseline
- Minimum text contrast aligned with WCAG AA targets.
- Dynamic text scaling should not break primary action visibility.
- Icon-only actions must include text labels or accessible names.
- Thai-first wording with concise microcopy; avoid jargon.
- Dates/times should use locale-aware formatting and explicit timezone context when needed.

## 8) Screen-level UX requirements (MVP critical)
1. **Member registration**: progress indicator + OCR/manual branch clearly shown.
2. **Plot registration**: map/GPS accuracy feedback before final save.
3. **Seed booking**: inventory expectation and review status visibility.
4. **No-burn evidence**: photo checklist + geolocation capture confirmation.
5. **Inspection form**: structured sections with sticky submit action.
6. **Admin approval queue**: high-density but readable cards with quick approve/reject.

## 9) Acceptance criteria
1. Design tokens cover color, typography, spacing, radius, and status semantics.
2. Navigation defines exactly four bottom tabs and role-aware behavior.
3. Component standards include touch targets, form validation, and status chips.
4. UX requirements map to all MVP-critical screens and workflows.
5. Accessibility and localization constraints are explicitly defined for LINE Mini App usage.

## 10) Out of scope (Issue #3)
- Final branded UI mockups.
- Full design tool library export (Figma package).
- Desktop-first layouts.
- Non-MVP analytics dashboards.
