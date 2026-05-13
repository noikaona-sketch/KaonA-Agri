import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '../../auth/line/line-auth-helpers';

async function getMemberId(request: Request): Promise<string | null> {
  const s = createServerSupabaseClient();
  const { data: { user } } = await s.auth.getUser();
  if (!user) return null;
  const { data } = await s.from('members').select('id').eq('auth_user_id', user.id).maybeSingle();
  return (data as { id: string } | null)?.id ?? null;
}

// POST — สร้างการจองเมล็ดพันธุ์
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      lot_id?: string;
      qty?: number;
      pickup_date?: string;
      note?: string;
    };

    if (!body.lot_id || !body.qty || body.qty <= 0) {
      return NextResponse.json({ error: 'กรุณาระบุ lot_id และจำนวน' }, { status: 400 });
    }

    const memberId = await getMemberId(request);
    if (!memberId) return NextResponse.json({ error: 'กรุณาเข้าสู่ระบบ' }, { status: 401 });

    const s = createServerSupabaseClient();

    const { data, error } = await s.rpc('create_seed_reservation', {
      p_member_id:   memberId,
      p_lot_id:      body.lot_id,
      p_qty:         body.qty,
      p_pickup_date: body.pickup_date ?? null,
      p_note:        body.note ?? null,
      p_created_by:  memberId,
    });

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true, ...(data as object) });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

// GET — ประวัติการจองของสมาชิก
export async function GET(request: Request) {
  try {
    const memberId = await getMemberId(request);
    if (!memberId) return NextResponse.json({ error: 'กรุณาเข้าสู่ระบบ' }, { status: 401 });

    const s = createServerSupabaseClient();
    const { data, error } = await s
      .from('seed_reservations')
      .select('id,reservation_no,status,qty_reserved,qty_received,price_per_bag,total_amount,pickup_date,variety_name,lot_no,supplier_name,created_at,stock_deducted')
      .eq('member_id', memberId)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ items: data ?? [] });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
