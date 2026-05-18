import { NextResponse }               from 'next/server';
import { createServerSupabaseClient } from '../../auth/line/line-auth-helpers';

// Option A: member_id from caller (useCurrentMember), validated server-side
// TODO: migrate to cookie-based session auth once server auth cookies are implemented

async function validateMember(memberId: string): Promise<boolean> {
  if (!memberId) return false;
  const s = createServerSupabaseClient();
  const { data } = await s
    .from('members').select('id,status').eq('id', memberId).maybeSingle();
  return !!(data && (data as { status: string }).status === 'approved');
}

type ReservationBody = {
  member_id: string;
  product_id: string;            // required — must be Product Master seed product
  variety_name: string; supplier_name?: string;
  qty_reserved: number; price_per_bag: number; bag_weight_kg: number;
  pickup_date?: string; pickup_slot_id?: string; note?: string;
};

// POST — สร้างการจองเมล็ดพันธุ์ (product_id required, no variety_id fallback)
// POST behavior is NOT changed by this PR.
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as ReservationBody;

    // product_id is required — no variety_id fallback
    if (!body.member_id || !body.product_id || !body.qty_reserved || body.qty_reserved <= 0)
      return NextResponse.json({ error: 'ข้อมูลไม่ครบ' }, { status: 400 });

    const valid = await validateMember(body.member_id);
    if (!valid)
      return NextResponse.json({ error: 'สมาชิกไม่ถูกต้องหรือยังไม่ได้รับอนุมัติ' }, { status: 403 });

    const s = createServerSupabaseClient();
    const { data: product, error: pErr } = await s.from('products')
      .select('id,name,seed_variety,brand,price_per_unit,product_type,is_active,deleted_at,seed_variety_id')
      .eq('id', body.product_id).maybeSingle();

    if (pErr) return NextResponse.json({ error: pErr.message }, { status: 500 });

    // strict validation per business rules
    if (!product || product.deleted_at || !product.is_active || product.product_type !== 'seed')
      return NextResponse.json({ error: 'ไม่พบสินค้าเมล็ดพันธุ์' }, { status: 400 });

    // seed_variety_id must be linked — no direct variety reservation allowed
    if (!(product as unknown as Record<string, unknown>).seed_variety_id)
      return NextResponse.json(
        { error: 'เมล็ดพันธุ์นี้ยังไม่ได้สร้างเป็นสินค้าใน Product Master' },
        { status: 400 }
      );

    if (body.pickup_slot_id) {
      const { data: slot } = await s.from('pickup_slots')
        .select('booked_qty,capacity_qty,status').eq('id', body.pickup_slot_id).single();
      if (slot) {
        const next = (slot.booked_qty ?? 0) + body.qty_reserved;
        await s.from('pickup_slots').update({
          booked_qty: next,
          status: next >= (slot.capacity_qty ?? 999) ? 'full' : slot.status,
        }).eq('id', body.pickup_slot_id);
      }
    }

    const year           = new Date().getFullYear() + 543;
    const reservation_no = `RV-${year}-${String(Date.now() % 100000).padStart(5, '0')}`;
    const pricePerBag    = Number(product.price_per_unit ?? body.price_per_bag ?? 0);
    const p              = product as unknown as Record<string, unknown>;

    const { error } = await s.from('seed_reservations').insert({
      reservation_no,
      member_id:      body.member_id,
      product_id:     product.id,
      seed_variety_id: p.seed_variety_id as string,   // snapshot at booking time
      variety_id:     null, lot_id: null, lot_no: null,
      variety_name:   product.seed_variety ?? body.variety_name ?? product.name,
      supplier_name:  body.supplier_name ?? product.brand ?? null,
      qty_reserved:   body.qty_reserved,
      price_per_bag:  pricePerBag,
      pickup_date:    body.pickup_date    ?? null,
      pickup_slot_id: body.pickup_slot_id ?? null,
      note:           body.note           ?? null,
      status:         'pending',
    });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, reservation_no, total_amount: body.qty_reserved * pricePerBag });
  } catch (e) { return NextResponse.json({ error: String(e) }, { status: 500 }); }
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/member/seed-reservation?member_id=<uuid>
//
// Returns combined purchase history from 3 sources (all existing tables):
//   1. seed_reservations           — direct seed reservations
//   2. sale_orders type=reservation — reservation via shop/POS
//   3. sale_orders type=sale        — immediate purchases via shop/POS  ← NEW
//
// Each row carries _source and _order_type to let the client distinguish
// display label and card type.
// ─────────────────────────────────────────────────────────────────────────────

// Shared order_items shape from sale_orders
type OrderItem = {
  product_name: string;
  qty:          number;
  unit_price:   number;
  product_unit: string;
};

// Normalised row sent to client — union of all 3 sources
export type HistoryRow = {
  id:             string;
  reservation_no: string;
  status:         string;
  qty_reserved:   number;
  total_amount:   number;
  price_per_bag:  number;
  pickup_date:    string | null;
  variety_name:   string;
  supplier_name:  string | null;
  lot_no:         string | null;
  created_at:     string;
  product_id:     string | null;
  // items present for sale_order rows (both reservation + sale)
  order_items:    OrderItem[] | null;
  // source flags — used by client for label / card styling
  _source:        'seed_reservation' | 'sale_order_reservation' | 'sale_order_sale';
};

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const memberId = searchParams.get('member_id') ?? '';
    if (!memberId) return NextResponse.json({ reservations: [] });

    const valid = await validateMember(memberId);
    if (!valid)
      return NextResponse.json({ error: 'สมาชิกไม่ถูกต้อง' }, { status: 403 });

    const s = createServerSupabaseClient();

    // ── Source 1: seed_reservations (จองตรง) ────────────────────────────
    const { data: seedRows, error: seedErr } = await s
      .from('seed_reservations')
      .select(
        'id,reservation_no,status,qty_reserved,total_amount,price_per_bag,' +
        'pickup_date,variety_name,supplier_name,lot_no,created_at,product_id'
      )
      .eq('member_id', memberId)
      .order('created_at', { ascending: false })
      .limit(50);

    if (seedErr) return NextResponse.json({ error: seedErr.message }, { status: 500 });

    // ── Source 2 & 3: sale_orders (both reservation + sale) ─────────────
    // Single query for both order_types — split by order_type after fetch.
    type SoRow = {
      id: string; order_number: string; order_type: string;
      status: string; total: number; created_at: string; note: string | null;
      pickup_slots: { pickup_date: string } | null;
      order_items: OrderItem[];
    };

    const { data: soRows, error: soErr } = await s
      .from('sale_orders')
      .select(
        'id,order_number,order_type,status,total,created_at,note,' +
        'pickup_slots(pickup_date),' +
        'order_items(product_name,qty,unit_price,product_unit)'
      )
      .eq('member_id', memberId)
      .in('order_type', ['reservation', 'sale'])
      .order('created_at', { ascending: false })
      .limit(100);

    if (soErr) return NextResponse.json({ error: soErr.message }, { status: 500 });

    // ── Normalise seed_reservations rows ─────────────────────────────────
    const normSeed: HistoryRow[] = ((seedRows ?? []) as unknown as Array<Record<string, unknown>>).map((r) => ({
      id:             r.id as string,
      reservation_no: r.reservation_no as string,
      status:         r.status as string,
      qty_reserved:   Number(r.qty_reserved ?? 0),
      total_amount:   Number(r.total_amount ?? 0),
      price_per_bag:  Number(r.price_per_bag ?? 0),
      pickup_date:    (r.pickup_date as string | null) ?? null,
      variety_name:   (r.variety_name as string) || '—',
      supplier_name:  (r.supplier_name as string | null) ?? null,
      lot_no:         (r.lot_no as string | null) ?? null,
      created_at:     r.created_at as string,
      product_id:     (r.product_id as string | null) ?? null,
      order_items:    null,
      _source:        'seed_reservation',
    }));

    // ── Normalise sale_orders rows ────────────────────────────────────────
    const normSo: HistoryRow[] = ((soRows ?? []) as unknown as SoRow[]).map((o) => {
      const firstItem = o.order_items?.[0];
      const isReservation = o.order_type === 'reservation';
      return {
        id:             o.id,
        reservation_no: o.order_number,
        status:         o.status,
        qty_reserved:   firstItem?.qty ?? 0,
        total_amount:   o.total,
        price_per_bag:  firstItem?.unit_price ?? 0,
        pickup_date:    o.pickup_slots?.pickup_date ?? null,
        variety_name:   firstItem?.product_name ?? '—',
        supplier_name:  null,
        lot_no:         null,
        created_at:     o.created_at,
        product_id:     null,
        order_items:    o.order_items?.length > 0 ? o.order_items : null,
        _source:        isReservation ? 'sale_order_reservation' : 'sale_order_sale',
      };
    });

    // ── Merge and sort by created_at desc ────────────────────────────────
    const all: HistoryRow[] = [...normSeed, ...normSo].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    );

    return NextResponse.json({ reservations: all });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
