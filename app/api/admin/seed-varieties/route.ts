import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '../../auth/line/line-auth-helpers';

export async function GET() {
  const s = createServerSupabaseClient();
  const [varieties, suppliers] = await Promise.all([
    s.from('seed_varieties').select('*').order('sort_order').order('variety_name'),
    s.from('seed_suppliers').select('id, supplier_name').order('supplier_name'),
  ]);
  return NextResponse.json({ varieties: varieties.data ?? [], suppliers: suppliers.data ?? [] });
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const { id, ...payload } = body;
    const s = createServerSupabaseClient();
    const q = id
      ? s.from('seed_varieties').update(payload).eq('id', id)
      : s.from('seed_varieties').insert(payload);
    const { error } = await q;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (e) { return NextResponse.json({ error: String(e) }, { status: 500 }); }
}

export async function DELETE(request: Request) {
  try {
    const { id } = (await request.json()) as { id: string };
    const s = createServerSupabaseClient();
    const { error } = await s.from('seed_varieties').update({ active_status: 'inactive' }).eq('id', id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (e) { return NextResponse.json({ error: String(e) }, { status: 500 }); }
}
