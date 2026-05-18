import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '../../auth/line/line-auth-helpers';
import { requireAdminPermission, isForbidden } from '../members/_admin-auth';

export async function GET() {
  const _ar_get = await requireAdminPermission('seed.read');
  if (isForbidden(_ar_get)) return _ar_get.forbidden;
  const s = createServerSupabaseClient();
  const { data } = await s.from('warehouses').select('*').eq('is_active', true).order('sort_order');
  return NextResponse.json({ warehouses: data ?? [] });
}
