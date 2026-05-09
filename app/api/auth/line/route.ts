import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

import type { AuthBootstrapResult, AppRole, MemberStatus } from '@/shared/auth/auth-types';

const APP_ROLES: AppRole[] = ['admin', 'staff', 'inspector', 'leader', 'truck_owner', 'farmer'];
const MEMBER_STATUSES: MemberStatus[] = ['pending', 'approved', 'rejected', 'suspended'];

function isAppRole(role: string): role is AppRole {
  return APP_ROLES.includes(role as AppRole);
}

function isMemberStatus(status: string): status is MemberStatus {
  return MEMBER_STATUSES.includes(status as MemberStatus);
}

type LineVerifyResponse = {
  sub?: string;
  name?: string;
  picture?: string;
  email?: string;
  aud?: string;
  exp?: number;
};

type MemberRow = {
  id: string;
  auth_user_id: string | null;
  line_user_id: string;
  status: string;
  full_name: string;
};

type RoleRow = {
  role: string;
  is_primary: boolean;
};

function createServerSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

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

function normalizeMember(
  member: MemberRow,
  roles: AppRole[],
  effectiveRole: AppRole | null
): AuthBootstrapResult {
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
    const body = (await request.json()) as { idToken?: string };

    if (!body.idToken) {
      return NextResponse.json({ error: 'Missing LINE ID token' }, { status: 400 });
    }

    const verifyResponse = await fetch('https://api.line.me/oauth2/v2.1/verify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        id_token: body.idToken,
        client_id: process.env.NEXT_PUBLIC_LIFF_ID ?? '',
      }),
    });

    if (!verifyResponse.ok) {
      return NextResponse.json({ error: 'LINE token verification failed' }, { status: 401 });
    }

    const verifyData = (await verifyResponse.json()) as LineVerifyResponse;

    if (!verifyData.sub) {
      return NextResponse.json({ error: 'LINE user id missing' }, { status: 401 });
    }

    const supabase = createServerSupabaseClient();

    let member: MemberRow | null = null;

    const existingMember = await supabase
      .from('members')
      .select('id, auth_user_id, line_user_id, status, full_name')
      .eq('line_user_id', verifyData.sub)
      .maybeSingle();

    if (existingMember.error) {
      return NextResponse.json({ error: 'Failed to load member profile' }, { status: 500 });
    }

    if (existingMember.data) {
      member = existingMember.data;
    } else {
      const insertedMember = await supabase
        .from('members')
        .insert({
          line_user_id: verifyData.sub,
          full_name: verifyData.name ?? 'LINE Member',
          citizen_id_masked: 'PENDING',
          status: 'pending',
        })
        .select('id, auth_user_id, line_user_id, status, full_name')
        .single();

      if (insertedMember.error || !insertedMember.data) {
        return NextResponse.json({ error: 'Failed to create member profile' }, { status: 500 });
      }

      member = insertedMember.data;

      await supabase.from('member_roles').upsert(
        {
          member_id: member.id,
          role: 'farmer',
          is_primary: true,
        },
        {
          onConflict: 'member_id,role',
        }
      );
    }

    const roleRowsResult = await supabase
      .from('member_roles')
      .select('role, is_primary')
      .eq('member_id', member.id);

    if (roleRowsResult.error) {
      return NextResponse.json({ error: 'Failed to load member roles' }, { status: 500 });
    }

    const roleRows = (roleRowsResult.data ?? []) as RoleRow[];
    const roles: AppRole[] = roleRows.map((row) => row.role).filter(isAppRole);
    const primaryRole = roleRows.find((row) => row.is_primary && isAppRole(row.role))?.role;
    const effectiveRole: AppRole | null = isAppRole(primaryRole ?? '') ? primaryRole : roles[0] ?? null;

    return NextResponse.json({
      member: normalizeMember(member, roles, effectiveRole),
      lineProfile: {
        name: verifyData.name ?? null,
        picture: verifyData.picture ?? null,
        email: verifyData.email ?? null,
      },
    });
  } catch (error) {
    console.error('[LINE_AUTH_ROUTE]', error);

    return NextResponse.json(
      {
        error: 'LINE authentication failed',
      },
      {
        status: 500,
      }
    );
  }
}
