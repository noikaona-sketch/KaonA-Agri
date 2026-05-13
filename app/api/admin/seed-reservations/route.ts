import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '../../auth/line/line-auth-helpers';

// GET — รายการจองทั้งหมด (admin)
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const status = url.searchParams.get('status') ?? '';

    const s = createServerSupabaseClient();
    let q = s.from('admin_seed_reservations').select('*').limit(200);
    if (status) q = q.eq('status', status);

    const { data, error } = await q;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ items: data ?? [] });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

// POST — admin actions: confirm / convert / cancel
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      action: 'confirm' | 'convert' | 'cancel';
      reservation_id: string;
      qty_actual?: number;
      payment_method?: string;
      reason?: string;
    };

    if (!body.action || !body.reservation_id) {
      return NextResponse.json({ error: 'action and reservation_id required' }, { status: 400 });
    }

    const s = createServerSupabaseClient();

    if (body.action === 'confirm') {
      const { error } = await s.from('seed_reservations')
        .update({ status: 'confirmed', updated_at: new Date().toISOString() })
        .eq('id', body.reservation_id)
        .eq('status', 'pending');
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ ok: true });
    }

    if (body.action === 'convert') {
      if (!body.qty_actual || body.qty_actual <= 0) {
        return NextResponse.json({ error: 'กรุณาระบุปริมาณจริง' }, { status: 400 });
      }
      const { data, error } = await s.rpc('convert_reservation_to_sale', {
        p_reservation_id: body.reservation_id,
        p_qty_actual:     body.qty_actual,
        p_payment_method: body.payment_method ?? 'debit_account',
      });
      if (error) return NextResponse.json({ error: error.message }, { status: 400 });
      return NextResponse.json({ ok: true, ...(data as object) });
    }

    if (body.action === 'cancel') {
      const { error } = await s.rpc('cancel_reservation', {
        p_reservation_id: body.reservation_id,
        p_reason:         body.reason ?? null,
      });
      if (error) return NextResponse.json({ error: error.message }, { status: 400 });
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: 'unknown action' }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
