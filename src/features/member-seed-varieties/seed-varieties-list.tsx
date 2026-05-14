'use client';

import { useEffect, useState } from 'react';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { LoadingState } from '@/shared/components/loading-state';
import { SeedVarietyCard } from './seed-variety-card';
import type { SeedVarietyDetail } from './seed-variety-card';

type Props = {
  onSelect?: (variety: SeedVarietyDetail) => void;
  selectLabel?: string;
};

export function SeedVarietiesList({ onSelect, selectLabel }: Props) {
  const [varieties, setVarieties] = useState<SeedVarietyDetail[]>([]);
  const [loading, setLoading]     = useState(true);
  const [search, setSearch]       = useState('');

  useEffect(() => {
    void (async () => {
      const s = createSupabaseBrowserClient();
      const { data } = await s
        .from('seed_varieties')
        .select('*,seed_suppliers(supplier_name)')
        .eq('show_to_farmer', true)
        .eq('active_status', 'active')
        .order('sort_order')
        .order('variety_name');
      setVarieties((data as SeedVarietyDetail[]) ?? []);
      setLoading(false);
    })();
  }, []);

  const filtered = varieties.filter((v) =>
    !search || v.variety_name.toLowerCase().includes(search.toLowerCase()) ||
    v.crop_type.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) return <LoadingState label="กำลังโหลดพันธุ์เมล็ด…" />;

  return (
    <div className="mobile-stack">
      <input className="reg-input" placeholder="🔍 ค้นหาพันธุ์…"
        value={search} onChange={(e) => setSearch(e.target.value)} />

      {filtered.length === 0 && (
        <div style={{ textAlign: 'center', padding: '32px 0', color: '#9ca3af' }}>
          <div style={{ fontSize: 48 }}>🌾</div>
          <p style={{ margin: '8px 0 0' }}>ยังไม่มีพันธุ์เมล็ด</p>
        </div>
      )}

      {filtered.map((v) => (
        <SeedVarietyCard
          key={v.id}
          variety={v}
          onSelect={onSelect ? () => onSelect(v) : undefined}
          selectLabel={selectLabel}
        />
      ))}
    </div>
  );
}
