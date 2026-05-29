import { useCallback, useEffect, useState } from 'react';

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

async function fetchPlotCount(lineUserId: string): Promise<number> {
  const params = new URLSearchParams({ line_user_id: lineUserId });
  const res = await fetch(`/api/member/plots?${params.toString()}`);
  const payload = (await res.json()) as { plots?: unknown[]; error?: string };
  if (!res.ok) throw new Error(payload.error ?? 'ไม่สามารถโหลดข้อมูลแปลงได้');
  return payload.plots?.length ?? 0;
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
      const count = await fetchPlotCount(member.line_user_id);
      setPlotCount(count);
    } catch (e) {
      setError(String(e));
      setPlotCount(0);
    }
    setLoading(false);
  }, [member?.is_approved, member?.status, member?.line_user_id]);

  useEffect(() => { void load(); }, [load]);

  const isApproved = member?.is_approved === true && member?.status === 'approved';
  const hasPlot    = (plotCount ?? 0) > 0;

  // Derive level
  let level: CompletenessLevel = 1;
  if (isApproved && hasPlot) level = 2;
  // Level 3 placeholder — production tracking not implemented this PR

  return { level, hasPlot, loading, error };
}
