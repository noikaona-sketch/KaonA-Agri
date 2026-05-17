import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '../../auth/line/line-auth-helpers';

export const dynamic = 'force-dynamic';

export async function GET() {
  const s = createServerSupabaseClient();
  const { data } = await s.from('warehouses').select('*').eq('is_active', true).order('sort_order');
  return NextResponse.json({ warehouses: data ?? [] });
}
