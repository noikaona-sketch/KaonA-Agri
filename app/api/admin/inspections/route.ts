import { NextResponse }               from 'next/server';
import { createServerSupabaseClient } from '../../auth/line/line-auth-helpers';
import { requireAdminPermission, isForbidden } from '../members/_admin-auth';

export const dynamic = 'force-dynamic';

// GET /api/admin/inspections?status=pending&limit=50
export async function GET(request: Request) {
  const _ar = await requireAdminPermission('field.read');
  if (isForbidden(_ar)) return _ar.forbidden;
  const url    = new URL(request.url);
  const status = url.searchParams.get('status');
  const s      = createServerSupabaseClient();

  let q = s.from('inspections')
    .select(`id, result_status, assigned_at, visited_at,
      inspector_member_id,
      no_burn_request_id,
      plot_id,
      plots!inspections_plot_id_fkey(name, province, district, subdistrict),
      inspector:members!inspections_inspector_member_id_fkey(full_name, phone)`)
    .order('created_at', { ascending: false })
    .limit(100);
  if (status) q = q.eq('result_status', status);

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // inspectors list
  const { data: inspectors } = await s
    .from('member_roles')
    .select('member_id, members!member_roles_member_id_fkey(id, full_name, phone)')
    .eq('role', 'inspector');

  return NextResponse.json({ inspections: data ?? [], inspectors: inspectors ?? [] });
}
