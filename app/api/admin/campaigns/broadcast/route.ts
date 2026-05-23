import { NextResponse }               from 'next/server';
import { createServerSupabaseClient } from '../../../auth/line/line-auth-helpers';
import { requireAdminPermission, isForbidden } from '../../members/_admin-auth';
import { sendLineMessage }            from '@/lib/line/push-message';

export const dynamic = 'force-dynamic';

// POST /api/admin/campaigns/broadcast
// body: { message, target: 'all'|'by_group'|'by_district', group_ids?, district? }
export async function POST(request: Request) {
  try {
    const _ar = await requireAdminPermission('members.write');
    if (isForbidden(_ar)) return _ar.forbidden;

    const body = (await request.json()) as {
      message   : string
      target    : 'all' | 'by_group' | 'by_district'
      group_ids?: string[]
      district? : string
    };

    if (!body.message?.trim()) return NextResponse.json({ error: 'message จำเป็น' }, { status: 400 });

    const s = createServerSupabaseClient();
    let memberIds: string[] = [];

    if (body.target === 'all') {
      const { data } = await s.from('members').select('id').eq('status', 'approved');
      memberIds = (data ?? []).map(m => m.id as string);
    } else if (body.target === 'by_district' && body.district) {
      const { data } = await s.from('members').select('id').eq('status', 'approved').eq('district', body.district);
      memberIds = (data ?? []).map(m => m.id as string);
    } else if (body.target === 'by_group' && body.group_ids?.length) {
      const { data } = await s.from('member_group_members')
        .select('member_id').in('group_id', body.group_ids);
      memberIds = (data ?? []).map(m => m.member_id as string);
    } else {
      return NextResponse.json({ error: 'target และ filter จำเป็น' }, { status: 400 });
    }

    if (!memberIds.length) return NextResponse.json({ ok:true, sent:0, failed:0, skipped:0 });

    // ดึง line_uid
    const { data: members } = await s.from('members')
      .select('id,line_uid').in('id', memberIds);

    const withLine = (members ?? []).filter(m => m.line_uid);
    const skipped  = memberIds.length - withLine.length;

    let sent = 0; let failed = 0;
    // ส่งทีละคน — rate limit 1 req/sec
    for (const m of withLine) {
      try {
        const res = await sendLineMessage(m.line_uid as string, [{ type:'text', text:body.message }]);
        if (res.ok) sent++; else failed++;
      } catch { failed++; }
      // delay 100ms ป้องกัน rate limit
      await new Promise(r => setTimeout(r, 100));
    }

    // บันทึก notification log
    await s.from('notifications').insert({
      title:   `Broadcast: ${body.message.slice(0, 50)}`,
      body:    body.message,
      type:    'broadcast',
      sent_to: memberIds.length,
    }).select('id');

    return NextResponse.json({ ok:true, sent, failed, skipped, total: memberIds.length });
  } catch (e) { return NextResponse.json({ error: String(e) }, { status: 500 }); }
}
