import { createClient } from '@supabase/supabase-js';

import type { AppRole, AuthBootstrapResult, MemberStatus } from '@/shared/auth/auth-types';

export const APP_ROLES: AppRole[] = ['admin', 'staff', 'inspector', 'leader', 'truck_owner', 'farmer'];
export const MEMBER_STATUSES: MemberStatus[] = ['pending', 'approved', 'rejected', 'suspended'];

export function isAppRole(role: string): role is AppRole {
  return APP_ROLES.includes(role as AppRole);
}

export function isMemberStatus(status: string): status is MemberStatus {
  return MEMBER_STATUSES.includes(status as MemberStatus);
}

export type LineVerifyResponse = {
  sub?: string;
  name?: string;
  picture?: string;
  email?: string;
};

export type MemberRow = {
  id: string;
  auth_user_id: string | null;
  line_user_id: string;
  status: string;
  full_name: string;
};

export type RoleRow = {
  role: string;
  is_primary: boolean;
};

export function createServerSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ??  // Vercel Supabase Integration
    process.env.SUPABASE_SECRET_KEY;          // manual fallback

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Missing Supabase server environment variables');
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export function getLineChannelId(): string {
  const explicit = process.env.LINE_CHANNEL_ID ?? process.env.NEXT_PUBLIC_LINE_CHANNEL_ID;
  if (explicit) return explicit;
  const liffId = process.env.NEXT_PUBLIC_LIFF_ID ?? '';
  const [channelId] = liffId.split('-');
  return channelId || '';
}

export function getEffectiveRole(roleRows: RoleRow[], roles: AppRole[]): AppRole | null {
  const primary = roleRows.find((r) => r.is_primary && isAppRole(r.role));
  if (primary && isAppRole(primary.role)) return primary.role;
  return roles.length > 0 ? roles[0] : null;
}

export function normalizeMember(
  member: MemberRow,
  roles: AppRole[],
  effectiveRole: AppRole | null
): AuthBootstrapResult {
  const status = isMemberStatus(member.status) ? member.status : 'pending';

  return {
    member_id: member.id,
    auth_user_id: member.auth_user_id,
    line_user_id: member.line_user_id,
    full_name: member.full_name,
    status,
    is_approved: status === 'approved',
    effective_role: effectiveRole,
    roles,
  };
}
