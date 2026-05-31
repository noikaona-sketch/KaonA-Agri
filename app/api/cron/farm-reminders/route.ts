import { NextResponse }               from 'next/server';
import { createServerSupabaseClient } from '../../auth/line/line-auth-helpers';
import { sendLineMessage }            from '@/lib/line/push-message';

export const dynamic = 'force-dynamic';

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/cron/farm-reminders
// เรียกโดย Vercel Cron ทุกวัน 08:00 ICT (01:00 UTC)
// หา farm_activity_logs ที่ reminder_due_at ถึงกำหนดวันนี้/พรุ่งนี้
// และยังไม่ได้บันทึก (is_scheduled=true, recorded_at=NULL) + reminder_sent=false
// ─────────────────────────────────────────────────────────────────────────────
export async function GET(request: Request) {
  // Security: Vercel cron sends CRON_SECRET as Bearer
  const auth = request.headers.get('Authorization') ?? '';
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && auth !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const s   = createServerSupabaseClient();
  const now = new Date();

  // Window: วันนี้ + พรุ่งนี้ (warning_days = 1 เป็นค่า default)
  const todayStart = new Date(now); todayStart.setHours(0,0,0,0);
  const tomorrowEnd = new Date(now); tomorrowEnd.setDate(tomorrowEnd.getDate()+2); tomorrowEnd.setHours(0,0,0,0);

  // หา planting_cycles ที่ active และมี planted_at
  const { data: cycles, error: cycleErr } = await s
    .from('planting_cycles')
    .select(`
      id, crop_name, planted_at, member_id,
      members!planting_cycles_member_id_fkey(id, line_uid, full_name)
    `)
    .not('status', 'in', '(harvested,cancelled)')
    .not('planted_at', 'is', null);

  if (cycleErr || !cycles?.length) {
    return NextResponse.json({ ok: true, sent: 0, reason: cycleErr?.message ?? 'no active cycles' });
  }

  // หา care_defaults ทุกพันธุ์ (cache)
  const { data: defaults } = await s
    .from('crop_care_defaults')
    .select('crop_type, care_schedule');

  const defaultsMap = Object.fromEntries(
    (defaults ?? []).map(d => [d.crop_type, d.care_schedule as {
      day: number; activity: string; label: string; icon: string;
      note?: string; warning_days?: number;
    }[]])
  );

  let sent = 0;
  const results: string[] = [];

  for (const cycle of cycles as unknown as {
    id: string; crop_name: string; planted_at: string; member_id: string;
    members: { id: string; line_uid: string | null; full_name: string }[] | null;
  }[]) {
    const member   = cycle.members?.[0];
    if (!member?.line_uid) continue;

    const plantedAt   = new Date(cycle.planted_at);
    const schedItems  = defaultsMap[cycle.crop_name] ?? [];

    for (const item of schedItems) {
      const dueDate = new Date(plantedAt);
      dueDate.setDate(dueDate.getDate() + item.day);

      const warningDays = item.warning_days ?? 1;
      const notifyFrom  = new Date(dueDate);
      notifyFrom.setDate(notifyFrom.getDate() - warningDays);

      // ถึงช่วงแจ้งเตือนไหม?
      if (notifyFrom > tomorrowEnd || dueDate < todayStart) continue;

      // ตรวจว่า log นี้ถูกบันทึกแล้วหรือยัง
      const { data: existing } = await s
        .from('farm_activity_logs')
        .select('id')
        .eq('planting_cycle_id', cycle.id)
        .eq('scheduled_day', item.day)
        .maybeSingle();

      if (existing) continue; // ทำแล้ว ไม่แจ้ง

      // ตรวจว่าเคยส่ง reminder วันนี้ไปแล้วไหม (ผ่าน notifications table)
      const { data: notifExist } = await s
        .from('notifications')
        .select('id')
        .eq('member_id', member.id)
        .like('title', `%D${item.day}%`)
        .gte('created_at', todayStart.toISOString())
        .maybeSingle();

      if (notifExist) continue;

      // คำนวณว่าเหลือกี่วัน
      const daysLeft = Math.round((dueDate.getTime() - now.getTime()) / 86400000);
      const timeText = daysLeft === 0 ? 'วันนี้'
                     : daysLeft > 0  ? `อีก ${daysLeft} วัน (${dueDate.toLocaleDateString('th-TH', { day:'numeric', month:'short' })})`
                     : `เลยกำหนด ${Math.abs(daysLeft)} วัน`;

      const msgText = [
        `${item.icon} แจ้งเตือน: ${item.label}`,
        `🌱 ${cycle.crop_name} — ${timeText}`,
        item.note ? `📋 ${item.note}` : '',
        `\nเปิดแอป KaonA เพื่อบันทึกกิจกรรมค่ะ`,
      ].filter(Boolean).join('\n');

      // ส่ง LINE
      const { ok: lineOk } = await sendLineMessage(member.line_uid, [{ type: 'text', text: msgText }]);

      // บันทึก in-app notification ด้วย
      await s.from('notifications').insert({
        member_id: member.id,
        channel:   'in_app',
        title:     `${item.icon} ${item.label} (D${item.day})`,
        body:      `${cycle.crop_name} — ${timeText}`,
      });

      if (lineOk) {
        sent++;
        results.push(`${member.full_name} → D${item.day} ${item.label}`);
      }
    }
  }

  return NextResponse.json({ ok: true, sent, results, checkedCycles: cycles.length });
}
