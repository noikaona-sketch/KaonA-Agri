'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

import { useCurrentMember } from '@/providers/auth-provider';
import { tryCreateSupabaseBrowserClient } from '@/lib/supabase/client';
import type { MemberPlot, PlotContext } from './plot-context';
import { resolvePlotContext, SESSION_EXPIRED_MESSAGE } from './plot-context';

type MemberPlotsResponse = {
  plots?: MemberPlot[];
  error?: string;
};

type UseMemberPlotsOptions = {
  selectedPlotId?: string | null;
  enabled?: boolean;
};

type UseMemberPlotsResult = PlotContext & {
  plots: MemberPlot[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
};

async function getBearerToken() {
  try {
    const supabase = tryCreateSupabaseBrowserClient();
    if (!supabase) return null;
    const { data: refreshed } = await supabase.auth.refreshSession();
    if (refreshed.session?.access_token) return refreshed.session.access_token;
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token ?? null;
  } catch {
    return null;
  }
}

function buildMemberPlotsRequest(token: string | null, lineUserId?: string | null): { url: string; headers: Record<string, string> } | null {
  if (token) {
    return {
      url: '/api/member/plots',
      headers: { Authorization: `Bearer ${token}` },
    };
  }

  if (lineUserId) {
    const params = new URLSearchParams({ line_user_id: lineUserId });
    return {
      url: `/api/member/plots?${params.toString()}`,
      headers: {},
    };
  }

  return null;
}

export function useMemberPlots(options: UseMemberPlotsOptions = {}): UseMemberPlotsResult {
  const { selectedPlotId, enabled = true } = options;
  const member = useCurrentMember();
  const [plots, setPlots] = useState<MemberPlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!enabled || !member?.member_id) {
      setPlots([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const token = await getBearerToken();
      const request = buildMemberPlotsRequest(token, member.line_user_id);
      if (!request) {
        setError(SESSION_EXPIRED_MESSAGE);
        setPlots([]);
        return;
      }

      const response = await fetch(request.url, { headers: request.headers });
      const payload = (await response.json()) as MemberPlotsResponse;
      if (!response.ok) {
        setError(payload.error ?? 'ไม่สามารถโหลดแปลงได้');
        setPlots([]);
        return;
      }
      setPlots(payload.plots ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setPlots([]);
    } finally {
      setLoading(false);
    }
  }, [enabled, member?.line_user_id, member?.member_id]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const context = useMemo(
    () => resolvePlotContext(plots, selectedPlotId),
    [plots, selectedPlotId],
  );

  return { plots, loading, error, refresh, ...context };
}
