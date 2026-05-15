import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '../../auth/line/line-auth-helpers';

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      member_id: string;
      variety_id: string;
      variety_name: string;
      supplier_name?: string;
      qty_reserved: number;
      price_per_bag: number;
      bag_weight_kg: number;
      pickup_date?: string;
      pickup_slot_id?: string;
      note?: string;
    };

    if (!body.member_id || !body.variety_id || !body.qty_reserved) {
      return NextResponse.json({ error: 'ข้อมูลไม่ครบ' }, { status: 400 });
    }

    // DEV BYPASS — mock member ไม่บันทึกจริง
    if (body.member_id === 'dev-mock-member-id') {
      const year = new Date().getFullYear() + 543;
      return NextResponse.json({ ok: true, reservation_no: `RV-${year}-99999`, total_amount: body.qty_reserved * body.price_per_bag });
    }

    const s = createServerSupabaseClient();

    // อัปเดต booked_qty ใน slot
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

    // สร้าง reservation_no
    const year = new Date().getFullYear() + 543;
    const seq  = Date.now() % 100000;
    const reservation_no = `RV-${year}-${String(seq).padStart(5, '0')}`;

    const totalAmount = body.qty_reserved * body.price_per_bag;

    const { error } = await s.from('seed_reservations').insert({
      reservation_no,
      member_id:       body.member_id,
      variety_id:      body.variety_id,
      variety_name:    body.variety_name,
      supplier_name:   body.supplier_name ?? null,
      lot_id:          body.variety_id,   // ชั่วคราว ก่อน admin assign lot จริง
      lot_no:          'TBD',
      qty_reserved:    body.qty_reserved,
      price_per_bag:   body.price_per_bag,
      pickup_date:     body.pickup_date ?? null,
      pickup_slot_id:  body.pickup_slot_id ?? null,
      note:            body.note ?? null,
      status:          'pending',
    });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, reservation_no, total_amount: totalAmount });
  } catch (e) { return NextResponse.json({ error: String(e) }, { status: 500 }); }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const memberId = searchParams.get('member_id');
  if (!memberId) return NextResponse.json({ reservations: [] });

  const s = createServerSupabaseClient();
  const { data } = await s.from('seed_reservations')
    .select('id,reservation_no,status,variety_name,lot_no,supplier_name,qty_reserved,price_per_bag,total_amount,pickup_date,note,created_at,seed_stock_lots(bag_weight_kg)')
    .eq('member_id', memberId)
    .order('created_at', { ascending: false })
    .limit(50);

  return NextResponse.json({ reservations: data ?? [] });
}
