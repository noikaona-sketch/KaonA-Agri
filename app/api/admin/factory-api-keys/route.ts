import { NextResponse }               from 'next/server';
import { createServerSupabaseClient } from '../../auth/line/line-auth-helpers';
import { requireAdminPermission, isForbidden } from '../members/_admin-auth';
import { generateApiKey }             from '@/lib/intake/verify-factory-key';

export const dynamic = 'force-dynamic';

export async function GET() {
  const _ar = await requireAdminPermission('service.read');
  if (isForbidden(_ar)) return _ar.forbidden;
  const { data, error } = await createServerSupabaseClient()
    .from('factory_api_keys')
    .select('id,name,location_id,is_active,last_used_at,created_at,pickup_locations(name)')
    .order('created_at', { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ keys: data ?? [] });
}

export async function POST(request: Request) {
  try {
    const _ar = await requireAdminPermission('service.write');
    if (isForbidden(_ar)) return _ar.forbidden;
    const { name, location_id } = (await request.json()) as { name: string; location_id: string };
    if (!name || !location_id)
      return NextResponse.json({ error: 'name และ location_id จำเป็น' }, { status: 400 });
    const { raw_key, key_hash } = generateApiKey();
    const { error } = await createServerSupabaseClient()
      .from('factory_api_keys')
      .insert({ name, location_id, key_hash, is_active: true });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    // คืน raw_key ครั้งเดียว — ไม่เก็บในระบบ
    return NextResponse.json({ ok: true, raw_key, warning: 'บันทึก key นี้ไว้ จะไม่แสดงอีก' }, { status: 201 });
  } catch (e) { return NextResponse.json({ error: String(e) }, { status: 500 }); }
}

export async function DELETE(request: Request) {
  const _ar = await requireAdminPermission('service.write');
  if (isForbidden(_ar)) return _ar.forbidden;
  const { id } = (await request.json()) as { id: string };
  if (!id) return NextResponse.json({ error: 'id จำเป็น' }, { status: 400 });
  const { error } = await createServerSupabaseClient()
    .from('factory_api_keys').update({ is_active: false }).eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
