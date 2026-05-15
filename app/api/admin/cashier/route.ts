import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '../../auth/line/line-auth-helpers';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status');
  const s = createServerSupabaseClient();
  let q = s.from('cashier_sessions').select('*,warehouses(name)').order('opened_at', { ascending: false }).limit(20);
  if (status) q = q.eq('status', status);
  const { data } = await q;
  return NextResponse.json({ sessions: data ?? [] });
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      action: 'open' | 'close';
      warehouse_id?: string;
      opening_cash?: number;
      closing_cash?: number;
      note?: string;
      session_id?: string;
    };
    const s = createServerSupabaseClient();

    if (body.action === 'open') {
      const year = new Date().getFullYear() + 543;
      const seq  = Date.now() % 100000;
      const session_no = `CS-${year}-${String(seq).padStart(5, '0')}`;
      const { data, error } = await s.from('cashier_sessions').insert({
        session_no,
        warehouse_id: body.warehouse_id,
        opening_cash: body.opening_cash ?? 0,
        status: 'open',
      }).select('id,session_no').single();
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ ok: true, ...data });
    }

    if (body.action === 'close' && body.session_id) {
      // คำนวณยอด
      const { data: sess } = await s.from('cashier_sessions').select('id,warehouse_id,opened_at').eq('id', body.session_id).single();
      if (!sess) return NextResponse.json({ error: 'ไม่พบรอบ' }, { status: 404 });

      const { data: orders } = await s.from('sale_orders')
        .select('total_amount,paid_amount,payment_method')
        .gte('created_at', sess.opened_at)
        .eq('warehouse_id', sess.warehouse_id);

      const totals = (orders ?? []).reduce((acc, o) => {
        acc.total += o.total_amount ?? 0;
        if (o.payment_method === 'cash')     acc.cash     += o.paid_amount ?? 0;
        if (o.payment_method === 'transfer') acc.transfer += o.paid_amount ?? 0;
        if (o.payment_method === 'credit')   acc.credit   += o.paid_amount ?? 0;
        return acc;
      }, { total: 0, cash: 0, transfer: 0, credit: 0 });

      const { error } = await s.from('cashier_sessions').update({
        status: 'closed', closed_at: new Date().toISOString(),
        closing_cash: body.closing_cash ?? 0,
        total_sales:  totals.total,
        total_cash:   totals.cash,
        total_transfer: totals.transfer,
        total_credit: totals.credit,
        cash_difference: (body.closing_cash ?? 0) - totals.cash,
        note: body.note ?? null,
      }).eq('id', body.session_id);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ ok: true, totals });
    }

    return NextResponse.json({ error: 'unknown action' }, { status: 400 });
  } catch (e) { return NextResponse.json({ error: String(e) }, { status: 500 }); }
}
