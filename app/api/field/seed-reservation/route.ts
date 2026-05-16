import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '../../../auth/line/line-auth-helpers';

const FIELD_ROLES = ['staff','admin','inspector','leader'];

async function validateStaff(staffId: string): Promise<boolean> {
  if (!staffId) return false;
  const s = createServerSupabaseClient();
  const { data } = await s.from('member_roles')
    .select('role').eq('member_id', staffId).in('role', FIELD_ROLES).limit(1).maybeSingle();
  return !!data;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const staffId  = searchParams.get('staff_id')  ?? '';
    const memberId = searchParams.get('member_id') ?? '';
    const search   = searchParams.get('search')    ?? '';
    if (!staffId) return NextResponse.json({ error: 'staff_id required' }, { status: 400 });
    const valid = await validateStaff(staffId);
    if (!valid) return NextResponse.json({ error: 'ไม่มีสิทธิ์เข้าถึง' }, { status: 403 });
    const s = createServerSupabaseClient();

    // ค้นหาสมาชิก
    if (search) {
      const { data } = await s.from('members')
        .select('id,full_name,phone,member_number,status')
        .eq('status', 'approved')
        .or(`full_name.ilike.%${search}%,phone.ilike.%${search}%,member_number.ilike.%${search}%`)
        .limit(10);
      return NextResponse.json({ members: data ?? [] });
    }

    // การจองของสมาชิกที่เลือก
    if (memberId) {
      const { data } = await s.from('sale_orders')
        .select('id,order_number,status,total,created_at,note,pickup_slots(pickup_date,pickup_time,pickup_locations(name)),order_items(product_name,qty,unit_price,product_unit)')
        .eq('member_id', memberId).eq('order_type', 'reservation')
        .order('created_at', { ascending: false }).limit(20);
      return NextResponse.json({ reservations: data ?? [] });
    }

    // ประวัติที่ staff คนนี้จองให้คนอื่น
    const { data } = await s.from('sale_orders')
      .select('id,order_number,status,total,created_at,note,member:members!sale_orders_member_id_fkey(full_name,phone),order_items(product_name,qty,unit_price,product_unit)')
      .eq('created_by', staffId).eq('order_type', 'reservation')
      .order('created_at', { ascending: false }).limit(50);
    return NextResponse.json({ reservations: data ?? [] });
  } catch (e) { return NextResponse.json({ error: String(e) }, { status: 500 }); }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      staff_id: string; member_id: string; product_id: string;
      qty: number; note?: string; source_channel?: string; pickup_slot_id?: string;
    };
    if (!body.staff_id || !body.member_id || !body.product_id || !body.qty)
      return NextResponse.json({ error: 'ข้อมูลไม่ครบ' }, { status: 400 });
    const valid = await validateStaff(body.staff_id);
    if (!valid) return NextResponse.json({ error: 'ไม่มีสิทธิ์เข้าถึง' }, { status: 403 });

    const s = createServerSupabaseClient();
    const { data: product, error: pErr } = await s.from('products')
      .select('id,name,price_per_unit,product_type,is_active,deleted_at')
      .eq('id', body.product_id).maybeSingle();

    if (pErr) return NextResponse.json({ error: pErr.message }, { status: 500 });
    if (!product || product.deleted_at || !product.is_active || product.product_type !== 'seed')
      return NextResponse.json({ error: 'ไม่พบสินค้าเมล็ดพันธุ์' }, { status: 400 });

    const unitPrice = Number(product.price_per_unit ?? 0);
    const year      = new Date().getFullYear() + 543;
    const order_no  = `SO-${year}-${String(Date.now() % 100000).padStart(5, '0')}`;

    const { data: order, error: oErr } = await s.from('sale_orders').insert({
      order_number: order_no, member_id: body.member_id,
      created_by:   body.staff_id,
      order_type:   'reservation', status: 'pending',
      payment_method: 'credit', payment_status: 'unpaid',
      paid_amount: 0, discount: 0, total: unitPrice * body.qty,
      note: body.note ?? null,
      pickup_slot_id: body.pickup_slot_id ?? null,
      source_type: body.source_channel ?? 'field_staff',
    }).select('id').single();

    if (oErr) return NextResponse.json({ error: oErr.message }, { status: 500 });

    const { error: iErr } = await s.from('order_items').insert({
      order_id: order!.id, product_id: product.id,
      product_name: product.name, product_name_snapshot: product.name,
      product_unit: 'ถุง', qty: body.qty, unit_price: unitPrice,
    });
    if (iErr) {
      await s.from('sale_orders').delete().eq('id', order!.id);
      return NextResponse.json({ error: iErr.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true, order_number: order_no, total: unitPrice * body.qty });
  } catch (e) { return NextResponse.json({ error: String(e) }, { status: 500 }); }
}
