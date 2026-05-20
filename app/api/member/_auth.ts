import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '../auth/line/line-auth-helpers';

export async function resolveApprovedMember(
  request: Request,
  s: ReturnType<typeof createServerSupabaseClient>,
): Promise<{ ok: true; memberId: string } | { ok: false; response: ReturnType<typeof NextResponse.json> }> {
  const token = (request.headers.get('Authorization') ?? '').replace('Bearer ', '').trim();
  if (!token) {
    return { ok: false, response: NextResponse.json({ error: 'กรุณาเข้าสู่ระบบก่อน' }, { status: 401 }) };
  }

  const { data: { user }, error: userError } = await s.auth.getUser(token);
  if (userError || !user) {
    return { ok: false, response: NextResponse.json({ error: 'session ไม่ถูกต้อง' }, { status: 401 }) };
  }

  const { data: member } = await s
    .from('members')
    .select('id,status')
    .eq('auth_user_id', user.id)
    .maybeSingle();

  if (!member || member.status !== 'approved') {
    return { ok: false, response: NextResponse.json({ error: 'สมาชิกไม่ถูกต้องหรือยังไม่ได้รับอนุมัติ' }, { status: 403 }) };
  }

  return { ok: true, memberId: member.id as string };
}
