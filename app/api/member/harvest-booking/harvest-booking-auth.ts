import { NextResponse }               from 'next/server';
import { createServerSupabaseClient } from '../../auth/line/line-auth-helpers';

export type CallerOk    = { ok: true;  memberId: string };
export type CallerError = { ok: false; response: ReturnType<typeof NextResponse.json> };

export async function resolveCaller(
  request: Request,
  s: ReturnType<typeof createServerSupabaseClient>,
): Promise<CallerOk | CallerError> {
  const url        = new URL(request.url);
  const token      = (request.headers.get('Authorization') ?? '').replace('Bearer ', '').trim();
  const lineUserId = url.searchParams.get('line_user_id') ?? undefined;
  const explicitId = url.searchParams.get('member_id')   ?? undefined;

  let memberId: string | null = null;

  // 1. Bearer token
  if (token) {
    const { data: { user } } = await s.auth.getUser(token);
    if (user?.id) {
      const { data: m } = await s.from('members').select('id,status').eq('auth_user_id', user.id).maybeSingle();
      if (m?.status === 'approved') return { ok: true, memberId: m.id };
      if (m) return { ok: false, response: NextResponse.json({ error: 'เฉพาะสมาชิกที่อนุมัติแล้วเท่านั้น' }, { status: 403 }) };
    }
  }

  // 2. line_user_id fallback (CASE B)
  if (lineUserId) {
    const { data: m } = await s.from('members').select('id,status').eq('line_user_id', lineUserId).maybeSingle();
    if (m?.status === 'approved') return { ok: true, memberId: m.id };
    if (m) return { ok: false, response: NextResponse.json({ error: 'เฉพาะสมาชิกที่อนุมัติแล้วเท่านั้น' }, { status: 403 }) };
  }

  // 3. explicit member_id fallback
  if (explicitId) {
    const { data: m } = await s.from('members').select('id,status').eq('id', explicitId).maybeSingle();
    if (m?.status === 'approved') return { ok: true, memberId: m.id };
    if (m) return { ok: false, response: NextResponse.json({ error: 'เฉพาะสมาชิกที่อนุมัติแล้วเท่านั้น' }, { status: 403 }) };
  }

  return { ok: false, response: NextResponse.json({ error: 'กรุณาเข้าสู่ระบบก่อน' }, { status: 401 }) };
}
