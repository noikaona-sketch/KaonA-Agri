import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '../../auth/line/line-auth-helpers';

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      member_id: string;
      lot_id: string;
      qty_reserved: number;
      pickup_date?: string;
      note?: string;
    };

    if (!body.member_id || !body.lot_id || !body.qty_reserved) {
      return NextResponse.json({ error: 'ข้อมูลไม่ครบ' }, { status: 400 });
    }

    const s = createServerSupabaseClient();
    const { data, error } = await s.rpc('create_seed_reservation', {
      p_member_id:   body.member_id,
      p_lot_id:      body.lot_id,
      p_qty:         body.qty_reserved,
      p_pickup_date: body.pickup_date ?? null,
      p_note:        body.note ?? null,
      p_created_by:  body.member_id,
    });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, ...(data as object) });
  } catch (e) { return NextResponse.json({ error: String(e) }, { status: 500 }); }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const memberId = searchParams.get('member_id');
  if (!memberId) return NextResponse.json({ reservations: [] });

  const s = createServerSupabaseClient();
  const { data } = await s.from('seed_reservations')
    .select(`
      id, reservation_no, status, stock_deducted,
      variety_name, lot_no, supplier_name,
      qty_reserved, qty_received, price_per_bag, total_amount,
      pickup_date, note, created_at, updated_at,
      seed_stock_lots(bag_weight_kg),
      seed_varieties(crop_type, days_to_harvest)
    `)
    .eq('member_id', memberId)
    .order('created_at', { ascending: false })
    .limit(50);

  return NextResponse.json({ reservations: data ?? [] });
}
