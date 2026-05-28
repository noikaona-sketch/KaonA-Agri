import { NextResponse } from 'next/server';
import { createServerSupabaseClient, createAnonSupabaseClient } from '../auth/line/line-auth-helpers';

export async function resolveApprovedMember(
  request: Request,
  s: ReturnType<typeof createServerSupabaseClient>,
  explicitMemberId?: string,   // ส่ง member_id มาตรงๆ ได้เลย
): Promise<{ ok: true; memberId: string } | { ok: false; response: ReturnType<typeof NextResponse.json> }> {

  // ── Path A: explicit member_id (เชื่อถือได้เพราะ LIFF login อยู่แล้ว) ──
  const memberId = explicitMemberId
    ?? new URL(request.url).searchParams.get('member_id');

  if (memberId) {
    const { data: member } = await s
      .from('members')
      .select('id, status')
      .eq('id', memberId)
      .maybeSingle();
    if (member?.status === 'approved') {
      return { ok: true, memberId: member.id as string };
    }
    return { ok: false, response: NextResponse.json(
      { error: 'สมาชิกไม่ถูกต้องหรือยังไม่ได้รับอนุมัติ' }, { status: 403 }
    )};
  }

  // ── Path B: Bearer token (Supabase session) ──────────────────────
  const token = (request.headers.get('Authorization') ?? '').replace('Bearer ', '').trim();
  if (!token) {
    return { ok: false, response: NextResponse.json({ error: 'กรุณาเข้าสู่ระบบก่อน' }, { status: 401 }) };
  }

  try {
    const anon = createAnonSupabaseClient();
    const { data: { user }, error: userError } = await anon.auth.getUser(token);
    if (userError || !user) {
      return { ok: false, response: NextResponse.json({ error: 'กรุณาเปิดแอปใหม่' }, { status: 401 }) };
    }
    const { data: member } = await s
      .from('members')
      .select('id, status')
      .eq('auth_user_id', user.id)
      .maybeSingle();
    if (member?.status === 'approved') {
      return { ok: true, memberId: member.id as string };
    }
    return { ok: false, response: NextResponse.json(
      { error: 'สมาชิกไม่ถูกต้องหรือยังไม่ได้รับอนุมัติ' }, { status: 403 }
    )};
  } catch {
    return { ok: false, response: NextResponse.json({ error: 'กรุณาเปิดแอปใหม่' }, { status: 401 }) };
  }
}
