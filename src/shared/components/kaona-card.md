# KaonaCard

Reusable card component for Issue #107.

## Component

```tsx
import { KaonaCard } from '@/shared/components/kaona-card';
```

## Variants

Supported variants:

- `feature`
- `info`
- `status`
- `service`
- `summary`
- `kpi`
- `approval`
- `field`

## Example

```tsx
<KaonaCard
  variant="feature"
  title="จองเมล็ดพันธุ์"
  subtitle="เลือกฤดูปลูกและรอบรับสินค้า"
  meta="ใหม่"
  icon={<img src="/icons/features/seed.svg" alt="" />}
>
  ใช้เป็นการ์ดฟีเจอร์ในหน้า member/service/field/admin
</KaonaCard>
```

## Design rules

- One visual language across app areas
- Mobile-first spacing
- Thai-first readability
- Rounded corners and soft elevation
- Use SVG feature icons from `public/icons/features/`
- Keep business logic outside this component

## Scope guard

Do not add auth, backend, Supabase, RLS, migration, booking, GPS, or OCR logic here.
