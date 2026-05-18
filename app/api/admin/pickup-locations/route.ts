import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '../../auth/line/line-auth-helpers';
import { requireAdminPermission, isForbidden } from '../members/_admin-auth';

export async function GET() {
  const _ar_get = await requireAdminPermission('service.read');
  if (isForbidden(_ar_get)) return _ar_get.forbidden;
  const s = createServerSupabaseClient();
  const { data } = await s.from('pickup_locations').select('*').eq('active', true).order('name');
  return NextResponse.json({ locations: data ?? [] });
}

export async function POST(request: Request) {
  try {
    const _ar_post = await requireAdminPermission('service.write');
    if (isForbidden(_ar_post)) return _ar_post.forbidden;

    const body = (await request.json()) as { id?: string; name: string; address?: string; map_url?: string; active?: boolean };
    const s = createServerSupabaseClient();
    const { id, ...payload } = body;
    const { error } = id
      ? await s.from('pickup_locations').update(payload).eq('id', id)
      : await s.from('pickup_locations').insert(payload);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (e) { return NextResponse.json({ error: String(e) }, { status: 500 }); }
}
