'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams }      from 'next/navigation';
import { ProtectedRoute }       from '@/shared/components/protected-route';
import { MobileAppShell }       from '@/shared/components/mobile-app-shell';
import { tryCreateSupabaseBrowserClient } from '@/lib/supabase/client';
import Link from 'next/link';

type Member = { id: string; full_name: string; phone: string | null; province: string | null };
type Cycle  = {
  id: string; crop_name: string; season_year: number;
  planted_at: string | null; expected_harvest_at: string | null; status: string;
  plots: { name: string; area_rai: number | null } | null;
  planting_seasons: { name: string } | null;
};

const STATUS_TH: Record<string, { label: string; color: string }> = {
  planned:    { label: '📅 วางแผน',       color: '#6b7280' },
  planting:   { label: '🌱 กำลังปลูก',    color: '#059669' },
  growing:    { label: '🌿 กำลังเติบโต',  color: '#2e7d32' },
  harvested:  { label: '🌾 เก็บเกี่ยวแล้ว', color: '#d97706' },
  cancelled:  { label: '⛔ ยกเลิก',       color: '#dc2626' },
};

const S = {
  input: { padding: '10px 14px', border: '1.5px solid #e5e7eb', borderRadius: 10, fontSize: 14, width: '100%', background: '#fff' } as React.CSSProperties,
};

function StaffPlantingInner() {
  const searchParams  = useSearchParams();
  const initMemberId  = searchParams.get('member_id') ?? '';

  const [search,    setSearch]    = useState('');
  const [members,   setMembers]   = useState<Member[]>([]);
  const [searching, setSearching] = useState(false);
  const [selected,  setSelected]  = useState<Member | null>(null);
  const [cycles,    setCycles]    = useState<Cycle[]>([]);
  const [loading,   setLoading]   = useState(false);

  // Load member if member_id in URL
  useEffect(() => {
    if (!initMemberId) return;
    const sb = tryCreateSupabaseBrowserClient();
    if (!sb) return;
    void sb.from('members').select('id,full_name,phone,province')
      .eq('id', initMemberId).maybeSingle()
      .then(({ data }) => { if (data) selectMember(data as Member); });
  }, [initMemberId]);

  async function searchMembers(q: string) {
    if (q.trim().length < 2) { setMembers([]); return; }
    setSearching(true);
    const sb = tryCreateSupabaseBrowserClient();
    if (!sb) return;
    const { data } = await sb.from('members')
      .select('id,full_name,phone,province')
      .eq('status', 'approved')
      .or(`full_name.ilike.%${q}%,phone.ilike.%${q}%`)
      .limit(10);
    setMembers((data as Member[]) ?? []);
    setSearching(false);
  }

  async function selectMember(m: Member) {
    setSelected(m); setMembers([]); setSearch(m.full_name); setLoading(true);
    const sb = tryCreateSupabaseBrowserClient();
    if (!sb) { setLoading(false); return; }
    const { data } = await sb.from('planting_cycles')
      .select('id,crop_name,season_year,planted_at,expected_harvest_at,status,plots(name,area_rai),planting_seasons(name)')
      .eq('member_id', m.id)
      .order('season_year', { ascending: false })
      .order('planted_at',  { ascending: false })
      .limit(20);
    setCycles((data as unknown as Cycle[]) ?? []);
    setLoading(false);
  }

  function fmtDate(d: string | null) {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  return (
    <ProtectedRoute allowedRoles={['staff','inspector','leader','admin']}>
      <MobileAppShell title="รอบการปลูก" subtitle="เลือกสมาชิกเพื่อดูรอบการปลูก">
        <div style={{ display: 'grid', gap: 14, paddingBottom: 24 }}>

          <Link href="/" style={{ color: 'var(--primary,#2e7d32)', fontWeight: 700, fontSize: 14, textDecoration: 'none' }}>
            ← กลับหน้าแรก
          </Link>

          {/* Search member */}
          <div style={{ display: 'grid', gap: 8 }}>
            <label style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>
              ค้นหาสมาชิก (ชื่อ หรือ เบอร์โทร)
            </label>
            <input style={S.input} value={search}
              onChange={(e) => { setSearch(e.target.value); void searchMembers(e.target.value); }}
              placeholder="พิมพ์ชื่อหรือเบอร์โทร…" />

            {/* Results dropdown */}
            {members.length > 0 && (
              <div style={{ background: '#fff', border: '1.5px solid #e5e7eb', borderRadius: 10, overflow: 'hidden', boxShadow: '0 4px 12px rgba(0,0,0,.08)' }}>
                {members.map((m) => (
                  <button key={m.id} onClick={() => void selectMember(m)}
                    style={{ width: '100%', padding: '11px 14px', background: 'none', border: 'none', borderBottom: '1px solid #f3f4f6', cursor: 'pointer', textAlign: 'left', display: 'flex', justifyContent: 'space-between' }}>
                    <div>
                      <p style={{ margin: 0, fontWeight: 700, fontSize: 14 }}>{m.full_name}</p>
                      {m.phone && <p style={{ margin: 0, fontSize: 12, color: '#6b7280' }}>📞 {m.phone}</p>}
                    </div>
                    {m.province && <span style={{ fontSize: 12, color: '#9ca3af', alignSelf: 'center' }}>{m.province}</span>}
                  </button>
                ))}
              </div>
            )}
            {searching && <p style={{ margin: 0, fontSize: 12, color: '#9ca3af' }}>กำลังค้นหา…</p>}
          </div>

          {/* Selected member + cycles */}
          {selected && (
            <>
              <div style={{ background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 12, padding: '12px 14px' }}>
                <p style={{ margin: 0, fontWeight: 800, fontSize: 15 }}>{selected.full_name}</p>
                {selected.phone && <p style={{ margin: '2px 0 0', fontSize: 13, color: '#6b7280' }}>📞 {selected.phone}</p>}
                {selected.province && <p style={{ margin: '2px 0 0', fontSize: 12, color: '#6b7280' }}>📍 {selected.province}</p>}
              </div>

              {loading && <p style={{ textAlign: 'center', color: '#9ca3af', padding: 20 }}>กำลังโหลด…</p>}

              {!loading && cycles.length === 0 && (
                <div style={{ textAlign: 'center', padding: '28px 0', color: '#9ca3af' }}>
                  <p style={{ fontSize: 28, margin: '0 0 8px' }}>🌱</p>
                  <p style={{ margin: 0, fontSize: 13 }}>ยังไม่มีรอบการปลูก</p>
                </div>
              )}

              {!loading && cycles.map((c) => {
                const st = STATUS_TH[c.status] ?? { label: c.status, color: '#6b7280' };
                return (
                  <div key={c.id} style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: '13px 15px', display: 'grid', gap: 8 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        <p style={{ margin: 0, fontWeight: 700, fontSize: 15 }}>{c.crop_name}</p>
                        <p style={{ margin: '2px 0 0', fontSize: 12, color: '#6b7280' }}>
                          ปี {c.season_year}
                          {c.plots ? ` · 🌱 ${c.plots.name}${c.plots.area_rai ? ` (${c.plots.area_rai} ไร่)` : ''}` : ''}
                        </p>
                        {c.planting_seasons && (
                          <p style={{ margin: '2px 0 0', fontSize: 12, color: '#059669' }}>📅 {c.planting_seasons.name}</p>
                        )}
                      </div>
                      <span style={{ fontSize: 12, padding: '3px 10px', borderRadius: 20, background: st.color + '18', color: st.color, fontWeight: 700, whiteSpace: 'nowrap' }}>
                        {st.label}
                      </span>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, background: '#f9fafb', borderRadius: 8, padding: '8px 10px' }}>
                      <div>
                        <p style={{ margin: 0, fontSize: 11, color: '#9ca3af' }}>วันปลูก</p>
                        <p style={{ margin: 0, fontSize: 13, fontWeight: 600 }}>{fmtDate(c.planted_at)}</p>
                      </div>
                      <div>
                        <p style={{ margin: 0, fontSize: 11, color: '#9ca3af' }}>คาดเก็บเกี่ยว</p>
                        <p style={{ margin: 0, fontSize: 13, fontWeight: 600 }}>{fmtDate(c.expected_harvest_at)}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </>
          )}

          {!selected && (
            <div style={{ textAlign: 'center', padding: '40px 0', color: '#9ca3af' }}>
              <p style={{ fontSize: 36, margin: '0 0 10px' }}>🌽</p>
              <p style={{ margin: 0, fontSize: 13 }}>ค้นหาสมาชิกเพื่อดูรอบการปลูก</p>
            </div>
          )}

        </div>
      </MobileAppShell>
    </ProtectedRoute>
  );
}

function StaffPlantingInner() {
  return (
    <Suspense fallback={<div style={{ padding: 24, textAlign: 'center', color: '#9ca3af' }}>กำลังโหลด…</div>}>
      <StaffPlantingInner />
    </Suspense>
  );
}

export default function StaffPlantingPage() {
  return (
    <Suspense fallback={<div style={{ padding: 32, textAlign: 'center', color: '#9ca3af' }}>กำลังโหลด…</div>}>
      <StaffPlantingInner />
    </Suspense>
  );
}
