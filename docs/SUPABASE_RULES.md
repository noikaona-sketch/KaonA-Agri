# Supabase Rules for KaonA-Agri

> ⚠️ **MUST READ before writing any Supabase query or TypeScript type.**  
> These rules prevent recurring build failures caused by incorrect nested relation typing.

---

## 🚨 Rule 0: Quick Checklist (read BEFORE writing any type)

Every time you write a type with nested Supabase relations, ask:

```
Q: Is this field from a .select('relation(...)') ?
   YES → must be array: relation: { ... }[] | null
   NO  → can be scalar

Q: Am I accessing it?
   YES → must use [0]: item.relation?.[0]?.field
   NO  → skip
```

**Common relations in this codebase:**
```ts
plots: { name: string; province: string | null }[] | null
members: { full_name: string; phone: string | null }[] | null
planting_cycles: { crop_name: string }[] | null
no_burn_requests: { id: string; status: string }[] | null
member_group_members: { id: string; members: { ... }[] | null }[]
```

---

## Rule 1: Nested Relations are ALWAYS Arrays

Supabase `.select()` with nested relations **always returns an array**, even when the FK is a 1:1 relationship.

### ❌ WRONG — causes build failure

```ts
// DO NOT type nested relation as object
type Cycle = {
  plots: { name: string } | null;           // WRONG
  members: { full_name: string } | null;    // WRONG
  planting_cycles: { crop_name: string } | null; // WRONG
};

// DO NOT access like object
item.plots?.name
item.members?.full_name
item.planting_cycles?.crop_name
```

### ✅ CORRECT

```ts
// Always type nested relation as array
type Cycle = {
  plots: { name: string }[] | null;           // CORRECT
  members: { full_name: string }[] | null;    // CORRECT
  planting_cycles: { crop_name: string }[] | null; // CORRECT
};

// Always access with [0]
item.plots?.[0]?.name
item.members?.[0]?.full_name
item.planting_cycles?.[0]?.crop_name
```

---

## Rule 2: Common Pattern Reference

| Relation | Wrong | Correct |
|---|---|---|
| `plots(name)` | `plots?.name` | `plots?.[0]?.name` |
| `members(full_name)` | `members?.full_name` | `members?.[0]?.full_name` |
| `planting_cycles(crop_name)` | `planting_cycles?.crop_name` | `planting_cycles?.[0]?.crop_name` |
| `seed_varieties(variety_name)` | `seed_varieties?.variety_name` | `seed_varieties?.[0]?.variety_name` |
| `sale_orders(order_number)` | `sale_orders?.order_number` | `sale_orders?.[0]?.order_number` |

---

## Rule 3: Inline Hint Comment

When writing a type that includes nested relations, add a comment to prevent future mistakes:

```ts
type HarvestJob = {
  id: string;
  // nested relations — always arrays even for FK 1:1
  planting_cycles: {
    crop_name: string;
    plots: { name: string; lat: number | null }[] | null; // array
  }[] | null;
  members: { full_name: string; phone: string | null }[] | null; // array
};
```

---

## Rule 4: When Using `.maybeSingle()` or `.single()`

`.maybeSingle()` and `.single()` on the **top-level** query return an object — but any **nested** relations within that object are still arrays.

```ts
const { data } = await s
  .from('planting_cycles')
  .select('id, crop_name, plots(name, province)')  // plots = array inside!
  .eq('id', cycleId)
  .maybeSingle();  // top-level = object (or null)

// data is: { id: string; crop_name: string; plots: { name: string }[] | null }
// NOT:     { id: string; crop_name: string; plots: { name: string } | null }
```

---

## Rule 5: API Route vs Browser Client

| Context | Client | RLS |
|---|---|---|
| Admin pages (service role) | `createServerSupabaseClient()` | Bypassed |
| Member pages (browser) | `createSupabaseBrowserClient()` | Enforced |
| API routes (`/api/admin/*`) | `createServerSupabaseClient()` | Bypassed |
| API routes (`/api/member/*`) | `createServerSupabaseClient()` + verify LINE token | Enforced via logic |

**Never use browser client in API routes.**  
**Never call `decrement_lot_balance()` or stock-modifying RPCs from browser client.**

---

## Rule 6: Stock Decrement is Server-Only

```ts
// ❌ NEVER call from browser/client
supabase.rpc('decrement_lot_balance', { ... })

// ✅ Only call from API route (service role)
// /app/api/admin/seed-reservations/route.ts
const s = createServerSupabaseClient();  // service role
await s.rpc('convert_reservation_to_sale', { ... });
```

---

## Rule 7: Auth Pattern for Member API Routes

```ts
// ✅ Standard pattern for /api/member/* routes
async function getMemberId(request: Request): Promise<string | null> {
  const s = createServerSupabaseClient();
  const { data: { user } } = await s.auth.getUser();
  if (!user) return null;
  const { data } = await s.from('members')
    .select('id').eq('auth_user_id', user.id).maybeSingle();
  return (data as { id: string } | null)?.id ?? null;
}
```

---

## Quick Checklist Before Committing

- [ ] All nested relation types use `[]` not object
- [ ] All nested relation access uses `?.[0]?.` not `?.`
- [ ] Admin API routes use `createServerSupabaseClient()`
- [ ] No stock-modifying RPC called from browser client
- [ ] TypeScript passes: `npx tsc --noEmit`
