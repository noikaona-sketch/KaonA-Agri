import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '../../auth/line/line-auth-helpers';
import { resolveApprovedMember } from '../_auth';

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      planting_cycle_id: string;
      scheduled_date: string;
      estimated_qty_kg: number;
      note?: string;
    };

    if (!body.planting_cycle_id || !body.scheduled_date || !body.estimated_qty_kg) {
      return NextResponse.json({ error: 'ข้อมูลไม่ครบ' }, { status: 400 });
    }

    const s = createServerSupabaseClient();
    const caller = await resolveApprovedMember(request, s);
    if (!caller.ok) return caller.response;

    // ดึงราคาล่าสุด
    const { data: cycle } = await s.from('planting_cycles')
      .select('crop_name, quota_kg').eq('id', body.planting_cycle_id).single();

    const { data: price } = await s.from('market_prices')
      .select('price_per_kg').eq('is_active', true)
      .ilike('crop_type', `%${cycle?.crop_name ?? 'ข้าวโพด'}%`)
      .order('effective_date', { ascending: false }).limit(1).maybeSingle();

    const pricePerKg = price?.price_per_kg ?? 8.0;

    // สร้าง appointment number
    let seqNum = Date.now();
    try {
      const seqRes = await s.rpc('nextval', { seq: 'sale_appointment_seq' }).maybeSingle();
      if (seqRes.data) seqNum = seqRes.data as number;
    } catch { /* ใช้ timestamp แทน */ }
    const apptNo = `SA-${new Date().getFullYear() + 543}-${String(seqNum).padStart(5, '0')}`;

    const { data, error } = await s.from('sale_appointments').insert({
      appointment_number: apptNo,
      planting_cycle_id: body.planting_cycle_id,
      member_id:         caller.memberId,
      scheduled_date:    body.scheduled_date,
      estimated_qty_kg:  body.estimated_qty_kg,
      quota_remaining_kg: cycle?.quota_kg ?? null,
      price_per_kg:      pricePerKg,
      note: body.note ?? null,
      status: 'pending',
    }).select('id, appointment_number, price_per_kg, total_amount').single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, ...data });
  } catch (e) { return NextResponse.json({ error: String(e) }, { status: 500 }); }
}

export async function GET(request: Request) {
  const s = createServerSupabaseClient();
  const caller = await resolveApprovedMember(request, s);
  if (!caller.ok) return caller.response;
  const { searchParams } = new URL(request.url);
  const cycleId  = searchParams.get('cycle_id');

  // ดึงราคาล่าสุดพร้อมกัน
  const [appts, price] = await Promise.all([
    cycleId
      ? s.from('sale_appointments').select('*').eq('planting_cycle_id', cycleId).eq('member_id', caller.memberId).order('scheduled_date')
      : s.from('sale_appointments').select('*').eq('member_id', caller.memberId).order('scheduled_date', { ascending: false }).limit(20),
    s.from('market_prices').select('crop_type, price_per_kg, effective_date')
      .eq('is_active', true).order('effective_date', { ascending: false }).limit(5),
  ]);

  return NextResponse.json({ appointments: appts.data ?? [], latest_prices: price.data ?? [] });
}
