'use client';

import { useEffect, useState } from 'react';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { LoadingState } from '@/shared/components/loading-state';

type ProviderSummary = {
  member_id: string; full_name: string; phone: string | null;
  total_ratings: number;
  avg_punctuality: number | null; avg_quality: number | null;
  avg_loss: number | null; avg_cleanliness: number | null;
  avg_safety: number | null; avg_total: number | null;
  overall_grade: string | null; last_rated_at: string | null;
};

type RatingDetail = {
  id: string; score_punctuality: number; score_quality: number;
  score_loss: number; score_cleanliness: number; score_safety: number;
  score_total: number; grade: string; note: string | null; created_at: string;
  rated_by: { full_name: string }[] | null;
};

const GRADE_CFG: Record<string, { color: string; bg: string }> = {
  'A+': { color: '#1b5e20', bg: '#e8f5e9' },
  'A':  { color: '#2e7d32', bg: '#f1f8f1' },
  'B+': { color: '#1565c0', bg: '#e3f2fd' },
  'B':  { color: '#1976d2', bg: '#e8f0fe' },
  'C':  { color: '#e65100', bg: '#fff3e0' },
};

const SCORE_DIMS = [
  { key: 'avg_punctuality',  label: '⏰ ตรงเวลา' },
  { key: 'avg_quality',      label: '⭐ คุณภาพ' },
  { key: 'avg_loss',         label: '📉 ความสูญเสีย' },
  { key: 'avg_cleanliness',  label: '🧹 ความสะอาด' },
  { key: 'avg_safety',       label: '🦺 ความปลอดภัย' },
];

function Stars({ score }: { score: number | null }) {
  if (!score) return <span style={{ color: '#9ca3af' }}>—</span>;
  const full = Math.floor(score);
  const half = score - full >= 0.5;
  return (
    <span style={{ fontSize: 14, letterSpacing: 1 }}>
      {'★'.repeat(full)}{'☆'.repeat(half ? 0 : 5 - full)}
      {half && '½'}
      <span style={{ fontSize: 12, marginLeft: 4, color: '#6b7280' }}>{score.toFixed(1)}</span>
    </span>
  );
}

export function AdminProviderRatings() {
  const [providers, setProviders] = useState<ProviderSummary[]>([]);
  const [loading, setLoading]     = useState(true);
  const [selected, setSelected]   = useState<ProviderSummary | null>(null);
  const [details, setDetails]     = useState<RatingDetail[]>([]);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [search, setSearch]       = useState('');

  useEffect(() => {
    void (async () => {
      const s = createSupabaseBrowserClient();
      const { data } = await s.from('provider_rating_summary').select('*');
      setProviders((data as ProviderSummary[]) ?? []);
      setLoading(false);
    })();
  }, []);

  async function loadDetail(memberId: string) {
    setLoadingDetail(true);
    const s = createSupabaseBrowserClient();
    const { data } = await s.from('service_provider_ratings')
      .select('id,score_punctuality,score_quality,score_loss,score_cleanliness,score_safety,score_total,grade,note,created_at,rated_by:rated_by_member_id(full_name)')
      .eq('provider_member_id', memberId)
      .order('created_at', { ascending: false });
    setDetails((data as RatingDetail[]) ?? []);
    setLoadingDetail(false);
  }

  const filtered = providers.filter((p) =>
    !search || p.full_name.includes(search) || (p.phone ?? '').includes(search)
  );

  return (
    <div style={{ display: 'grid', gridTemplateColumns: selected ? '1fr 380px' : '1fr', gap: 20 }}>

      {/* Left: list */}
      <div>
        <div className="admin-filter-bar">
          <input className="admin-search" placeholder="ค้นหาชื่อ/เบอร์…"
            value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>

        {loading && <LoadingState label="กำลังโหลด…" />}

        {!loading && (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>ผู้ให้บริการ</th>
                  <th>Grade</th>
                  <th>คะแนนเฉลี่ย</th>
                  <th>⏰</th><th>⭐</th><th>📉</th><th>🧹</th><th>🦺</th>
                  <th>จำนวน</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr><td colSpan={9} style={{ textAlign: 'center', color: '#9ca3af', padding: 32 }}>ยังไม่มีข้อมูล</td></tr>
                )}
                {filtered.map((p) => {
                  const g = GRADE_CFG[p.overall_grade ?? 'C'] ?? GRADE_CFG.C;
                  return (
                    <tr key={p.member_id} style={{ cursor: 'pointer', background: selected?.member_id === p.member_id ? '#f1f8f1' : undefined }}
                      onClick={() => { setSelected(p); void loadDetail(p.member_id); }}>
                      <td>
                        <p style={{ margin: 0, fontWeight: 700 }}>{p.full_name}</p>
                        <p style={{ margin: 0, fontSize: 12, color: '#6b7280' }}>{p.phone ?? '—'}</p>
                      </td>
                      <td>
                        <span style={{ fontWeight: 900, fontSize: 18, padding: '4px 12px', borderRadius: 8, background: g.bg, color: g.color }}>
                          {p.overall_grade ?? '—'}
                        </span>
                      </td>
                      <td><Stars score={p.avg_total} /></td>
                      <td style={{ fontSize: 13 }}>{p.avg_punctuality?.toFixed(1) ?? '—'}</td>
                      <td style={{ fontSize: 13 }}>{p.avg_quality?.toFixed(1) ?? '—'}</td>
                      <td style={{ fontSize: 13 }}>{p.avg_loss?.toFixed(1) ?? '—'}</td>
                      <td style={{ fontSize: 13 }}>{p.avg_cleanliness?.toFixed(1) ?? '—'}</td>
                      <td style={{ fontSize: 13 }}>{p.avg_safety?.toFixed(1) ?? '—'}</td>
                      <td style={{ fontWeight: 700, color: '#6b7280' }}>{p.total_ratings}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Right: detail */}
      {selected && (
        <div style={{ background: '#f7faf7', border: '1px solid #e4ebe4', borderRadius: 14, padding: 20, display: 'grid', gap: 16, alignContent: 'start' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <div>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>{selected.full_name}</h3>
              <p style={{ margin: '2px 0 0', fontSize: 13, color: '#6b7280' }}>{selected.phone}</p>
            </div>
            <button onClick={() => setSelected(null)} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#6b7280' }}>×</button>
          </div>

          {/* Radar summary */}
          <div style={{ background: '#fff', borderRadius: 12, padding: 16, border: '1px solid #e4ebe4' }}>
            <p style={{ margin: '0 0 12px', fontWeight: 700, fontSize: 14 }}>📊 คะแนนเฉลี่ยรายด้าน</p>
            {SCORE_DIMS.map((d) => {
              const val = (selected as Record<string, number | null>)[d.key] ?? 0;
              const pct = ((val / 5) * 100).toFixed(0);
              return (
                <div key={d.key} style={{ marginBottom: 8 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3, fontSize: 13 }}>
                    <span>{d.label}</span>
                    <span style={{ fontWeight: 700 }}>{val ? val.toFixed(1) : '—'} / 5</span>
                  </div>
                  <div style={{ height: 8, background: '#e4ebe4', borderRadius: 4, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${pct}%`, background: Number(pct) >= 80 ? '#2e7d32' : Number(pct) >= 60 ? '#1565c0' : '#e65100', borderRadius: 4 }} />
                  </div>
                </div>
              );
            })}
          </div>

          {/* History */}
          <p style={{ margin: 0, fontWeight: 700, fontSize: 14 }}>📋 ประวัติการประเมิน ({details.length})</p>
          {loadingDetail && <LoadingState label="กำลังโหลด…" />}
          {!loadingDetail && details.map((r) => {
            const g = GRADE_CFG[r.grade] ?? GRADE_CFG.C;
            return (
              <div key={r.id} style={{ background: '#fff', borderRadius: 10, padding: '12px 14px', border: '1px solid #e4ebe4' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <span style={{ fontWeight: 800, fontSize: 16, padding: '2px 10px', borderRadius: 6, background: g.bg, color: g.color }}>{r.grade}</span>
                  <span style={{ fontSize: 12, color: '#6b7280' }}>
                    {new Date(r.created_at).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 4, marginBottom: 6 }}>
                  {[
                    { label: '⏰', val: r.score_punctuality },
                    { label: '⭐', val: r.score_quality },
                    { label: '📉', val: r.score_loss },
                    { label: '🧹', val: r.score_cleanliness },
                    { label: '🦺', val: r.score_safety },
                  ].map((s) => (
                    <div key={s.label} style={{ textAlign: 'center', background: '#f7faf7', borderRadius: 6, padding: '4px 2px' }}>
                      <div style={{ fontSize: 14 }}>{s.label}</div>
                      <div style={{ fontWeight: 800, fontSize: 15 }}>{s.val}</div>
                    </div>
                  ))}
                </div>
                {r.note && <p style={{ margin: 0, fontSize: 12, color: '#6b7280', fontStyle: 'italic' }}>"{r.note}"</p>}
                {r.rated_by?.[0] && <p style={{ margin: '4px 0 0', fontSize: 12, color: '#9ca3af' }}>ประเมินโดย {r.rated_by[0].full_name}</p>}
              </div>
            );
          })}
          {!loadingDetail && details.length === 0 && (
            <p style={{ textAlign: 'center', color: '#9ca3af', fontSize: 13 }}>ยังไม่มีการประเมิน</p>
          )}
        </div>
      )}
    </div>
  );
}
