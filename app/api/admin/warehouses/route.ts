import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '../../auth/line/line-auth-helpers';

export async function GET() {
  const s = createServerSupabaseClient();
  const { data } = await s.from('warehouses').select('*').eq('is_active', true).order('sort_order');
  return NextResponse.json({ warehouses: data ?? [] });
}
