import { NextResponse }               from 'next/server';
import { createServerSupabaseClient } from '../../auth/line/line-auth-helpers';

export type CallerOk    = { ok: true;  memberId: string };
export type CallerError = { ok: false; response: ReturnType<typeof NextResponse.json> };

export async function resolveCaller(
  request: Request,
  s: ReturnType<typeof createServerSupabaseClient>,
): Promise<CallerOk | CallerError> {
  const token = (request.headers.get('Authorization') ?? '').replace('Bearer ', '').trim();
  if (!token) {
    return { ok: false, response: NextResponse.json({ error: 'กรุณาเข้าสู่ระบบก่อน' }, { status: 401 }) };
  }
  const { data: { user }, error } = await s.auth.getUser(token);
  if (error || !user) {
    return { ok: false, response: NextResponse.json({ error: 'session ไม่ถูกต้อง' }, { status: 401 }) };
  }
  const { data: member } = await s
    .from('members').select('id, status').eq('auth_user_id', user.id).maybeSingle();
  if (!member) {
    return { ok: false, response: NextResponse.json({ error: 'ไม่พบข้อมูลสมาชิก' }, { status: 403 }) };
  }
  if (member.status !== 'approved') {
    return { ok: false, response: NextResponse.json({ error: 'เฉพาะสมาชิกที่อนุมัติแล้วเท่านั้น' }, { status: 403 }) };
  }
  return { ok: true, memberId: member.id };
}
