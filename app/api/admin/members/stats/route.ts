import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '../../../auth/line/line-auth-helpers';
import { requireAdmin } from '../_admin-auth';

export const dynamic = 'force-dynamic';

export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const s = createServerSupabaseClient();

  const [membersRes, rolesRes, groupsRes] = await Promise.all([
    s.from('members').select('id,status'),
    s.from('member_roles').select('role,member_id'),
    s.from('member_groups').select('id', { count:'exact', head:true }),
  ]);

  const members = membersRes.data ?? [];
  const roles   = rolesRes.data  ?? [];
  const groups  = groupsRes.count ?? 0;

  // นับตาม status
  const byStatus = members.reduce((acc: Record<string,number>, m) => {
    acc[m.status as string] = (acc[m.status as string] ?? 0) + 1;
    return acc;
  }, {});

  // นับตาม role (unique members per role)
  const byRole = roles.reduce((acc: Record<string,number>, r) => {
    acc[r.role as string] = (acc[r.role as string] ?? 0) + 1;
    return acc;
  }, {});

  return NextResponse.json({
    total:     members.length,
    approved:  byStatus['approved']  ?? 0,
    pending:   byStatus['pending']   ?? 0,
    rejected:  byStatus['rejected']  ?? 0,
    suspended: byStatus['suspended'] ?? 0,
    by_role:   byRole,
    groups,
  });
}
