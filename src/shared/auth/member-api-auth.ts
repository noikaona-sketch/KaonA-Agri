'use client';

import { ensureLiffIdToken } from '@/lib/liff/init-liff';
import { tryCreateSupabaseBrowserClient } from '@/lib/supabase/client';
import { applySupabaseSession } from '@/lib/supabase/set-supabase-session';
import type { AuthBootstrapResult, SupabaseSession } from '@/shared/auth/auth-types';

const AUTH_CACHE_KEY = 'kaona_auth_cache';

type LineAuthPayload = {
  error?: string;
  member?: AuthBootstrapResult;
  session?: SupabaseSession | null;
};

async function getSupabaseAccessToken(): Promise<string | null> {
  const supabase = tryCreateSupabaseBrowserClient();
  if (!supabase) return null;

  const { data } = await supabase.auth.getSession();
  if (!data.session) return null;

  const { data: refreshed } = await supabase.auth.refreshSession();
  return refreshed.session?.access_token ?? data.session.access_token;
}

async function refreshLineSupabaseSession(): Promise<{ accessToken: string | null; lineIdToken: string | null }> {
  const lineIdToken = await ensureLiffIdToken();
  if (!lineIdToken) return { accessToken: null, lineIdToken: null };

  const response = await fetch('/api/auth/line', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idToken: lineIdToken }),
  });

  const payload = (await response.json()) as LineAuthPayload;
  if (!response.ok || !payload.member) {
    return { accessToken: null, lineIdToken };
  }

  if (payload.session) {
    await applySupabaseSession(payload.session);
    try {
      sessionStorage.setItem(AUTH_CACHE_KEY, JSON.stringify({
        member: payload.member,
        status: payload.member.is_approved ? 'approved' : payload.member.status,
        session: payload.session,
        ts: Date.now(),
      }));
    } catch {
      // Cache persistence is best-effort only.
    }

    return { accessToken: payload.session.access_token, lineIdToken };
  }

  return { accessToken: null, lineIdToken };
}

export async function getMemberApiAuthHeaders(): Promise<Record<string, string>> {
  const existingToken = await getSupabaseAccessToken();
  if (existingToken) return { Authorization: `Bearer ${existingToken}` };

  const { accessToken, lineIdToken } = await refreshLineSupabaseSession();
  if (accessToken) return { Authorization: `Bearer ${accessToken}` };
  if (lineIdToken) return { 'X-Line-Id-Token': lineIdToken };

  return {};
}
