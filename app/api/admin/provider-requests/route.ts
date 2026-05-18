import { NextResponse } from 'next/server';

import { createServerSupabaseClient } from '../../auth/line/line-auth-helpers';
import { requireAdmin } from '../members/_admin-auth';

export async function GET(request: Request) {
  try {
    const admin = await requireAdmin();
    if (!admin) return NextResponse.json({ error: 'ไม่มีสิทธิ์เข้าถึง — กรุณาเข้าสู่ระบบ admin' }, { status: 403 });

    const url = new URL(request.url);
    const status = url.searchParams.get('status') ?? 'pending';
    const s = createServerSupabaseClient();
    const { data, error } = await s
      .from('provider_requests')
      .select('*')
      .eq('request_type', 'service_team')
      .eq('status', status)
      .order('created_at', { ascending: true })
      .limit(100);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ items: data ?? [] });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
