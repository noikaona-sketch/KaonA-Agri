import { NextResponse } from 'next/server';

import { createServerSupabaseClient } from '../../../auth/line/line-auth-helpers';
import { requireAdmin } from '../../members/_admin-auth';

export async function POST(request: Request) {
  try {
    const admin = await requireAdmin();
    if (!admin) return NextResponse.json({ error: 'ไม่มีสิทธิ์เข้าถึง — กรุณาเข้าสู่ระบบ admin' }, { status: 403 });

    const body = (await request.json()) as { requestId?: string; decision?: 'approved' | 'rejected'; reason?: string };
    if (!body.requestId) return NextResponse.json({ error: 'requestId required' }, { status: 400 });
    if (!body.decision || !['approved', 'rejected'].includes(body.decision)) {
      return NextResponse.json({ error: 'decision invalid' }, { status: 400 });
    }

    const s = createServerSupabaseClient();
    const { data: current, error: findErr } = await s.from('provider_requests').select('status').eq('id', body.requestId).maybeSingle();
    if (findErr) return NextResponse.json({ error: findErr.message }, { status: 500 });
    if (!current) return NextResponse.json({ error: 'not found' }, { status: 404 });
    if (current.status !== 'pending') return NextResponse.json({ error: 'transition not allowed' }, { status: 409 });

    const { error } = await s.from('provider_requests').update({
      status: body.decision,
      reviewer_reason: body.reason ?? null,
      reviewed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).eq('id', body.requestId);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
