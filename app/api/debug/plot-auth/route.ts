import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

import { createAnonSupabaseClient, createServerSupabaseClient } from '../../auth/line/line-auth-helpers';

function getBearerToken(request: Request) {
  return (request.headers.get('Authorization') ?? '').replace('Bearer ', '').trim();
}

function createUserScopedSupabaseClient(token: string) {
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

export async function GET(request: Request) {
  try {
    const token = getBearerToken(request);
    const anon = createAnonSupabaseClient();
    const service = createServerSupabaseClient();

    let authUid: string | null = null;
    let authError: string | null = null;
    let currentMemberId: string | null = null;
    let currentMemberError: string | null = null;

    if (token) {
      const { data: { user }, error } = await anon.auth.getUser(token);
      authUid = user?.id ?? null;
      authError = error?.message ?? null;

      const userScoped = createUserScopedSupabaseClient(token);
      const { data, error: rpcError } = await userScoped.rpc('current_member_id');
      currentMemberId = (data as string | null) ?? null;
      currentMemberError = rpcError?.message ?? null;
    } else {
      authError = 'missing Authorization: Bearer <access_token> header';
      currentMemberError = 'missing Authorization: Bearer <access_token> header';
    }

    const memberQuery = service
      .from('members')
      .select('id, auth_user_id, line_user_id, status, full_name, phone, created_at, updated_at')
      .limit(1);

    const { data: memberRow, error: memberError } = currentMemberId
      ? await memberQuery.eq('id', currentMemberId).maybeSingle()
      : authUid
        ? await memberQuery.eq('auth_user_id', authUid).maybeSingle()
        : { data: null, error: null };

    const memberId = memberRow?.id ?? currentMemberId ?? null;
    const { count: plotsByMemberId, error: plotsCountError } = memberId
      ? await service
        .from('plots')
        .select('id', { count: 'exact', head: true })
        .eq('member_id', memberId)
      : { count: null, error: null };

    return NextResponse.json({
      'auth.uid()': authUid,
      'current_member_id()': currentMemberId,
      auth_uid: authUid,
      current_member_id: currentMemberId,
      member: memberRow ?? null,
      'member.id': memberRow?.id ?? null,
      'member.auth_user_id': memberRow?.auth_user_id ?? null,
      'member.line_user_id': memberRow?.line_user_id ?? null,
      member_id: memberRow?.id ?? null,
      member_auth_user_id: memberRow?.auth_user_id ?? null,
      member_line_user_id: memberRow?.line_user_id ?? null,
      plots_count_by_member_id: plotsByMemberId ?? 0,
      errors: {
        auth: authError,
        current_member_id: currentMemberError,
        member: memberError?.message ?? null,
        plots_count: plotsCountError?.message ?? null,
      },
      plots_insert_policy_inspection: {
        source: 'supabase/migrations/202606040005_unowned_plots.sql overrides the earlier plots_crud_own_or_admin_staff policy',
        expects_auth_uid: 'indirectly: public.current_member_id() resolves members.id where members.auth_user_id = auth.uid()',
        expects_current_member_id: 'yes: member_id = public.current_member_id() is one allowed INSERT check branch',
        expects_created_by: 'no: the current checked-in plots_crud_own_or_admin_staff policy does not reference created_by',
        expects_member_id: 'yes: member_id = public.current_member_id() is the normal member-owned INSERT path; member_id is null and admin/staff are separate allowed branches',
      },
    });
  } catch (e) {
    console.error('[DEBUG_PLOT_AUTH] exception:', e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
