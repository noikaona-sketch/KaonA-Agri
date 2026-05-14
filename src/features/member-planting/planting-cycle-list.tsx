'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { useCurrentMember } from '@/providers/auth-provider';
import { LoadingState } from '@/shared/components/loading-state';
import { UIButton } from '@/shared/components/ui-button';

type Cycle = {
  id: string; crop_name: string; season_year: number; status: string;
  planted_at: string | null; expected_harvest_at: string | null;
  area_planted_rai: number | null; estimated_yield_kg: number | null;
  quota_kg: number | null; source: string | null;
  confirmed_at: string | null;
  products: { name: string; seed_variety: string | null }[] | null;
  plots: { name: string }[] | null;
};

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon: string }> = {
  planned:   { label: 'วางแผน',      color: '#1565c0', bg: '#e3f2fd', icon: '📋' },
  planted:   { label: 'ปลูกแล้ว',    color: '#2e7d32', bg: '#e8f5e9', icon: '🌱' },
  growing:   { label: 'กำลังโต',     color: '#388e3c', bg: '#f1f8e9', icon: '🌿' },
  flowering: { label: 'ออกดอก',      color: '#f57f17', bg: '#fff8e1', icon: '🌸' },
  maturing:  { label: 'กำลังแก่',    color: '#e65100', bg: '#fff3e0', icon: '🌽' },
  ready:     { label: 'พร้อมเก็บ',   color: '#c62828', bg: '#ffebee', icon: '✅' },
  harvested: { label: 'เก็บเกี่ยว',  color: '#9e9e9e', bg: '#f5f5f5', icon: '🏁' },
  cancelled: { label: 'ยกเลิก',      color: '#9e9e9e', bg: '#f5f5f5', icon: '⛔' },
};

function daysUntil(dateStr: string | null): number | null {
  if (!dateStr) return null;
  return Math.round((new Date(dateStr).getTime() - Date.now()) / 86400000);
}

export function PlantingCycleList() {
  const member = useCurrentMember();
  const memberId = member?.member_id;
  const [cycles, setCycles]   = useState<Cycle[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeOnly, setActiveOnly] = useState(true);

  useEffect(() => {
    if (!memberId) {
      setLoading(false);
      return;
    }
    void (async () => {
      setLoading(true);
      const s = createSupabaseBrowserClient();
      let q = s.from('planting_cycles')
        .select('id,crop_name,season_year,status,planted_at,expected_harvest_at,area_planted_rai,estimated_yield_kg,quota_kg,source,confirmed_at,products(name,seed_variety),plots(name)')
        .eq('member_id', memberId)
        .order('created_at', { ascending: false });
      if (activeOnly) q = q.not('status', 'in', '("harvested","cancelled")');
      const { data } = await q;
      setCycles((data as unknown as Cycle[]) ?? []);
      setLoading(false);
    })();
  }, [memberId, activeOnly]);

  if (loading) return <LoadingState label="กำลังโหลด…" />;

  return (
    <div className="mobile-stack">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: 8 }}>
          {[['กำลังปลูก', true], ['ทั้งหมด', false]].map(([label, val]) => (
            <button key={String(label)} onClick={() => setActiveOnly(val as boolean)}
              style={{ padding: '8px 16px', borderRadius: 999, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 700, background: activeOnly === val ? 'var(--primary)' : '#f0f4f0', color: activeOnly === val ? '#fff' : 'var(--text-secondary)' }}>
              {String(label)}
            </button>
          ))}
        </div>
        <Link href="/planting-cycles/new">
          <UIButton style={{ padding: '8px 14px', fontSize: 13, minHeight: 38 }}>+ สร้างใหม่</UIButton>
        </Link>
      </div>

      {cycles.length === 0 && (
        <div style={{ textAlign: 'center', padding: '32px 0' }}>
          <div style={{ fontSize: 48 }}>🌱</div>
          <p style={{ fontSize: 14, color: 'var(--text-secondary)', margin: '8px 0 0' }}>
            {activeOnly ? 'ไม่มีรอบปลูกที่กำลังดำเนินการ' : 'ยังไม่มีรอบปลูก'}
          </p>
        </div>
      )}

      {cycles.map((c) => {
        const st = STATUS_CONFIG[c.status] ?? STATUS_CONFIG.planned;
        const days = daysUntil(c.expected_harvest_at);
        const needConfirm = c.source === 'order' && !c.confirmed_at;

        return (
          <Link key={c.id} href={`/planting-cycles/${c.id}`} style={{ textDecoration: 'none' }}>
            <div className="plot-card" style={{ borderColor: needConfirm ? '#ffe082' : st.color + '44', background: needConfirm ? '#fffde7' : '#fff' }}>
              {needConfirm && (
                <div style={{ background: '#ffe082', borderRadius: 8, padding: '8px 12px', display: 'flex', gap: 8, alignItems: 'center' }}>
                  <span>⚠️</span>
                  <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: '#e65100' }}>ระบุแปลงและวันปลูก</p>
                </div>
              )}
              <div className="plot-card__header">
                <div style={{ flex: 1 }}>
                  <p style={{ margin: 0, fontWeight: 800, fontSize: 16 }}>
                    {st.icon} {c.crop_name} {c.season_year}
                  </p>
                  {c.products?.[0]?.seed_variety && <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--text-secondary)' }}>พันธุ์ {c.products[0].seed_variety}</p>}
                  {c.plots?.[0]?.name && <p style={{ margin: '2px 0 0', fontSize: 13, color: 'var(--text-secondary)' }}>📍 {c.plots[0].name}</p>}
                </div>
                <span style={{ fontSize: 12, fontWeight: 700, padding: '4px 10px', borderRadius: 999, background: st.bg, color: st.color, whiteSpace: 'nowrap' }}>
                  {st.label}
                </span>
              </div>

              <div className="plot-card__meta">
                {c.area_planted_rai && <span className="plot-card__tag">{c.area_planted_rai} ไร่</span>}
                {c.estimated_yield_kg && <span className="plot-card__tag">~{c.estimated_yield_kg.toLocaleString()} กก.</span>}
                {c.planted_at && <span className="plot-card__tag">ปลูก {new Date(c.planted_at).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })}</span>}
              </div>

              {days !== null && c.status !== 'harvested' && (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                      {days > 0 ? `เก็บเกี่ยวใน ${days} วัน` : days === 0 ? 'เก็บเกี่ยวได้วันนี้!' : 'ถึงวันเก็บเกี่ยวแล้ว'}
                    </span>
                    <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                      {c.expected_harvest_at ? new Date(c.expected_harvest_at).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' }) : ''}
                    </span>
                  </div>
                  {c.planted_at && c.expected_harvest_at && (
                    <div className="plot-card__progress-bar">
                      <div className="plot-card__progress-fill" style={{
                        width: `${Math.min(100, Math.max(0, 100 - (days / ((new Date(c.expected_harvest_at).getTime() - new Date(c.planted_at).getTime()) / 86400000)) * 100))}%`,
                        background: days <= 14 ? '#c62828' : days <= 30 ? '#e65100' : 'linear-gradient(90deg,#2e7d32,#66bb6a)',
                      }} />
                    </div>
                  )}
                </div>
              )}
            </div>
          </Link>
        );
      })}
    </div>
  );
}
