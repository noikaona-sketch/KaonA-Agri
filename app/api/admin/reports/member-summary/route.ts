import { NextResponse }               from 'next/server';
import { createServerSupabaseClient } from '../../../auth/line/line-auth-helpers';
import { requireAdminPermission, isForbidden } from '../../members/_admin-auth';

export const dynamic = 'force-dynamic';

export async function GET() {
  const _ar = await requireAdminPermission('reports.read');
  if (isForbidden(_ar)) return _ar.forbidden;
  const s = createServerSupabaseClient();

  const [membersRes, recentRes] = await Promise.all([
    s.from('members').select('id,status,district,province,created_at'),
    s.from('members').select('id,full_name,phone,status,district,province,created_at')
      .order('created_at', { ascending:false }).limit(60),
  ]);

  const members = membersRes.data ?? [];
  const recent  = recentRes.data  ?? [];

  const now   = new Date();
  const day30 = new Date(now.getTime() - 30*86400_000).toISOString();
  const day7  = new Date(now.getTime() -  7*86400_000).toISOString();

  // สรุปตามสถานะ
  const byStatus = members.reduce((acc: Record<string,number>, m) => {
    const st = m.status as string ?? 'unknown';
    acc[st] = (acc[st] ?? 0) + 1;
    return acc;
  }, {});

  // สมาชิกใหม่ต่อสัปดาห์ (12 สัปดาห์ย้อนหลัง)
  const weeklyNew: { week: string; count: number }[] = [];
  for (let w = 11; w >= 0; w--) {
    const wStart = new Date(now.getTime() - (w+1)*7*86400_000);
    const wEnd   = new Date(now.getTime() -  w   *7*86400_000);
    weeklyNew.push({
      week:  wStart.toLocaleDateString('th-TH', { day:'numeric', month:'short' }),
      count: members.filter(m => m.created_at >= wStart.toISOString() && m.created_at < wEnd.toISOString()).length,
    });
  }

  // ตามอำเภอ
  const byDistrict: Record<string,number> = {};
  members.filter(m => m.status === 'approved').forEach(m => {
    const d = m.district as string ?? 'ไม่ระบุ';
    byDistrict[d] = (byDistrict[d] ?? 0) + 1;
  });

  return NextResponse.json({
    summary: {
      total:    members.length,
      approved: byStatus['approved'] ?? 0,
      pending:  byStatus['pending']  ?? 0,
      rejected: byStatus['rejected'] ?? 0,
      new_30d:  members.filter(m => m.created_at >= day30).length,
      new_7d:   members.filter(m => m.created_at >= day7).length,
    },
    by_status:   byStatus,
    weekly_new:  weeklyNew,
    by_district: Object.entries(byDistrict).sort((a,b) => b[1]-a[1]).slice(0,10).map(([d,c]) => ({ district:d, count:c })),
    recent,
  });
}
