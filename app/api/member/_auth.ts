import { NextResponse } from 'next/server';
import { createServerSupabaseClient, createAnonSupabaseClient } from '../auth/line/line-auth-helpers';

export async function resolveApprovedMember(
  request: Request,
  s: ReturnType<typeof createServerSupabaseClient>,
): Promise<{ ok: true; memberId: string } | { ok: false; response: ReturnType<typeof NextResponse.json> }> {
  const token = (request.headers.get('Authorization') ?? '').replace('Bearer ', '').trim();

  // ── Path A: Bearer token (Supabase session) ──────────────────────
  if (token) {
    try {
      const anon = createAnonSupabaseClient();
      const { data: { user }, error: userError } = await anon.auth.getUser(token);
      if (!userError && user) {
        const { data: member } = await s
          .from('members')
          .select('id,status')
          .eq('auth_user_id', user.id)
          .maybeSingle();
        if (member?.status === 'approved') {
          return { ok: true, memberId: member.id as string };
        }
      }
    } catch { /* token invalid — fall through to Path B */ }
  }

  // ── Path B: member_id ใน query param หรือ body (LIFF fallback) ──
  // ใช้เมื่อ Supabase session หมดอายุ แต่ยัง login อยู่ใน LIFF
  let memberId: string | null = null;

  const url = new URL(request.url);
  memberId = url.searchParams.get('member_id');

  if (!memberId && request.method !== 'GET') {
    try {
      const clone = request.clone();
      const body = await clone.json() as { member_id?: string };
      memberId = body.member_id ?? null;
    } catch { /* no body */ }
  }

  if (memberId) {
    const { data: member } = await s
      .from('members')
      .select('id,status')
      .eq('id', memberId)
      .maybeSingle();
    if (member?.status === 'approved') {
      return { ok: true, memberId: member.id as string };
    }
    return { ok: false, response: NextResponse.json({ error: 'สมาชิกไม่ถูกต้องหรือยังไม่ได้รับอนุมัติ' }, { status: 403 }) };
  }

  // ── ไม่มีทั้ง token และ member_id ──
  if (!token) {
    return { ok: false, response: NextResponse.json({ error: 'กรุณาเข้าสู่ระบบก่อน' }, { status: 401 }) };
  }
  return { ok: false, response: NextResponse.json({ error: 'session หมดอายุ กรุณาเปิดแอปใหม่' }, { status: 401 }) };
}
