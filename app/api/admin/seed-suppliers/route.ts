import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '../../auth/line/line-auth-helpers';
import { requireAdminPermission, isForbidden } from '../../members/_admin-auth';

export async function GET() {
  const _ar_get = await requireAdminPermission('seed.read');
  if (isForbidden(_ar_get)) return _ar_get.forbidden;
  const s = createServerSupabaseClient();
  const { data, error } = await s.from('seed_suppliers').select('*').order('supplier_name');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ suppliers: data ?? [] });
}

export async function POST(request: Request) {
  try {
  const _ar_post = await requireAdminPermission('seed.write');
  if (isForbidden(_ar_post)) return _ar_post.forbidden;

    const body = (await request.json()) as Record<string, unknown>;
    const { id, ...payload } = body;
    const s = createServerSupabaseClient();
    const q = id
      ? s.from('seed_suppliers').update(payload).eq('id', id)
      : s.from('seed_suppliers').insert(payload);
    const { error } = await q;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (e) { return NextResponse.json({ error: String(e) }, { status: 500 }); }
}

export async function DELETE(request: Request) {
  try {
  const _ar_delete = await requireAdminPermission('seed.write');
  if (isForbidden(_ar_delete)) return _ar_delete.forbidden;

    const { id } = (await request.json()) as { id: string };
    const s = createServerSupabaseClient();
    const { error } = await s.from('seed_suppliers').delete().eq('id', id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (e) { return NextResponse.json({ error: String(e) }, { status: 500 }); }
}
