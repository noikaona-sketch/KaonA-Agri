import { NextResponse }               from 'next/server';
import { createServerSupabaseClient } from '../../auth/line/line-auth-helpers';
import { resolveApprovedMember }      from '../_auth';
import { sendLineMessage }            from '@/lib/line/push-message';

export const dynamic = 'force-dynamic';

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/member/farm-activity-alert
//
// Called after inserting a pest_found or disease_found log.
// Broadcasts alert to all approved members in the same province.
// Also inserts in-app notifications for those members.
//
// body: { log_id, activity_type, pest_name?, severity?, note?, plot_id? }
// ─────────────────────────────────────────────────────────────────────────────
export async function POST(request: Request) {
  try {
    const s      = createServerSupabaseClient();
    const caller = await resolveApprovedMember(request, s);
    if (!caller.ok) return caller.response;

    const body = (await request.json()) as {
      log_id:        string;
      activity_type: 'pest_found' | 'disease_found';
      pest_name?:    string | null;
      severity?:     'low' | 'medium' | 'high' | null;
      note?:         string | null;
      plot_id?:      string | null;
    };

    if (!body.log_id || !body.activity_type) {
      return NextResponse.json({ error: 'log_id และ activity_type จำเป็น' }, { status: 400 });
    }

    // ── Get reporter info + province ────────────────────────────────────────
    const { data: reporter } = await s
      .from('members').select('full_name, line_uid').eq('id', caller.memberId).single();

    // Get plot province if plot_id provided
    let province: string | null = null;
    if (body.plot_id) {
      const { data: plot } = await s.from('plots').select('province').eq('id', body.plot_id).maybeSingle();
      province = plot?.province ?? null;
    }
    // Fallback: get province from member's any plot
    if (!province) {
      const { data: anyPlot } = await s.from('plots')
        .select('province').eq('member_id', caller.memberId).is('deleted_at', null).limit(1).maybeSingle();
      province = anyPlot?.province ?? null;
    }

    // ── Build alert message ─────────────────────────────────────────────────
    const typeLabel = body.activity_type === 'pest_found' ? '🐛 พบแมลง' : '🍂 พบโรคพืช';
    const severityLabel: Record<string, string> = { low: 'น้อย', medium: 'ปานกลาง', high: 'มาก' };
    const sevText  = body.severity ? ` (ระดับ${severityLabel[body.severity]})` : '';
    const pestText = body.pest_name ? ` — ${body.pest_name}` : '';
    const noteText = body.note ? `\n📝 ${body.note}` : '';
    const areaText = province ? `\n📍 พื้นที่: ${province}` : '';

    const lineMsg = [
      `⚠️ แจ้งเตือน: ${typeLabel}${pestText}${sevText}`,
      `โดย: ${reporter?.full_name ?? 'สมาชิก'}${areaText}`,
      noteText,
      `\nตรวจสอบแปลงของคุณด้วยนะคะ`,
    ].filter(Boolean).join('\n');

    const notifTitle = `${typeLabel}${pestText}${sevText}`;
    const notifBody  = `แจ้งโดย ${reporter?.full_name ?? 'สมาชิก'}${province ? ` — ${province}` : ''}`;

    // ── Find members in same province ───────────────────────────────────────
    let memberQuery = s
      .from('members')
      .select('id, line_uid')
      .eq('status', 'approved')
      .neq('id', caller.memberId);  // don't alert self

    // Filter by province if available
    if (province) {
      // Members who have at least one plot in that province
      const { data: plotMembers } = await s
        .from('plots')
        .select('member_id')
        .eq('province', province)
        .is('deleted_at', null);
      const memberIds = [...new Set((plotMembers ?? []).map((p) => p.member_id as string))];
      if (memberIds.length > 0) {
        memberQuery = memberQuery.in('id', memberIds);
      } else {
        // No one in province — skip broadcast but mark alert_sent
        await s.from('farm_activity_logs').update({ alert_sent: true }).eq('id', body.log_id);
        return NextResponse.json({ ok: true, alerted: 0, province: province ?? null });
      }
    }

    const { data: targets } = await memberQuery.limit(200);
    if (!targets || targets.length === 0) {
      await s.from('farm_activity_logs').update({ alert_sent: true }).eq('id', body.log_id);
      return NextResponse.json({ ok: true, alerted: 0 });
    }

    // ── Send in-app notifications (batch insert) ────────────────────────────
    await s.from('notifications').insert(
      targets.map((m) => ({
        member_id: m.id,
        channel:   'in_app',
        title:     notifTitle,
        body:      notifBody,
      })),
    );

    // ── Send LINE push (best-effort, parallel) ──────────────────────────────
    let lineSent = 0;
    await Promise.allSettled(
      targets
        .filter((m) => m.line_uid)
        .map(async (m) => {
          const { ok } = await sendLineMessage(m.line_uid, [{ type: 'text', text: lineMsg }]);
          if (ok) lineSent++;
        }),
    );

    // ── Mark alert_sent ─────────────────────────────────────────────────────
    await s.from('farm_activity_logs').update({ alert_sent: true }).eq('id', body.log_id);

    return NextResponse.json({
      ok:         true,
      alerted:    targets.length,
      line_sent:  lineSent,
      province:   province ?? null,
    });
  } catch (e) {
    console.error('[FARM_ALERT]', e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
