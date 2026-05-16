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

// GET — ประวัติการจองของสมาชิก (member_id จาก query param)
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const memberId = searchParams.get('member_id') ?? '';
    if (!memberId) return NextResponse.json({ reservations: [] });

    const valid = await validateMember(memberId);
    if (!valid)
      return NextResponse.json({ error: 'สมาชิกไม่ถูกต้อง' }, { status: 403 });

    const s = createServerSupabaseClient();

    // ── 1. seed_reservations (เมล็ดพันธุ์จองตรง) ─────────────────────
    const { data: seedRows, error: seedErr } = await s.from('seed_reservations')
      .select('id,reservation_no,status,qty_reserved,total_amount,price_per_bag,pickup_date,variety_name,supplier_name,lot_no,created_at,product_id,products(bag_weight_kg)')
      .eq('member_id', memberId)
      .order('created_at', { ascending: false }).limit(50);
    if (seedErr) return NextResponse.json({ error: seedErr.message }, { status: 500 });

    // ── 2. sale_orders (order_type=reservation จาก POS) ──────────────
    const { data: soRows, error: soErr } = await s.from('sale_orders')
      .select('id,order_number,status,total,created_at,note,pickup_slot_id,pickup_slots(pickup_date,pickup_time),order_items(product_name,qty,unit_price,product_unit)')
      .eq('member_id', memberId)
      .eq('order_type', 'reservation')
      .order('created_at', { ascending: false }).limit(50);
    if (soErr) return NextResponse.json({ error: soErr.message }, { status: 500 });

    type SoRow = {
      id: string; order_number: string; status: string; total: number;
      created_at: string; note: string | null; pickup_slot_id: string | null;
      pickup_slots: { pickup_date: string; pickup_time: string } | null;
      order_items: { product_name: string; qty: number; unit_price: number; product_unit: string }[];
    };

    // normalise sale_orders → Reservation shape
    const soNormalised = ((soRows ?? []) as unknown as SoRow[]).map((o) => {
      const slot      = o.pickup_slots;
      const firstItem = o.order_items?.[0];
      return {
        id:             o.id,
        reservation_no: o.order_number,
        status:         o.status === 'completed' ? 'completed' : o.status,
        qty_reserved:   firstItem?.qty ?? 0,
        total_amount:   o.total,
        price_per_bag:  firstItem?.unit_price ?? 0,
        pickup_date:    slot?.pickup_date ?? null,
        variety_name:   firstItem?.product_name ?? '—',
        supplier_name:  null,
        lot_no:         null,
        created_at:     o.created_at,
        product_id:     null,
        products:       null,
        _source:        'sale_order',
      };
    });

    // รวม + เรียงวันที่
    const all = [
      ...(seedRows ?? []).map((r) => ({ ...r, _source: 'seed_reservation' })),
      ...soNormalised,
    ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    return NextResponse.json({ reservations: all });
  } catch (e) { return NextResponse.json({ error: String(e) }, { status: 500 }); }
}
