import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '../../auth/line/line-auth-helpers';
import { requireAdminPermission, isForbidden } from '../members/_admin-auth';

export async function GET() {
  try {
    const _ar_get = await requireAdminPermission('members.read');
    if (isForbidden(_ar_get)) return _ar_get.forbidden;

    const s = createServerSupabaseClient();
    const { data, error } = await s
      .from('member_groups')
      .select(`
        id, name, description, created_at,
        created_by_member:members!member_groups_created_by_fkey(full_name),
        member_group_members(count)
      `)
      .is('deleted_at', null)
      .order('created_at', { ascending: false });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ groups: data ?? [] });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const _ar_post = await requireAdminPermission('members.write');
    if (isForbidden(_ar_post)) return _ar_post.forbidden;

    const body = (await request.json()) as { name?: string; description?: string; created_by?: string };
    if (!body.name?.trim()) {
      return NextResponse.json({ error: 'ต้องการชื่อกลุ่ม' }, { status: 400 });
    }
    const s = createServerSupabaseClient();
    const { data, error } = await s.from('member_groups')
      .insert({ name: body.name.trim(), description: body.description ?? null })
      .select('id, name').single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, group: data });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
