'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { MobileAppShell }  from '@/shared/components/mobile-app-shell';
import { ProtectedRoute }  from '@/shared/components/protected-route';
import { LoadingState }    from '@/shared/components/loading-state';
import { FarmJournal }     from '@/features/farm-journal/farm-journal';

type CycleBasic = {
  id: string; crop_name: string; season_year: number; status: string;
  planted_at: string | null;
  plots:    { id: string; name: string } | null;
  products: { days_to_harvest: number | null } | null;
};

type Props = { params: { id: string } };

function ActivityPageContent({ params }: Props) {
  const [cycle,   setCycle]   = useState<CycleBasic | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      const sb = createSupabaseBrowserClient();
      const { data } = await sb.from('planting_cycles')
        .select('id,crop_name,season_year,status,planted_at,plots(id,name),products(days_to_harvest)')
        .eq('id', params.id).maybeSingle();
      setCycle(data as unknown as CycleBasic);
      setLoading(false);
    })();
  }, [params.id]);

  if (loading) return <LoadingState label="กำลังโหลด…" />;

  const plotId = Array.isArray(cycle?.plots)
    ? (cycle?.plots as { id: string }[])[0]?.id
    : (cycle?.plots as { id: string } | null)?.id ?? null;

  const plotName = Array.isArray(cycle?.plots)
    ? (cycle?.plots as { name: string }[])[0]?.name
    : (cycle?.plots as { name: string } | null)?.name ?? '';

  const dth = Array.isArray(cycle?.products)
    ? (cycle?.products as { days_to_harvest: number | null }[])[0]?.days_to_harvest
    : cycle?.products?.days_to_harvest ?? null;

  return (
    <MobileAppShell
      title={cycle ? `${cycle.crop_name} ${cycle.season_year}` : 'สมุดแปลง'}
      subtitle={plotName ? `แปลง: ${plotName}` : 'ติดตามการปลูกตลอดรอบ'}
    >
      <div style={{ paddingBottom: 40 }}>
        <Link href={`/planting-cycles/${params.id}`}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: 'var(--primary)', fontWeight: 700, fontSize: 14, textDecoration: 'none', marginBottom: 12 }}>
          ← รอบปลูก
        </Link>

        {cycle && (
          <FarmJournal
            cycleId={params.id}
            plotId={plotId}
            plantedAt={cycle.planted_at}
            cropType={cycle.crop_name}
            daysToHarvest={dth}
          />
        )}
      </div>
    </MobileAppShell>
  );
}

export default function CycleActivityPage({ params }: Props) {
  return (
    <ProtectedRoute allowedRoles={['farmer', 'leader', 'admin']}>
      <ActivityPageContent params={params} />
    </ProtectedRoute>
  );
}
