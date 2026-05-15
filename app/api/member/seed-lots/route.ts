import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '../../auth/line/line-auth-helpers';

export async function GET() {
  const s = createServerSupabaseClient();
  const { data, error } = await s
    .from('seed_varieties')
    .select('id,variety_name,crop_type,days_to_harvest,bag_weight_kg,price_per_bag,yield_ratio,notes,planting_guide,season,planting_spacing,supplier_id,seed_suppliers(supplier_name)')
    .eq('active_status', 'active')
    .eq('show_to_farmer', true)
    .order('sort_order')
    .order('variety_name');

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ lots: data ?? [] });
}
