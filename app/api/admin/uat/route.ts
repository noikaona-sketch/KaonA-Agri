import { NextResponse }               from 'next/server';
import { createServerSupabaseClient } from '../../auth/line/line-auth-helpers';
import { requireAdminPermission, isForbidden } from '../members/_admin-auth';

export const dynamic = 'force-dynamic';

export async function GET() {
  const _ar = await requireAdminPermission('reports.read');
  if (isForbidden(_ar)) return _ar.forbidden;
  const { data } = await createServerSupabaseClient()
    .from('uat_results').select('*').order('updated_at', { ascending: false });
  return NextResponse.json({ results: data ?? [] });
}

export async function PATCH(request: Request) {
  try {
    const _ar = await requireAdminPermission('reports.read');
    if (isForbidden(_ar)) return _ar.forbidden;
    const body = (await request.json()) as { test_id:string; result:string; note?:string; tested_by?:string };
    if (!body.test_id || !body.result)
      return NextResponse.json({ error: 'test_id และ result จำเป็น' }, { status:400 });
    const { error } = await createServerSupabaseClient()
      .from('uat_results')
      .upsert({ test_id:body.test_id, result:body.result, note:body.note??null, tested_by:body.tested_by??null, tested_at: body.result!=='pending' ? new Date().toISOString() : null, updated_at:new Date().toISOString() }, { onConflict:'test_id' });
    if (error) return NextResponse.json({ error: error.message }, { status:500 });
    return NextResponse.json({ ok: true });
  } catch (e) { return NextResponse.json({ error:String(e) }, { status:500 }); }
}

export async function DELETE() {
  const _ar = await requireAdminPermission('admin_users.manage');
  if (isForbidden(_ar)) return _ar.forbidden;
  await createServerSupabaseClient().from('uat_results').delete().neq('test_id', '');
  return NextResponse.json({ ok: true });
}
