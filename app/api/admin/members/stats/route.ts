import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '../../../auth/line/line-auth-helpers';
import { requireAdmin } from '../_admin-auth';

export const dynamic = 'force-dynamic';

export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const s = createServerSupabaseClient();

  const [membersRes, rolesRes, groupsRes, bookingsRes, noBurnRes, cyclesRes] = await Promise.all([
    s.from('members').select('id,status'),
    s.from('member_roles').select('role,member_id'),
    s.from('member_groups').select(`
      id, name,
      member_group_members(
        is_leader,
        member:member_id(id, full_name, status)
      )
    `),
    s.from('harvest_bookings').select('member_id,status'),
    s.from('no_burn_requests').select('member_id,status'),
    s.from('planting_cycles').select('member_id,status'),
  ]);

  const members  = membersRes.data ?? [];
  const roles    = rolesRes.data   ?? [];
  const groups   = groupsRes.data  ?? [];
  const bookings = bookingsRes.data ?? [];
  const noburns  = noBurnRes.data  ?? [];
  const cycles   = cyclesRes.data  ?? [];

  // status summary
  const byStatus = members.reduce((acc: Record<string,number>, m) => {
    acc[m.status as string] = (acc[m.status as string] ?? 0) + 1;
    return acc;
  }, {});

  // role summary — unique members per role + booking/cycle/noburn counts
  const byRole: Record<string, {
    count:number; approved:number; hasBooking:number; hasCycle:number; hasNoburn:number;
  }> = {};

  for (const r of roles) {
    if (!byRole[r.role]) byRole[r.role] = { count:0, approved:0, hasBooking:0, hasCycle:0, hasNoburn:0 };
    byRole[r.role].count++;
    const m = members.find(x => x.id === r.member_id);
    if (m?.status === 'approved') byRole[r.role].approved++;
    if (bookings.some(b => b.member_id === r.member_id)) byRole[r.role].hasBooking++;
    if (cycles.some(c => c.member_id === r.member_id))   byRole[r.role].hasCycle++;
    if (noburns.some(n => n.member_id === r.member_id))  byRole[r.role].hasNoburn++;
  }

  // group summary
  const groupSummary = groups.map(g => {
    const gMembers = (g.member_group_members as unknown as {
      is_leader: boolean;
      member: { id:string; full_name:string; status:string } | null;
    }[]);
    const leader = gMembers.find(m => m.is_leader)?.member;
    const memberIds = gMembers.map(m => m.member?.id).filter(Boolean) as string[];
    return {
      id:          g.id,
      name:        g.name,
      memberCount: memberIds.length,
      leader:      leader ? { id:leader.id, full_name:leader.full_name } : null,
      hasBooking:  bookings.filter(b => memberIds.includes(b.member_id)).length,
      hasCycle:    cycles.filter(c => memberIds.includes(c.member_id)).length,
      hasNoburn:   noburns.filter(n => memberIds.includes(n.member_id)).length,
    };
  });

  return NextResponse.json({
    total:     members.length,
    approved:  byStatus['approved']  ?? 0,
    pending:   byStatus['pending']   ?? 0,
    rejected:  byStatus['rejected']  ?? 0,
    suspended: byStatus['suspended'] ?? 0,
    by_role:   byRole,
    groups:    groups.length,
    groupSummary,
  });
}
