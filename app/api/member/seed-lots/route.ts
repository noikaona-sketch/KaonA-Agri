import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '../../auth/line/line-auth-helpers';

export async function GET() {
  const s = createServerSupabaseClient();
  const { data, error } = await s
    .from('seed_stock_lots')
    .select(`
      id, lot_no, variety_name, quantity_balance, bag_weight_kg,
      price_per_bag, status, variety_id, supplier_id,
      seed_varieties(crop_type, days_to_harvest, notes, planting_guide),
      seed_suppliers(supplier_name)
    `)
    .in('status', ['available', 'low'])
    .gt('quantity_balance', 0)
    .order('variety_name');

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ lots: data ?? [] });
}
