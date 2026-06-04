import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { createServerSupabaseClient, createAnonSupabaseClient, getLineChannelId } from '../auth/line/line-auth-helpers';
import { decideApprovedMemberAuth } from './member-auth-decision';

import type { LineVerifyResponse } from '../auth/line/line-auth-helpers';
import type { MemberAuthDecision, MemberAuthResolution } from './member-auth-decision';

type ResolveContext = {
  explicitMemberId?: string;
  explicitLineUserId?: string;
};

type ResolveApprovedMemberOptions = {
  allowExplicitIdentity?: boolean;
};

function getBearerToken(request: Request) {
  return (request.headers.get('Authorization') ?? '').replace('Bearer ', '').trim();
}


function createBearerSupabaseClient(token: string) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
    process.env.SUPABASE_ANON_KEY ??
    process.env.SUPABASE_PUBLISHABLE_KEY;

  if (!supabaseUrl || !anonKey) {
    throw new Error('Missing Supabase anon environment variables');
  }

  return createClient(supabaseUrl, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
}

export async function getMemberResolutionDiagnostics(request: Request) {
  const token = getBearerToken(request);
  if (!token) {
    return {
      authUid: null,
      authUidError: null,
      currentMemberId: null,
      currentMemberIdError: null,
    };
  }

  const anon = createAnonSupabaseClient();
  const bearerClient = createBearerSupabaseClient(token);
  const { data: userData, error: userError } = await anon.auth.getUser(token);
  const { data: resolvedMemberId, error: currentMemberError } = await bearerClient.rpc('current_member_id');

  return {
    authUid: userData.user?.id ?? null,
    authUidError: userError?.message ?? null,
    currentMemberId: typeof resolvedMemberId === 'string' ? resolvedMemberId : null,
    currentMemberIdError: currentMemberError?.message ?? null,
  };
}

function getLineIdToken(request: Request) {
  return (request.headers.get('X-Line-Id-Token') ?? '').trim();
}

function isNonProductionDevBypassEnabled() {
  return process.env.NODE_ENV !== 'production' && process.env.NEXT_PUBLIC_DEV_BYPASS_LINE === 'true';
}

async function resolveMemberIdFromBearer(token: string, s: ReturnType<typeof createServerSupabaseClient>): Promise<MemberAuthResolution> {
  const anon = createAnonSupabaseClient();
  const { data: { user }, error: userError } = await anon.auth.getUser(token);
  if (userError || !user) return { kind: 'invalid' };

  const { data: member } = await s
    .from('members')
    .select('id, status')
    .eq('auth_user_id', user.id)
    .maybeSingle();

  return member?.status === 'approved'
    ? { kind: 'approved', memberId: member.id as string }
    : { kind: 'unapproved' };
}

async function resolveMemberIdFromLineIdToken(token: string, s: ReturnType<typeof createServerSupabaseClient>): Promise<MemberAuthResolution> {
  if (token === 'dev-bypass-token') {
    if (!isNonProductionDevBypassEnabled()) return { kind: 'invalid' };

    const { data: member } = await s
      .from('members')
      .select('id, status')
      .eq('line_user_id', 'dev-mock-line-id')
      .maybeSingle();

    return member?.status === 'approved'
      ? { kind: 'approved', memberId: member.id as string }
      : { kind: 'unapproved' };
  }

  const lineChannelId = getLineChannelId();
  if (!lineChannelId) return { kind: 'invalid' };

  const verifyRes = await fetch('https://api.line.me/oauth2/v2.1/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ id_token: token, client_id: lineChannelId }),
  });

  if (!verifyRes.ok) return { kind: 'invalid' };

  const verifyData = (await verifyRes.json()) as LineVerifyResponse;
  if (!verifyData.sub) return { kind: 'invalid' };

  const { data: member } = await s
    .from('members')
    .select('id, status')
    .eq('line_user_id', verifyData.sub)
    .maybeSingle();

  return member?.status === 'approved'
    ? { kind: 'approved', memberId: member.id as string }
    : { kind: 'unapproved' };
}

async function resolveExplicitMember(
  s: ReturnType<typeof createServerSupabaseClient>,
  context: ResolveContext,
): Promise<MemberAuthResolution | undefined> {
  if (context.explicitLineUserId) {
    const { data: member } = await s
      .from('members')
      .select('id, status')
      .eq('line_user_id', context.explicitLineUserId)
      .maybeSingle();

    return member?.status === 'approved'
      ? { kind: 'approved', memberId: member.id as string }
      : { kind: 'unapproved' };
  }

  if (context.explicitMemberId) {
    const { data: member } = await s
      .from('members')
      .select('id, status')
      .eq('id', context.explicitMemberId)
      .maybeSingle();

    return member?.status === 'approved'
      ? { kind: 'approved', memberId: member.id as string }
      : { kind: 'unapproved' };
  }

  return undefined;
}

function jsonFromDecision(decision: Extract<MemberAuthDecision, { ok: false }>) {
  return NextResponse.json({ error: decision.error }, { status: decision.status });
}

export async function resolveApprovedMember(
  request: Request,
  s: ReturnType<typeof createServerSupabaseClient>,
  explicitMemberId?: string,
  options: ResolveApprovedMemberOptions = {},
): Promise<{ ok: true; memberId: string } | { ok: false; response: ReturnType<typeof NextResponse.json> }> {
  const url = new URL(request.url);
  const context: ResolveContext = {
    explicitMemberId: explicitMemberId ?? url.searchParams.get('member_id') ?? undefined,
    explicitLineUserId: url.searchParams.get('line_user_id') ?? undefined,
  };

  const token = getBearerToken(request);
  const bearer = token ? await resolveMemberIdFromBearer(token, s) : undefined;

  const lineIdTokenValue = getLineIdToken(request);
  const lineIdToken = !bearer && lineIdTokenValue
    ? await resolveMemberIdFromLineIdToken(lineIdTokenValue, s)
    : undefined;

  const allowExplicitIdentity = options.allowExplicitIdentity ?? true;
  const explicit = !bearer && !lineIdToken && allowExplicitIdentity
    ? await resolveExplicitMember(s, context)
    : undefined;

  const decision = decideApprovedMemberAuth({
    bearer,
    lineIdToken,
    explicit,
    hasExplicitIdentity: Boolean(context.explicitMemberId || context.explicitLineUserId),
    allowExplicitIdentity,
  });

  if (decision.ok) return { ok: true, memberId: decision.memberId };
  return { ok: false, response: jsonFromDecision(decision) };
}
