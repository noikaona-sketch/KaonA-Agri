// Field staff seed reservation API
// Creates seed_reservations (not sale_orders) — same source of truth as member path
// created_by = staff_id for tracking who booked on behalf of member

import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '../../auth/line/line-auth-helpers';

const FIELD_ROLES = ['staff', 'admin', 'inspector', 'leader'];

async function validateStaff(staffId: string): Promise<boolean> {
  if (!staffId) return false;
  const s = createServerSupabaseClient();
  const { data } = await s.from('member_roles')
    .select('role').eq('member_id', staffId).in('role', FIELD_ROLES).limit(1).maybeSingle();
  return !!data;
}

async function validateMember(memberId: string): Promise<boolean> {
  if (!memberId) return false;
  const s = createServerSupabaseClient();
  const { data } = await s.from('members')
    .select('id,status').eq('id', memberId).maybeSingle();
  return !!(data && (data as { status: string }).status === 'approved');
}

// GET ?staff_id=&member_id=&search=
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const staffId  = searchParams.get('staff_id')  ?? '';
    const memberId = searchParams.get('member_id') ?? '';
    const search   = searchParams.get('search')    ?? '';

    if (!staffId) return NextResponse.json({ error: 'staff_id required' }, { status: 400 });
    const validStaff = await validateStaff(staffId);
    if (!validStaff) return NextResponse.json({ error: 'ไม่มีสิทธิ์เข้าถึง' }, { status: 403 });

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

    // การจองของสมาชิกที่เลือก (from seed_reservations)
    if (memberId) {
      const { data, error } = await s.from('seed_reservations')
        .select('id,reservation_no,status,qty_reserved,total_amount,price_per_bag,pickup_date,variety_name,supplier_name,created_at,product_id,products(name,bag_weight_kg)')
        .eq('member_id', memberId)
        .order('created_at', { ascending: false }).limit(20);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ reservations: data ?? [] });
    }

    // ประวัติที่ staff นี้จองให้คนอื่น (created_by = staffId)
    const { data, error } = await s.from('seed_reservations')
      .select('id,reservation_no,status,qty_reserved,total_amount,price_per_bag,pickup_date,variety_name,created_at,note,source_channel,member:members!seed_reservations_member_id_fkey(full_name,phone)')
      .eq('created_by', staffId)
      .order('created_at', { ascending: false }).limit(50);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ reservations: data ?? [] });
  } catch (e) { return NextResponse.json({ error: String(e) }, { status: 500 }); }
}

// POST — จองเมล็ดพันธุ์แทนสมาชิก → สร้าง seed_reservations
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      staff_id:        string;
      member_id:       string;
      product_id:      string;
      qty:             number;
      note?:           string;
      source_channel?: string;
      pickup_slot_id?: string;
      pickup_date?:    string;
    };

    if (!body.staff_id || !body.member_id || !body.product_id || !body.qty || body.qty <= 0)
      return NextResponse.json({ error: 'ข้อมูลไม่ครบ' }, { status: 400 });

    // ตรวจสิทธิ์ staff
    const validStaff = await validateStaff(body.staff_id);
    if (!validStaff) return NextResponse.json({ error: 'ไม่มีสิทธิ์เข้าถึง' }, { status: 403 });

    // ตรวจสมาชิกเป้าหมาย
    const validMember = await validateMember(body.member_id);
    if (!validMember)
      return NextResponse.json({ error: 'สมาชิกไม่ถูกต้องหรือยังไม่ได้รับอนุมัติ' }, { status: 400 });

    const s = createServerSupabaseClient();

    // ตรวจสินค้าเมล็ดพันธุ์ — same validation as /api/member/seed-reservation
    const { data: product, error: pErr } = await s.from('products')
      .select('id,name,seed_variety,brand,price_per_unit,product_type,is_active,deleted_at,seed_variety_id')
      .eq('id', body.product_id).maybeSingle();

    if (pErr) return NextResponse.json({ error: pErr.message }, { status: 500 });
    if (!product || product.deleted_at || !product.is_active || product.product_type !== 'seed')
      return NextResponse.json({ error: 'ไม่พบสินค้าเมล็ดพันธุ์' }, { status: 400 });

    const p = product as unknown as Record<string, unknown>;
    if (!p.seed_variety_id)
      return NextResponse.json(
        { error: 'เมล็ดพันธุ์นี้ยังไม่ได้สร้างเป็นสินค้าใน Product Master' },
        { status: 400 }
      );

    const year           = new Date().getFullYear() + 543;
    const reservation_no = `RV-${year}-${String(Date.now() % 100000).padStart(5, '0')}`;
    const pricePerBag    = Number(product.price_per_unit ?? 0);

    const { error } = await s.from('seed_reservations').insert({
      reservation_no,
      member_id:       body.member_id,
      created_by:      body.staff_id,           // track staff who booked
      product_id:      product.id,
      seed_variety_id: p.seed_variety_id as string,
      variety_id:      null,
      lot_id:          null,
      lot_no:          null,
      variety_name:    product.seed_variety ?? product.name,
      supplier_name:   product.brand ?? null,
      qty_reserved:    body.qty,
      price_per_bag:   pricePerBag,
      pickup_date:     body.pickup_date     ?? null,
      pickup_slot_id:  body.pickup_slot_id  ?? null,
      source_channel:  body.source_channel  ?? 'field_staff',
      note:            body.note            ?? null,
      status:          'pending',
    });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({
      ok: true,
      reservation_no,
      total_amount: body.qty * pricePerBag,
    });
  } catch (e) { return NextResponse.json({ error: String(e) }, { status: 500 }); }
}
