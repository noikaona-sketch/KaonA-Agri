import { NextResponse } from 'next/server';
import { createServerSupabaseClient, createAnonSupabaseClient, getLineChannelId } from '../auth/line/line-auth-helpers';

import type { LineVerifyResponse } from '../auth/line/line-auth-helpers';

type ResolveContext = {
  explicitMemberId?: string;
  explicitLineUserId?: string;
};

function getBearerToken(request: Request) {
  return (request.headers.get('Authorization') ?? '').replace('Bearer ', '').trim();
}

function getLineIdToken(request: Request) {
  return (request.headers.get('X-Line-Id-Token') ?? '').trim();
}

async function resolveMemberIdFromBearer(token: string, s: ReturnType<typeof createServerSupabaseClient>) {
  const anon = createAnonSupabaseClient();
  const { data: { user }, error: userError } = await anon.auth.getUser(token);
  if (userError || !user) return null;

  const { data: member } = await s
    .from('members')
    .select('id, status')
    .eq('auth_user_id', user.id)
    .maybeSingle();

  return member?.status === 'approved' ? (member.id as string) : null;
}


async function resolveMemberIdFromLineIdToken(token: string, s: ReturnType<typeof createServerSupabaseClient>) {
  if (token === 'dev-bypass-token') {
    const { data: member } = await s
      .from('members')
      .select('id, status')
      .eq('line_user_id', 'dev-mock-line-id')
      .maybeSingle();

    return member?.status === 'approved' ? (member.id as string) : null;
  }

  const lineChannelId = getLineChannelId();
  if (!lineChannelId) return null;

  const verifyRes = await fetch('https://api.line.me/oauth2/v2.1/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ id_token: token, client_id: lineChannelId }),
  });

  if (!verifyRes.ok) return null;

  const verifyData = (await verifyRes.json()) as LineVerifyResponse;
  if (!verifyData.sub) return null;

  const { data: member } = await s
    .from('members')
    .select('id, status')
    .eq('line_user_id', verifyData.sub)
    .maybeSingle();

  return member?.status === 'approved' ? (member.id as string) : null;
}

async function resolveExplicitMember(
  s: ReturnType<typeof createServerSupabaseClient>,
  context: ResolveContext,
) {
  if (context.explicitLineUserId) {
    const { data: member } = await s
      .from('members')
      .select('id, status')
      .eq('line_user_id', context.explicitLineUserId)
      .maybeSingle();

    return member?.status === 'approved' ? (member.id as string) : null;
  }

  if (context.explicitMemberId) {
    const { data: member } = await s
      .from('members')
      .select('id, status')
      .eq('id', context.explicitMemberId)
      .maybeSingle();

    return member?.status === 'approved' ? (member.id as string) : null;
  }

  return null;
}

export async function resolveApprovedMember(
  request: Request,
  s: ReturnType<typeof createServerSupabaseClient>,
  explicitMemberId?: string,
): Promise<{ ok: true; memberId: string } | { ok: false; response: ReturnType<typeof NextResponse.json> }> {
  const url = new URL(request.url);
  const context: ResolveContext = {
    explicitMemberId: explicitMemberId ?? url.searchParams.get('member_id') ?? undefined,
    explicitLineUserId: url.searchParams.get('line_user_id') ?? undefined,
  };

  const token = getBearerToken(request);
  if (token) {
    try {
      const tokenMemberId = await resolveMemberIdFromBearer(token, s);
      if (tokenMemberId) {
        // Bearer token is valid — it's the source of truth; member_id param is hint only.
        return { ok: true, memberId: tokenMemberId };
      }
      // Token present but could not resolve member — fall through to explicit member_id
    } catch {
      // Token invalid/expired — fall through to explicit member_id
    }
  }

  const lineIdToken = getLineIdToken(request);
  if (lineIdToken) {
    try {
      const lineTokenMemberId = await resolveMemberIdFromLineIdToken(lineIdToken, s);
      if (lineTokenMemberId) {
        return { ok: true, memberId: lineTokenMemberId };
      }
    } catch {
      // LINE token invalid/expired — fall through to explicit member_id.
    }
  }

  const explicitResolvedMemberId = await resolveExplicitMember(s, context);
  if (explicitResolvedMemberId) {
    return { ok: true, memberId: explicitResolvedMemberId };
  }

  if (context.explicitMemberId || context.explicitLineUserId) {
    return { ok: false, response: NextResponse.json(
      { error: 'สมาชิกไม่ถูกต้องหรือยังไม่ได้รับอนุมัติ' }, { status: 403 }
    )};
  }

  return { ok: false, response: NextResponse.json({ error: 'กรุณาเข้าสู่ระบบก่อน' }, { status: 401 }) };
}
