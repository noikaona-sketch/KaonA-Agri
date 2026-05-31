'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { MobileAppShell }              from '@/shared/components/mobile-app-shell';
import { ProtectedRoute }              from '@/shared/components/protected-route';
import { LoadingState }                from '@/shared/components/loading-state';
import { FarmActivityChecklist }       from '@/features/farm-activity/farm-activity-checklist';

type CycleBasic = {
  id: string; crop_name: string; season_year: number; status: string;
  plots:    { id: string; name: string } | null;
  products: {
    fertilizer_guide: string | null;
    planting_guide:   string | null;
    pest_guide?:      string | null;
  } | null;
};

type Props = { params: { id: string } };

function ActivityPageContent({ params }: Props) {
  const [cycle, setCycle] = useState<CycleBasic | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      const sb = createSupabaseBrowserClient();
      const { data } = await sb.from('planting_cycles')
        .select('id,crop_name,season_year,status,plots(id,name),products(fertilizer_guide,planting_guide)')
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

  const products = Array.isArray(cycle?.products)
    ? (cycle?.products as { fertilizer_guide: string | null; planting_guide: string | null; pest_guide?: string | null }[])[0]
    : cycle?.products;

  return (
    <MobileAppShell
      title={cycle ? `${cycle.crop_name} ${cycle.season_year}` : 'บันทึกกิจกรรม'}
      subtitle={plotName ? `แปลง: ${plotName}` : 'ติดตามกิจกรรมประจำวัน'}
    >
      <div style={{ paddingBottom: 32 }}>
        <Link href={`/planting-cycles/${params.id}`}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: 'var(--primary)', fontWeight: 700, fontSize: 14, textDecoration: 'none', marginBottom: 8 }}>
          ← รอบปลูก
        </Link>

        {cycle && (
          <FarmActivityChecklist
            cycleId={params.id}
            plotId={plotId}
            seedHint={products ?? null}
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
