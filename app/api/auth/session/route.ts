import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

import type { AppRole, AuthBootstrapResult, MemberStatus } from '@/shared/auth/auth-types';

const APP_ROLES: AppRole[] = ['admin', 'staff', 'inspector', 'leader', 'truck_owner', 'farmer'];
const MEMBER_STATUSES: MemberStatus[] = ['pending', 'approved', 'rejected', 'suspended'];

type MemberRow = {
  id: string;
  auth_user_id: string | null;
  line_user_id: string;
  status: string;
};

type RoleRow = {
  role: string;
  is_primary: boolean;
};

function isAppRole(role: string): role is AppRole {
  return APP_ROLES.includes(role as AppRole);
}

function isMemberStatus(status: string): status is MemberStatus {
  return MEMBER_STATUSES.includes(status as MemberStatus);
}

function createServerSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SECRET_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Missing Supabase server environment variables');
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

function getEffectiveRole(roleRows: RoleRow[], roles: AppRole[]): AppRole | null {
  const primaryRole = roleRows.find((row) => row.is_primary && isAppRole(row.role));

  if (primaryRole && isAppRole(primaryRole.role)) {
    return primaryRole.role;
  }

  return roles.length > 0 ? roles[0] : null;
}

function normalizeMember(member: MemberRow, roles: AppRole[], effectiveRole: AppRole | null): AuthBootstrapResult {
  const normalizedStatus = isMemberStatus(member.status) ? member.status : 'pending';

  return {
    member_id: member.id,
    auth_user_id: member.auth_user_id,
    line_user_id: member.line_user_id,
    status: normalizedStatus,
    is_approved: normalizedStatus === 'approved',
    effective_role: effectiveRole,
    roles,
  };
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { accessToken?: string };

    if (!body.accessToken) {
      return NextResponse.json({ error: 'Missing access token' }, { status: 400 });
    }

    const supabase = createServerSupabaseClient();
    const userResult = await supabase.auth.getUser(body.accessToken);

    if (userResult.error || !userResult.data.user) {
      return NextResponse.json({ error: 'Invalid session token' }, { status: 401 });
    }

    const memberResult = await supabase
      .from('members')
      .select('id, auth_user_id, line_user_id, status')
      .eq('auth_user_id', userResult.data.user.id)
      .maybeSingle();

    if (memberResult.error || !memberResult.data) {
      return NextResponse.json({ error: 'Member profile not found for this account' }, { status: 404 });
    }

    const roleRowsResult = await supabase
      .from('member_roles')
      .select('role, is_primary')
      .eq('member_id', memberResult.data.id);

    if (roleRowsResult.error) {
      return NextResponse.json({ error: 'Failed to load member roles' }, { status: 500 });
    }

    const roleRows = (roleRowsResult.data ?? []) as RoleRow[];
    const roles: AppRole[] = roleRows.map((row) => row.role).filter(isAppRole);
    const effectiveRole = getEffectiveRole(roleRows, roles);

    return NextResponse.json({ member: normalizeMember(memberResult.data, roles, effectiveRole) });
  } catch (error) {
    console.error('[SESSION_AUTH_ROUTE]', error);

    return NextResponse.json({ error: 'Session authentication failed' }, { status: 500 });
  }
}
