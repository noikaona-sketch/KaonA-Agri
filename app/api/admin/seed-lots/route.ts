import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '../../auth/line/line-auth-helpers';

export async function GET() {
  const s = createServerSupabaseClient();
  const [lots, suppliers, varieties] = await Promise.all([
    s.from('admin_seed_lot_status').select('*').order('received_date', { ascending: false }),
    s.from('seed_suppliers').select('id,supplier_name').eq('active_status','active').order('supplier_name'),
    s.from('seed_varieties').select('id,variety_name,supplier_id,bag_weight_kg,price_per_bag,crop_type').eq('active_status','active').order('variety_name'),
  ]);
  return NextResponse.json({ lots: lots.data ?? [], suppliers: suppliers.data ?? [], varieties: varieties.data ?? [] });
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const s = createServerSupabaseClient();
    const { error } = await s.from('seed_stock_lots').insert(body);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (e) { return NextResponse.json({ error: String(e) }, { status: 500 }); }
}

export async function DELETE(request: Request) {
  try {
    const { id } = (await request.json()) as { id: string };
    const s = createServerSupabaseClient();
    const { error } = await s.from('seed_stock_lots').update({ status: 'inactive' }).eq('id', id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (e) { return NextResponse.json({ error: String(e) }, { status: 500 }); }
}
