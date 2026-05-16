import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '../../auth/line/line-auth-helpers';

export async function GET(request: Request) {
  try {
    const url      = new URL(request.url);
    const status   = url.searchParams.get('status')    ?? '';
    const memberId = url.searchParams.get('member_id') ?? '';

    const s = createServerSupabaseClient();
    let q = s.from('admin_seed_reservations').select('*').limit(200);
    if (status)   q = q.eq('status',    status);
    if (memberId) q = q.eq('member_id', memberId);

    const { data, error } = await q;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ items: data ?? [] });
  } catch (e) { return NextResponse.json({ error: String(e) }, { status: 500 }); }
}

// Actions: confirm | cancel | close_partial | close_full
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      action:         'confirm' | 'cancel' | 'close_partial' | 'close_full';
      reservation_id: string;
      reason?:        string;
      qty_sold?:      number;
      qty_remaining?: number;
      sale_order_id?: string;
      source_channel?: string;
      attachment_url?: string;
      attachment_path?: string;
    };
    if (!body.action || !body.reservation_id)
      return NextResponse.json({ error: 'action and reservation_id required' }, { status: 400 });

    const s   = createServerSupabaseClient();
    const now = new Date().toISOString();

    if (body.action === 'confirm') {
      const patch: Record<string, unknown> = { status: 'confirmed', updated_at: now };
      if (body.source_channel)  patch.source_channel  = body.source_channel;
      if (body.attachment_url)  patch.attachment_url  = body.attachment_url;
      if (body.attachment_path) patch.attachment_path = body.attachment_path;
      const { error } = await s.from('seed_reservations')
        .update(patch).eq('id', body.reservation_id).eq('status', 'pending');
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ ok: true });
    }

    if (body.action === 'cancel') {
      const { error } = await s.rpc('cancel_reservation', {
        p_reservation_id: body.reservation_id,
        p_reason:         body.reason ?? null,
      });
      if (error) return NextResponse.json({ error: error.message }, { status: 400 });
      return NextResponse.json({ ok: true });
    }

    // close_partial — ขายบางส่วน เหลือค้าง
    if (body.action === 'close_partial') {
      const { error } = await s.from('seed_reservations').update({
        status:        'partial',
        qty_sold:      body.qty_sold      ?? null,
        qty_remaining: body.qty_remaining ?? null,
        sale_order_id: body.sale_order_id ?? null,
        updated_at:    now,
      }).eq('id', body.reservation_id);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ ok: true });
    }

    // close_full — ปิดจองสมบูรณ์ (ขายครบ หรือพนักงานเลือกปิด)
    if (body.action === 'close_full') {
      const { error } = await s.from('seed_reservations').update({
        status:        'converted',
        qty_sold:      body.qty_sold      ?? null,
        sale_order_id: body.sale_order_id ?? null,
        closed_at:     now,
        updated_at:    now,
      }).eq('id', body.reservation_id);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: 'unknown action' }, { status: 400 });
  } catch (e) { return NextResponse.json({ error: String(e) }, { status: 500 }); }
}
