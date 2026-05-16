import { NextResponse }               from 'next/server';
import { createServerSupabaseClient } from '../../auth/line/line-auth-helpers';

// Option A: member_id from caller (useCurrentMember), validated server-side
// TODO: migrate to cookie-based session auth once server auth cookies are implemented

async function validateMember(memberId: string): Promise<boolean> {
  if (!memberId) return false;
  const s = createServerSupabaseClient();
  const { data } = await s
    .from('members')
    .select('id,status')
    .eq('id', memberId)
    .maybeSingle();
  return !!(data && (data as { status: string }).status === 'approved');
}

type ReservationBody = {
  member_id: string;
  product_id?: string; variety_id?: string;
  variety_name: string; supplier_name?: string;
  qty_reserved: number; price_per_bag: number; bag_weight_kg: number;
  pickup_date?: string; pickup_slot_id?: string; note?: string;
};

// POST — สร้างการจองเมล็ดพันธุ์
export async function POST(request: Request) {
  try {
    const body      = (await request.json()) as ReservationBody;
    const productId = body.product_id ?? body.variety_id;

    if (!body.member_id || !productId || !body.qty_reserved || body.qty_reserved <= 0)
      return NextResponse.json({ error: 'ข้อมูลไม่ครบ' }, { status: 400 });

    const valid = await validateMember(body.member_id);
    if (!valid)
      return NextResponse.json({ error: 'สมาชิกไม่ถูกต้องหรือยังไม่ได้รับอนุมัติ' }, { status: 403 });

    const s = createServerSupabaseClient();
    const { data: product, error: pErr } = await s.from('products')
      .select('id,name,seed_variety,brand,price_per_unit,product_type,is_active,deleted_at,seed_variety_id')
      .eq('id', productId).maybeSingle();

    if (pErr) return NextResponse.json({ error: pErr.message }, { status: 500 });
    if (!product || product.deleted_at || !product.is_active || product.product_type !== 'seed')
      return NextResponse.json({ error: 'ไม่พบสินค้าเมล็ดพันธุ์' }, { status: 400 });

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

    const { error } = await s.from('seed_reservations').insert({
      reservation_no, member_id: body.member_id, product_id: product.id,
      // seed_variety_id snapshot — from product.seed_variety_id at booking time, immutable after
      seed_variety_id: (product as unknown as Record<string, unknown>).seed_variety_id as string | null ?? null,
      variety_id: null, lot_id: null, lot_no: null,
      variety_name:   product.seed_variety ?? body.variety_name ?? product.name,
      supplier_name:  body.supplier_name ?? product.brand ?? null,
      qty_reserved:   body.qty_reserved,  price_per_bag: pricePerBag,
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
// bag_weight_kg มาจาก products join — ไม่ใช้ seed_stock_lots
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const memberId = searchParams.get('member_id') ?? '';
    if (!memberId) return NextResponse.json({ reservations: [] });

    const valid = await validateMember(memberId);
    if (!valid)
      return NextResponse.json({ error: 'สมาชิกไม่ถูกต้อง' }, { status: 403 });

    const s = createServerSupabaseClient();
    const { data, error } = await s.from('seed_reservations')
      .select(`
        id, reservation_no, status,
        qty_reserved, total_amount, price_per_bag,
        pickup_date, variety_name, supplier_name,
        lot_no, created_at, product_id,
        products(bag_weight_kg)
      `)
      .eq('member_id', memberId)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ reservations: data ?? [] });
  } catch (e) { return NextResponse.json({ error: String(e) }, { status: 500 }); }
}
