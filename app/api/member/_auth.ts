import { NextResponse } from 'next/server';
import { createServerSupabaseClient, createAnonSupabaseClient } from '../auth/line/line-auth-helpers';

export async function resolveApprovedMember(
  request: Request,
  s: ReturnType<typeof createServerSupabaseClient>,
): Promise<{ ok: true; memberId: string } | { ok: false; response: ReturnType<typeof NextResponse.json> }> {
  const token = (request.headers.get('Authorization') ?? '').replace('Bearer ', '').trim();
  if (!token) {
    return { ok: false, response: NextResponse.json({ error: 'กรุณาเข้าสู่ระบบก่อน' }, { status: 401 }) };
  }

  // ใช้ anon client verify token เพราะ service_role ไม่ validate user JWT
  const anonClient = createAnonSupabaseClient();
  const { data: { user }, error: userError } = await anonClient.auth.getUser(token);
  if (userError || !user) {
    return { ok: false, response: NextResponse.json({ error: 'session ไม่ถูกต้อง หรือหมดอายุ' }, { status: 401 }) };
  }

  // ดึง member จาก service role client (ข้าม RLS)
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
