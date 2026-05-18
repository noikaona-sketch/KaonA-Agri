import { useCallback, useEffect, useState } from 'react';

import { tryCreateSupabaseBrowserClient } from '@/lib/supabase/client';
import { useCurrentMember } from '@/providers/auth-provider';

// ─────────────────────────────────────────────────────────────────────────────
// Completeness levels — Issue #213 PR1
//
// Level 1  Basic Member      approved member (any role)
// Level 2  Plot Registered   Level 1 + at least one plot
// Level 3  Production Track  placeholder — not implemented in this PR
//
// This hook never hard-blocks — callers use level/hasPlot for soft reminders.
// ─────────────────────────────────────────────────────────────────────────────
export type CompletenessLevel = 1 | 2 | 3;

export type MemberCompleteness = {
  level:    CompletenessLevel;
  hasPlot:  boolean;
  loading:  boolean;
  error:    string | null;
};

// Fetch plot count via /api/member/plots (Bearer token, Mode A).
// Reuses the session-based GET added in PR #237.
async function fetchPlotCount(): Promise<number> {
  const sb = tryCreateSupabaseBrowserClient();
  if (!sb) return 0;

  const { data: { session } } = await sb.auth.getSession();
  const token = session?.access_token ?? '';
  if (!token) return 0;

  const res = await fetch('/api/member/plots', {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return 0;

  const json = (await res.json()) as { plots?: unknown[] };
  return json.plots?.length ?? 0;
}

export function useMemberCompleteness(): MemberCompleteness {
  const member = useCurrentMember();

  const [plotCount, setPlotCount] = useState<number | null>(null);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState<string | null>(null);

  const load = useCallback(async () => {
    // Only fetch if member is approved — no need to count plots otherwise
    if (!member?.is_approved || member.status !== 'approved') {
      setPlotCount(0);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const count = await fetchPlotCount();
      setPlotCount(count);
    } catch (e) {
      setError(String(e));
      setPlotCount(0);
    }
    setLoading(false);
  }, [member?.is_approved, member?.status]);

  useEffect(() => { void load(); }, [load]);

  const isApproved = member?.is_approved === true && member?.status === 'approved';
  const hasPlot    = (plotCount ?? 0) > 0;

  // Derive level
  let level: CompletenessLevel = 1;
  if (isApproved && hasPlot) level = 2;
  // Level 3 placeholder — production tracking not implemented this PR

  return { level, hasPlot, loading, error };
}
