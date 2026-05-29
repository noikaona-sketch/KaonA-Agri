import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '../../auth/line/line-auth-helpers';
import { requireAdminPermission, isForbidden } from '../members/_admin-auth';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function memberActorId(s: ReturnType<typeof createServerSupabaseClient>, adminUserId: string) {
  if (!UUID_RE.test(adminUserId)) return null;
  const { data } = await s.from('members').select('id').eq('id', adminUserId).maybeSingle();
  return data?.id ?? null;
}

export async function GET() {
  const _ar_get = await requireAdminPermission('service.read');
  if (isForbidden(_ar_get)) return _ar_get.forbidden;
  const s = createServerSupabaseClient();
  const [{ data: periods }, { data: events }] = await Promise.all([
    s.from('accounting_periods').select('*').order('start_date', { ascending: false }).limit(24),
    s.from('accounting_period_events').select('*').order('created_at', { ascending: false }).limit(100),
  ]);
  return NextResponse.json({ periods: periods ?? [], events: events ?? [] });
}

export async function POST(request: Request) {
  try {
    const _ar_post = await requireAdminPermission('admin_users.manage');
    if (isForbidden(_ar_post)) return _ar_post.forbidden;

    const body = (await request.json()) as {
      action: 'close' | 'reopen' | 'cancel_close';
      id?: string;
      note?: string;
      reason?: string;
      closed_by?: string;
    };
    if (!body.id) return NextResponse.json({ error: 'period id required' }, { status: 400 });

    const s = createServerSupabaseClient();
    const reason = (body.reason ?? body.note ?? '').trim() || null;
    if (!reason) return NextResponse.json({ error: 'กรุณาระบุเหตุผล/หมายเหตุ' }, { status: 400 });
    const actorId = body.closed_by && UUID_RE.test(body.closed_by)
      ? await memberActorId(s, body.closed_by)
      : await memberActorId(s, _ar_post.admin.adminUserId);

    const { data: period, error: periodErr } = await s
      .from('accounting_periods')
      .select('id,status,start_date,end_date')
      .eq('id', body.id)
      .single();
    if (periodErr || !period) {
      return NextResponse.json({ error: periodErr?.message ?? 'period not found' }, { status: 404 });
    }

    if (body.action === 'close') {
      if (period.status === 'closed') return NextResponse.json({ error: 'งวดนี้ปิดแล้ว' }, { status: 400 });

      const { data: open } = await s.from('cashier_sessions').select('id').eq('status', 'open').limit(1);
      if ((open ?? []).length > 0) {
        return NextResponse.json({ error: 'ยังมีรอบแคชเชียร์ที่ยังไม่ปิด' }, { status: 400 });
      }

      const now = new Date().toISOString();
      const { error: lockErr } = await s
        .from('stock_movements')
        .update({ is_locked: true, period_id: body.id })
        .gte('created_at', `${period.start_date}T00:00:00+07:00`)
        .lte('created_at', `${period.end_date}T23:59:59+07:00`);
      if (lockErr) return NextResponse.json({ error: lockErr.message }, { status: 500 });

      const { error } = await s.from('accounting_periods').update({
        status: 'closed',
        closed_at: now,
        closed_by: actorId,
        note: reason,
        reason,
        close_reason: reason,
        closed_by_admin: UUID_RE.test(_ar_post.admin.adminUserId) ? _ar_post.admin.adminUserId : null,
      }).eq('id', body.id);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });

      await s.from('accounting_period_events').insert({
        period_id: body.id,
        action: 'close',
        actor_id: actorId,
        actor_admin_id: UUID_RE.test(_ar_post.admin.adminUserId) ? _ar_post.admin.adminUserId : null,
        reason,
        previous_status: period.status,
        new_status: 'closed',
      });

      const nextStart = new Date(`${period.end_date}T00:00:00Z`);
      nextStart.setUTCDate(nextStart.getUTCDate() + 1);
      const nextEnd = new Date(Date.UTC(nextStart.getUTCFullYear(), nextStart.getUTCMonth() + 1, 0));
      await s.from('accounting_periods').upsert({
        period_year: nextStart.getUTCFullYear(),
        period_month: nextStart.getUTCMonth() + 1,
        start_date: nextStart.toISOString().slice(0, 10),
        end_date: nextEnd.toISOString().slice(0, 10),
        status: 'open',
      }, { onConflict: 'period_year,period_month', ignoreDuplicates: true });

      return NextResponse.json({ ok: true });
    }

    if (body.action === 'reopen') {
      if (period.status !== 'closed') return NextResponse.json({ error: 'เปิดงวดใหม่ได้เฉพาะงวดที่ปิดแล้ว' }, { status: 400 });
      const now = new Date().toISOString();
      const { error } = await s.from('accounting_periods').update({
        status: 'review',
        reopened_at: now,
        reopened_by: actorId,
        reason,
        reopen_reason: reason,
        reopened_by_admin: UUID_RE.test(_ar_post.admin.adminUserId) ? _ar_post.admin.adminUserId : null,
      }).eq('id', body.id);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });

      await s
        .from('stock_movements')
        .update({ is_locked: false })
        .eq('period_id', body.id);

      await s.from('accounting_period_events').insert({
        period_id: body.id,
        action: 'reopen',
        actor_id: actorId,
        actor_admin_id: UUID_RE.test(_ar_post.admin.adminUserId) ? _ar_post.admin.adminUserId : null,
        reason,
        previous_status: period.status,
        new_status: 'review',
      });
      return NextResponse.json({ ok: true });
    }

    if (body.action === 'cancel_close') {
      if (!['closing', 'closed'].includes(period.status)) return NextResponse.json({ error: 'ยกเลิกปิดงวดได้เฉพาะงวดที่กำลังปิดหรือปิดแล้ว' }, { status: 400 });
      const now = new Date().toISOString();
      const { error } = await s.from('accounting_periods').update({
        status: 'review',
        reopened_at: period.status === 'closed' ? now : null,
        reopened_by: period.status === 'closed' ? actorId : null,
        reason,
        reopen_reason: reason,
        reopened_by_admin: period.status === 'closed' && UUID_RE.test(_ar_post.admin.adminUserId) ? _ar_post.admin.adminUserId : null,
      }).eq('id', body.id);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });

      await s
        .from('stock_movements')
        .update({ is_locked: false })
        .eq('period_id', body.id);

      await s.from('accounting_period_events').insert({
        period_id: body.id,
        action: 'cancel_close',
        actor_id: actorId,
        actor_admin_id: UUID_RE.test(_ar_post.admin.adminUserId) ? _ar_post.admin.adminUserId : null,
        reason,
        previous_status: period.status,
        new_status: 'review',
      });
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: 'unknown action' }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
