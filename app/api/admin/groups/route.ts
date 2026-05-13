import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '../../auth/line/line-auth-helpers';

export async function GET() {
  try {
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
    const body = (await request.json()) as { name?: string; description?: string; created_by?: string };
    if (!body.name?.trim() || !body.created_by) {
      return NextResponse.json({ error: 'ต้องการชื่อกลุ่มและ created_by' }, { status: 400 });
    }
    const s = createServerSupabaseClient();
    const { data, error } = await s.from('member_groups')
      .insert({ name: body.name.trim(), description: body.description ?? null, created_by: body.created_by })
      .select('id, name').single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, group: data });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
