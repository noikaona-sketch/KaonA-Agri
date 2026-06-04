/**
 * getAuthHeaders — shared helper for all member API calls on LINE mobile
 *
 * Returns headers + URL with auth params for resolveApprovedMember to work.
 * Pattern: Bearer token (if Supabase session available) + line_user_id always
 * (as fallback when session is null — CASE B members whose auth_user_id
 * was set by old signInAnonymously() flow).
 */

import { tryCreateSupabaseBrowserClient } from '@/lib/supabase/client';
import type { AuthBootstrapResult } from '@/shared/auth/auth-types';

export async function getAuthHeaders(
  member: AuthBootstrapResult,
  baseUrl: string,
): Promise<{ headers: Record<string, string>; url: string }> {
  const supabase = tryCreateSupabaseBrowserClient();
  const sessionData = supabase ? await supabase.auth.getSession() : null;
  const accessToken = sessionData?.data?.session?.access_token ?? null;

  const headers: Record<string, string> = {};
  if (accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`;
  }

  // Always append line_user_id — resolveApprovedMember uses it as fallback
  // when Bearer token is absent (CASE B: old anon session, session = null)
  const url = new URL(baseUrl, window.location.origin);
  if (member.line_user_id) {
    url.searchParams.set('line_user_id', member.line_user_id);
  }

  return { headers, url: url.toString() };
}
