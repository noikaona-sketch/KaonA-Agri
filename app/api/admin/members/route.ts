import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '../../auth/line/line-auth-helpers';
import { requireAdminPermission, isForbidden } from '../../members/_admin-auth';

export async function GET(request: Request) {
  try {
  const _ar_get = await requireAdminPermission('members.read');
  if (isForbidden(_ar_get)) return _ar_get.forbidden;

    const url    = new URL(request.url);
    const search = url.searchParams.get('q') ?? url.searchParams.get('search') ?? '';
    const limit  = Math.min(Number(url.searchParams.get('limit') ?? '20'), 50);
    const status = url.searchParams.get('status') ?? '';

    const s = createServerSupabaseClient();
    let q = s.from('members')
      .select('id, full_name, phone, status, citizen_id_masked, created_at')
      .order('full_name')
      .limit(limit);

    if (search) {
      q = q.or(`full_name.ilike.*${search}*,phone.ilike.*${search}*,citizen_id_masked.ilike.*${search}*`);
    }
    if (status) {
      q = q.eq('status', status);
    }

    const { data, error } = await q;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ members: data ?? [] });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
