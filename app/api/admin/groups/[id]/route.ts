import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '../../../auth/line/line-auth-helpers';
import { requireAdminPermission, isForbidden } from '../../../members/_admin-auth';

type Params = { params: { id: string } };

export async function GET(_req: Request, { params }: Params) {
  try {
  const _ar_get = await requireAdminPermission('members.read');
  if (isForbidden(_ar_get)) return _ar_get.forbidden;

    const s = createServerSupabaseClient();
    const { data, error } = await s
      .from('member_groups')
      .select(`
        id, name, description, created_at,
        member_group_members(
          id, created_at,
          members(id, full_name, phone, status)
        )
      `)
      .eq('id', params.id)
      .is('deleted_at', null)
      .maybeSingle();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!data)  return NextResponse.json({ error: 'ไม่พบกลุ่ม' }, { status: 404 });
    return NextResponse.json({ group: data });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function PATCH(request: Request, { params }: Params) {
  try {
  const _ar_patch = await requireAdminPermission('members.write');
  if (isForbidden(_ar_patch)) return _ar_patch.forbidden;

    const body = (await request.json()) as { name?: string; description?: string };
    const s = createServerSupabaseClient();
    const { error } = await s.from('member_groups')
      .update({ name: body.name?.trim(), description: body.description ?? null, updated_at: new Date().toISOString() })
      .eq('id', params.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: Params) {
  try {
  const _ar_delete = await requireAdminPermission('members.write');
  if (isForbidden(_ar_delete)) return _ar_delete.forbidden;

    const s = createServerSupabaseClient();
    const { error } = await s.from('member_groups')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', params.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
