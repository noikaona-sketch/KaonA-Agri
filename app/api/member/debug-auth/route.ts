import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

import { createAnonSupabaseClient, createServerSupabaseClient } from '../../auth/line/line-auth-helpers';

// Temporary diagnostic endpoint for LINE/mobile auth and plot ownership resolution.
// Keep the production response masked: no raw tokens, auth_user_id, or line_user_id.
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

function maskId(value: string | null | undefined) {
  if (!value) return null;
  if (value.length <= 8) return `${value.slice(0, 2)}…${value.slice(-2)}`;
  return `${value.slice(0, 4)}…${value.slice(-4)}`;
}

function safeMember(row: MemberDebugRow | null) {
  if (!row) return null;
  return {
    id_masked: maskId(row.id),
    auth_user_id_present: Boolean(row.auth_user_id),
    auth_user_id_masked: maskId(row.auth_user_id),
    line_user_id_present: Boolean(row.line_user_id),
    line_user_id_masked: maskId(row.line_user_id),
    line_display_name_present: Boolean(row.line_display_name),
    full_name_present: Boolean(row.full_name),
    status: row.status,
  };
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
      error: 'authenticated bearer token required',
      authenticated: false,
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

    const effectiveMember = memberByResolved ?? memberByAuthUid ?? null;
    const selectedKnownMemberId = selectedMember?.id ?? selectedMemberId;

    return NextResponse.json({
      authenticated: Boolean(authUid),
      auth_uid_present: Boolean(authUid),
      auth_uid_masked: maskId(authUid),
      auth_error: userError?.message ?? null,
      current_member_id_resolved: Boolean(currentMemberId),
      current_member_id_masked: maskId(currentMemberId),
      current_member_id_error: currentMemberError?.message ?? null,
      selected_member_supplied: Boolean(selectedMemberId || selectedLineUserId),
      selected_member_found: Boolean(selectedMember),
      selected_member_matches_resolved: Boolean(
        currentMemberId && selectedKnownMemberId && currentMemberId === selectedKnownMemberId,
      ),
      mismatch_flags: {
        auth_uid_without_member: Boolean(authUid && !memberByAuthUid),
        resolved_member_differs_from_auth_member: Boolean(
          memberByResolved && memberByAuthUid && memberByResolved.id !== memberByAuthUid.id,
        ),
        selected_member_differs_from_resolved: Boolean(
          currentMemberId && selectedKnownMemberId && currentMemberId !== selectedKnownMemberId,
        ),
        member_auth_user_id_differs_from_auth_uid: Boolean(
          effectiveMember?.auth_user_id && authUid && effectiveMember.auth_user_id !== authUid,
        ),
      },
      member_row: safeMember(effectiveMember),
      selected_member: safeMember(selectedMember),
      errors: {
        member_by_resolved: memberByResolvedError?.message ?? null,
        member_by_auth_uid: memberByAuthUidError?.message ?? null,
        selected_member: selectedMemberError?.message ?? null,
      },
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
