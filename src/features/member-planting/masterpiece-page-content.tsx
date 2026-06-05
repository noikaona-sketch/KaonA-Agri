'use client';

import { useEffect, useState }   from 'react';
import { useAuth, useCurrentMember } from '@/providers/auth-provider';
import { MobileAppShell }        from '@/shared/components/mobile-app-shell';
import { LoadingState }          from '@/shared/components/loading-state';
import { ProtectedRoute }        from '@/shared/components/protected-route';
import { MasterpieceCard }       from '@/features/member-planting/masterpiece-card';
import { tryCreateSupabaseBrowserClient } from '@/lib/supabase/client';

type CycleInfo = {
  id: string; crop_name: string; season_year: number;
  status: string; planted_at: string | null;
};
type PlotInfo = { id: string; name: string };

function MasterpieceContent({ plotId }: { plotId: string }) {
  const { status } = useAuth();
  const member     = useCurrentMember();

  const [plot,    setPlot]    = useState<PlotInfo | null>(null);
  const [cycle,   setCycle]   = useState<CycleInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const sb = tryCreateSupabaseBrowserClient();
    if (!sb || !plotId) return;

    void Promise.all([
      // Load plot info
      sb.from('plots').select('id,name').eq('id', plotId).maybeSingle(),
      // Load active cycle for this plot
      sb.from('planting_cycles')
        .select('id,crop_name,season_year,status,planted_at')
        .eq('plot_id', plotId)
        .in('status', ['growing','confirmed','flowering','maturing','ready','pending'])
        .order('created_at', { ascending: false })
        .limit(1),
    ]).then(([plotRes, cycleRes]) => {
      setPlot(plotRes.data as PlotInfo | null);
      setCycle((cycleRes.data as CycleInfo[])?.[0] ?? null);
      setLoading(false);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plotId]);

  if (status === 'loading' || loading) return <LoadingState label="กำลังโหลด…" />;
  if (!member) return null;

  return (
    <MobileAppShell
      title="🏆 ผลงานชิ้นเอก"
      subtitle={plot?.name ?? 'แปลงของฉัน'}
    >
      <MasterpieceCard
        plotId={plotId}
        cycle={cycle}
        member={member}
      />
    </MobileAppShell>
  );
}

export function MasterpiecePageContent({ plotId }: { plotId: string }) {
  return (
    <ProtectedRoute allowedRoles={['farmer', 'leader', 'admin']}>
      <MasterpieceContent plotId={plotId} />
    </ProtectedRoute>
  );
}

