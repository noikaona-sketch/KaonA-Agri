import { NextResponse }               from 'next/server';
import { createServerSupabaseClient } from '../../../auth/line/line-auth-helpers';
import { requireAdmin }               from '../../members/_admin-auth';

export const dynamic = 'force-dynamic';

export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const s = createServerSupabaseClient();

  // ดึงกลุ่มพร้อมสมาชิก
  const { data: groups, error } = await s
    .from('member_groups')
    .select(`
      id, name, description, created_at,
      member_group_members(
        is_leader,
        member:member_id(id, full_name, phone, status)
      )
    `)
    .order('created_at', { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!groups?.length) return NextResponse.json({ groups: [] });

  const memberIds = [...new Set(
    groups.flatMap(g =>
      (g.member_group_members as unknown as { member: { id:string }|null }[])
        .map(m => m.member?.id).filter(Boolean) as string[]
    )
  )];

  // ดึงข้อมูล seed + plots พร้อมกัน
  const [seedRes, plotsRes] = await Promise.all([
    memberIds.length
      ? s.from('seed_reservations')
          .select('member_id, qty_reserved, status')
          .in('member_id', memberIds)
          .neq('status', 'cancelled')
      : Promise.resolve({ data: [] }),
    memberIds.length
      ? s.from('plots')
          .select('member_id, area_rai')
          .in('member_id', memberIds)
      : Promise.resolve({ data: [] }),
  ]);

  const seeds = (seedRes.data ?? []) as { member_id:string; qty_reserved:number; status:string }[];
  const plots = (plotsRes.data ?? []) as { member_id:string; area_rai:number }[];

  const result = (groups ?? []).map(g => {
    const gMembers = (g.member_group_members as unknown as {
      is_leader: boolean;
      member: { id:string; full_name:string; phone:string|null; status:string } | null;
    }[]);
    const leader    = gMembers.find(m => m.is_leader)?.member ?? null;
    const memberIds = gMembers.map(m => m.member?.id).filter(Boolean) as string[];

    const totalSeedKg  = seeds.filter(s => memberIds.includes(s.member_id)).reduce((acc, s) => acc + Number(s.qty_reserved), 0);
    const totalAreaRai = plots.filter(p => memberIds.includes(p.member_id)).reduce((acc, p) => acc + Number(p.area_rai), 0);

    return {
      id:          g.id,
      name:        g.name,
      description: g.description,
      created_at:  g.created_at,
      memberCount: memberIds.length,
      leader,
      totalSeedKg,
      totalAreaRai,
      members: gMembers.map(m => ({
        id:        m.member?.id ?? '',
        full_name: m.member?.full_name ?? '—',
        phone:     m.member?.phone ?? null,
        status:    m.member?.status ?? '',
        is_leader: m.is_leader,
        seedKg:    seeds.filter(s => s.member_id === m.member?.id).reduce((a,s) => a+Number(s.qty_reserved), 0),
        areaRai:   plots.filter(p => p.member_id === m.member?.id).reduce((a,p) => a+Number(p.area_rai), 0),
      })),
    };
  });

  return NextResponse.json({ groups: result });
}
