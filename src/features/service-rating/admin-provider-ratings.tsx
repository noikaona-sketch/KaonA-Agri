'use client';

import { useEffect, useState } from 'react';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { LoadingState } from '@/shared/components/loading-state';

type ProviderSummary = {
  member_id: string; full_name: string; phone: string | null;
  total_ratings: number;
  avg_punctuality: number | null; avg_quality: number | null;
  avg_loss: number | null; avg_cleanliness: number | null; avg_safety: number | null;
  avg_total: number | null; overall_grade: string | null;
  last_rated_at: string | null;
};

const GRADE_CFG: Record<string, { bg: string; color: string }> = {
  'A+': { bg: '#e8f5e9', color: '#1b5e20' },
  'A':  { bg: '#e8f5e9', color: '#2e7d32' },
  'B+': { bg: '#e3f2fd', color: '#1565c0' },
  'B':  { bg: '#fff8e1', color: '#e65100' },
  'C':  { bg: '#ffebee', color: '#c62828' },
};

function Stars({ score }: { score: number | null }) {
  if (!score) return <span style={{ color: '#9ca3af', fontSize: 12 }}>—</span>;
  return (
    <span style={{ fontSize: 13 }}>
      {'⭐'.repeat(Math.round(score))}{'☆'.repeat(5 - Math.round(score))}
      <span style={{ marginLeft: 4, fontSize: 12, color: 'var(--text-secondary)' }}>{score.toFixed(1)}</span>
    </span>
  );
}

export function AdminProviderRatings() {
  const [providers, setProviders] = useState<ProviderSummary[]>([]);
  const [loading, setLoading]     = useState(true);
  const [selected, setSelected]   = useState<ProviderSummary | null>(null);

  useEffect(() => {
    void (async () => {
      const s = createSupabaseBrowserClient();
      const { data } = await s.from('provider_rating_summary').select('*');
      setProviders((data as ProviderSummary[]) ?? []);
      setLoading(false);
    })();
  }, []);

  if (loading) return <LoadingState label="กำลังโหลด…" />;

  return (
    <div>
      {/* summary stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: 20 }}>
        {(['A+','A','B+','B','C'] as const).map((g) => {
          const count = providers.filter((p) => p.overall_grade === g).length;
          const cfg = GRADE_CFG[g];
          return (
            <div key={g} style={{ background: cfg.bg, border: `1.5px solid ${cfg.color}44`, borderRadius: 12, padding: '12px 16px', textAlign: 'center' }}>
              <p style={{ margin: 0, fontSize: 22, fontWeight: 900, color: cfg.color }}>{g}</p>
              <p style={{ margin: '2px 0 0', fontSize: 13, color: 'var(--text-secondary)' }}>{count} คน</p>
            </div>
          );
        })}
        <div style={{ background: '#f5f5f5', borderRadius: 12, padding: '12px 16px', textAlign: 'center' }}>
          <p style={{ margin: 0, fontSize: 22, fontWeight: 900, color: '#9e9e9e' }}>—</p>
          <p style={{ margin: '2px 0 0', fontSize: 13, color: 'var(--text-secondary)' }}>{providers.filter((p) => !p.overall_grade || p.total_ratings === 0).length} คน</p>
        </div>
      </div>

      {/* table */}
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>ผู้ให้บริการ</th>
              <th>เกรด</th>
              <th>ตรงเวลา</th>
              <th>คุณภาพ</th>
              <th>สูญเสีย</th>
              <th>สะอาด</th>
              <th>ปลอดภัย</th>
              <th>รวม</th>
              <th>ประเมิน</th>
            </tr>
          </thead>
          <tbody>
            {providers.length === 0 && (
              <tr><td colSpan={9} style={{ textAlign: 'center', color: '#9ca3af', padding: 32 }}>ยังไม่มีข้อมูลการประเมิน</td></tr>
            )}
            {providers.map((p) => {
              const cfg = p.overall_grade ? GRADE_CFG[p.overall_grade] : null;
              return (
                <tr key={p.member_id} onClick={() => setSelected(selected?.member_id === p.member_id ? null : p)}
                  style={{ cursor: 'pointer', background: selected?.member_id === p.member_id ? '#f8fbf8' : undefined }}>
                  <td>
                    <p style={{ margin: 0, fontWeight: 700 }}>{p.full_name}</p>
                    <p style={{ margin: 0, fontSize: 12, color: '#6b7280' }}>{p.phone ?? '—'}</p>
                  </td>
                  <td>
                    {cfg ? (
                      <span style={{ fontSize: 18, fontWeight: 900, padding: '4px 12px', borderRadius: 8, background: cfg.bg, color: cfg.color }}>
                        {p.overall_grade}
                      </span>
                    ) : (
                      <span style={{ fontSize: 13, color: '#9ca3af' }}>ยังไม่มี</span>
                    )}
                  </td>
                  <td><Stars score={p.avg_punctuality} /></td>
                  <td><Stars score={p.avg_quality} /></td>
                  <td><Stars score={p.avg_loss} /></td>
                  <td><Stars score={p.avg_cleanliness} /></td>
                  <td><Stars score={p.avg_safety} /></td>
                  <td style={{ fontWeight: 800, fontSize: 16 }}>{p.avg_total?.toFixed(1) ?? '—'}</td>
                  <td style={{ fontSize: 12, color: '#6b7280' }}>{p.total_ratings} ครั้ง</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* detail panel */}
      {selected && (
        <div className="kaona-card" style={{ marginTop: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
            <p style={{ margin: 0, fontWeight: 700, fontSize: 15 }}>📊 รายละเอียด — {selected.full_name}</p>
            <button onClick={() => setSelected(null)} style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: '#6b7280' }}>×</button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {[
              { label: '⏰ ตรงเวลา',      score: selected.avg_punctuality },
              { label: '🌾 คุณภาพงาน',    score: selected.avg_quality },
              { label: '📉 ความสูญเสีย',  score: selected.avg_loss },
              { label: '✨ ความสะอาด',    score: selected.avg_cleanliness },
              { label: '🦺 ความปลอดภัย',  score: selected.avg_safety },
            ].map(({ label, score }) => (
              <div key={label} style={{ background: '#f7faf7', borderRadius: 10, padding: '10px 12px' }}>
                <p style={{ margin: 0, fontSize: 13, color: 'var(--text-secondary)' }}>{label}</p>
                <div style={{ marginTop: 4 }}><Stars score={score} /></div>
              </div>
            ))}
          </div>
          {selected.last_rated_at && (
            <p style={{ margin: '10px 0 0', fontSize: 12, color: '#9ca3af' }}>
              ประเมินล่าสุด: {new Date(selected.last_rated_at).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' })}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
