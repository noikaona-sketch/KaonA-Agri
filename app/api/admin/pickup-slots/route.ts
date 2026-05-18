import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '../../auth/line/line-auth-helpers';
import { requireAdminPermission, isForbidden } from '../members/_admin-auth';

export async function GET() {
  const _ar_get = await requireAdminPermission('service.read');
  if (isForbidden(_ar_get)) return _ar_get.forbidden;
  const s = createServerSupabaseClient();
  const [slots, locations] = await Promise.all([
    s.from('pickup_slots')
      .select('*, pickup_locations(name, address)')
      .order('pickup_date').limit(100),
    s.from('pickup_locations').select('*').eq('active', true).order('name'),
  ]);
  return NextResponse.json({ slots: slots.data ?? [], locations: locations.data ?? [] });
}

export async function POST(request: Request) {
  try {
    const _ar_post = await requireAdminPermission('service.write');
    if (isForbidden(_ar_post)) return _ar_post.forbidden;

    const body = (await request.json()) as Record<string, unknown>;
    const { id, action, ...payload } = body as { id?: string; action?: string } & Record<string, unknown>;
    const s = createServerSupabaseClient();

    // close/reopen slot
    if (action === 'close' && id) {
      await s.from('pickup_slots').update({ status: 'closed' }).eq('id', id);
      return NextResponse.json({ ok: true });
    }
    if (action === 'open' && id) {
      await s.from('pickup_slots').update({ status: 'open' }).eq('id', id);
      return NextResponse.json({ ok: true });
    }

    // create/update
    const { error } = id
      ? await s.from('pickup_slots').update(payload).eq('id', id)
      : await s.from('pickup_slots').insert(payload);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (e) { return NextResponse.json({ error: String(e) }, { status: 500 }); }
}
