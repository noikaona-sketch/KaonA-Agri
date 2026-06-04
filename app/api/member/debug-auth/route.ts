import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

import { createAnonSupabaseClient, createServerSupabaseClient } from '../../auth/line/line-auth-helpers';

export const dynamic = 'force-dynamic';

type MemberDebugRow = {
  id: string;
  auth_user_id: string | null;
  line_user_id: string | null;
  line_display_name: string | null;
  full_name: string | null;
  status: string | null;
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

async function countPlotsByMember(
  s: ReturnType<typeof createServerSupabaseClient>,
  memberId: string | null,
) {
  if (!memberId) return null;
  const { count, error } = await s
    .from('plots')
    .select('id', { count: 'exact', head: true })
    .eq('member_id', memberId)
    .is('deleted_at', null);

  return { count: count ?? 0, error: error?.message ?? null };
}

export async function GET(request: Request) {
  const token = getBearerToken(request);
  const url = new URL(request.url);
  const selectedMemberId = url.searchParams.get('member_id');
  const selectedLineUserId = url.searchParams.get('line_user_id');

  if (!token) {
    return NextResponse.json({
      error: 'no bearer token',
      tokenLength: 0,
      selected_member_id: selectedMemberId,
      selected_line_user_id: selectedLineUserId,
    }, { status: 401 });
  }

  try {
    const anon = createAnonSupabaseClient();
    const bearerClient = createBearerSupabaseClient(token);
    const svc = createServerSupabaseClient();

    const { data: userData, error: userError } = await anon.auth.getUser(token);
    const authUid = userData.user?.id ?? null;

    const { data: resolvedMemberId, error: currentMemberError } = await bearerClient.rpc('current_member_id');
    const currentMemberId = typeof resolvedMemberId === 'string' ? resolvedMemberId : null;

    const { data: memberByResolved, error: memberByResolvedError } = currentMemberId
      ? await svc
        .from('members')
        .select('id, auth_user_id, line_user_id, line_display_name, full_name, status')
        .eq('id', currentMemberId)
        .maybeSingle<MemberDebugRow>()
      : { data: null, error: null };

    const { data: memberByAuthUid, error: memberByAuthUidError } = authUid
      ? await svc
        .from('members')
        .select('id, auth_user_id, line_user_id, line_display_name, full_name, status')
        .eq('auth_user_id', authUid)
        .maybeSingle<MemberDebugRow>()
      : { data: null, error: null };

    const { data: selectedMember, error: selectedMemberError } = selectedMemberId
      ? await svc
        .from('members')
        .select('id, auth_user_id, line_user_id, line_display_name, full_name, status')
        .eq('id', selectedMemberId)
        .maybeSingle<MemberDebugRow>()
      : selectedLineUserId
        ? await svc
          .from('members')
          .select('id, auth_user_id, line_user_id, line_display_name, full_name, status')
          .eq('line_user_id', selectedLineUserId)
          .maybeSingle<MemberDebugRow>()
        : { data: null, error: null };

    const [plotsByResolved, plotsBySelected, visiblePlotsByRls] = await Promise.all([
      countPlotsByMember(svc, currentMemberId),
      countPlotsByMember(svc, selectedMember?.id ?? selectedMemberId),
      bearerClient
        .from('plots')
        .select('id', { count: 'exact', head: true })
        .is('deleted_at', null),
    ]);

    return NextResponse.json({
      tokenLength: token.length,
      tokenPrefix: token.slice(0, 20),
      auth_uid: authUid,
      auth_user: userData.user ? { id: userData.user.id, email: userData.user.email ?? null } : null,
      auth_error: userError?.message ?? null,
      current_member_id: currentMemberId,
      current_member_id_error: currentMemberError?.message ?? null,
      member_row: memberByResolved ?? memberByAuthUid ?? null,
      member_by_resolved_error: memberByResolvedError?.message ?? null,
      member_by_auth_uid: memberByAuthUid,
      member_by_auth_uid_error: memberByAuthUidError?.message ?? null,
      selected_member: selectedMember,
      selected_member_error: selectedMemberError?.message ?? null,
      plot_counts: {
        by_resolved_member_id: plotsByResolved,
        by_known_or_selected_member_id: plotsBySelected,
        visible_to_current_rls: {
          count: visiblePlotsByRls.count ?? 0,
          error: visiblePlotsByRls.error?.message ?? null,
        },
      },
    });
  } catch (e) {
    return NextResponse.json({ caught: String(e) }, { status: 500 });
  }
}
