import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '../../auth/line/line-auth-helpers';

export async function GET() {
  const s = createServerSupabaseClient();
  const { data } = await s.from('accounting_periods').select('*').order('start_date', { ascending: false }).limit(24);
  return NextResponse.json({ periods: data ?? [] });
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { action: string; id?: string; note?: string; closed_by?: string };
    const s = createServerSupabaseClient();

    if (body.action === 'close' && body.id) {
      // ตรวจ cashier session ยังเปิดอยู่ไหม
      const { data: open } = await s.from('cashier_sessions').select('id').eq('status','open').limit(1);
      if ((open ?? []).length > 0) {
        return NextResponse.json({ error: 'ยังมีรอบแคชเชียร์ที่ยังไม่ปิด' }, { status: 400 });
      }

      // lock movements
      await s.from('stock_movements').update({ is_locked: true }).eq('period_id', body.id);

      // close period
      const { error } = await s.from('accounting_periods').update({
        status: 'closed', closed_at: new Date().toISOString(),
        closed_by: body.closed_by ?? null, note: body.note ?? null,
      }).eq('id', body.id);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });

      // เปิด period ใหม่เดือนถัดไป
      const { data: period } = await s.from('accounting_periods').select('end_date').eq('id', body.id).single();
      if (period) {
        const nextStart = new Date(period.end_date);
        nextStart.setDate(nextStart.getDate() + 1);
        const nextEnd = new Date(nextStart.getFullYear(), nextStart.getMonth() + 1, 0);
        await s.from('accounting_periods').upsert({
          period_year:  nextStart.getFullYear(),
          period_month: nextStart.getMonth() + 1,
          start_date:   nextStart.toISOString().slice(0, 10),
          end_date:     nextEnd.toISOString().slice(0, 10),
          status:       'open',
        }, { onConflict: 'period_year,period_month', ignoreDuplicates: true });
      }

      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: 'unknown action' }, { status: 400 });
  } catch (e) { return NextResponse.json({ error: String(e) }, { status: 500 }); }
}
