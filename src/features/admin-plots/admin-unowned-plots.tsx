'use client';

import { useEffect, useState } from 'react';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';

type UnownedPlot = {
  id: string; name: string; area_rai: number | null;
  province: string | null; district: string | null;
  lat: number | null; lng: number | null;
  crop_observed: string | null; observed_stage: string | null;
  observed_days_est: number | null; unowned_note: string | null;
  status: string; created_at: string;
  staff: { full_name: string } | null;
};

type Member = { id: string; full_name: string; phone: string | null };

const STAGE_TH: Record<string, string> = {
  seedling: '🌱 ต้นกล้า', growing: '🌿 กำลังเติบโต',
  mature: '🌾 ใกล้เก็บเกี่ยว', harvested: '✅ เก็บแล้ว', unknown: '❓ ไม่ทราบ',
};

const S = {
  card: { background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, overflow: 'hidden', marginBottom: 10 } as React.CSSProperties,
  input: { padding: '9px 12px', border: '1.5px solid #e5e7eb', borderRadius: 8, fontSize: 13, width: '100%', background: '#fff' } as React.CSSProperties,
};

export function AdminUnownedPlots() {
  const [plots,    setPlots]    = useState<UnownedPlot[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [assigning, setAssigning] = useState<string | null>(null); // plot id
  const [memberSearch, setMemberSearch] = useState('');
  const [memberResults, setMemberResults] = useState<Member[]>([]);
  const [assgnError, setAssgnError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const s = createSupabaseBrowserClient();
    const { data } = await s.from('plots')
      .select('id,name,area_rai,province,district,lat,lng,crop_observed,observed_stage,observed_days_est,unowned_note,status,created_at,staff:added_by_staff_id(full_name)')
      .is('member_id', null)
      .order('created_at', { ascending: false })
      .limit(100);
    setPlots((data as unknown as UnownedPlot[]) ?? []);
    setLoading(false);
  }

  useEffect(() => { void load(); }, []);

  async function searchMembers(q: string) {
    if (q.length < 2) { setMemberResults([]); return; }
    const s = createSupabaseBrowserClient();
    const { data } = await s.from('members').select('id,full_name,phone')
      .eq('status','approved').or(`full_name.ilike.%${q}%,phone.ilike.%${q}%`).limit(8);
    setMemberResults((data as Member[]) ?? []);
  }

  async function assignMember(plotId: string, memberId: string, memberName: string) {
    if (!window.confirm(`ระบุแปลงนี้ให้ ${memberName}?`)) return;
    setAssgnError(null);
    const s = createSupabaseBrowserClient();
    const { error } = await s.from('plots').update({
      member_id: memberId,
      assigned_to_member_at: new Date().toISOString(),
    }).eq('id', plotId);
    if (error) { setAssgnError(error.message); return; }
    setAssigning(null); setMemberSearch(''); setMemberResults([]);
    void load();
  }

  // Stats
  const total       = plots.length;
  const growing     = plots.filter((p) => p.observed_stage === 'growing' || p.observed_stage === 'seedling').length;
  const withCrop    = plots.filter((p) => p.crop_observed).length;

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <div>
        <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>🗺️ แปลงรอขึ้นทะเบียน</h3>
        <p style={{ margin: '3px 0 0', fontSize: 12, color: '#6b7280' }}>แปลงที่ภาคสนามพบแต่ยังไม่ระบุเจ้าของ</p>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8 }}>
        {[
          { label: 'รอขึ้นทะเบียน', value: total, color: '#d97706' },
          { label: 'กำลังปลูก', value: growing, color: '#2e7d32' },
          { label: 'ระบุพืช', value: withCrop, color: '#1d4ed8' },
        ].map((s) => (
          <div key={s.label} style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, padding: '10px', textAlign: 'center' }}>
            <p style={{ margin: 0, fontSize: 22, fontWeight: 900, color: s.color }}>{s.value}</p>
            <p style={{ margin: 0, fontSize: 11, color: '#6b7280' }}>{s.label}</p>
          </div>
        ))}
      </div>

      {assgnError && (
        <p style={{ padding: '8px 12px', background: '#fef2f2', borderRadius: 8, fontSize: 13, color: '#dc2626', border: '1px solid #fca5a5' }}>
          ⚠️ {assgnError}
        </p>
      )}

      {loading && <p style={{ textAlign: 'center', color: '#9ca3af', padding: 20 }}>กำลังโหลด…</p>}
      {!loading && plots.length === 0 && (
        <div style={{ textAlign: 'center', padding: '32px 0', color: '#9ca3af' }}>
          <p style={{ fontSize: 28, margin: '0 0 8px' }}>✅</p>
          <p style={{ margin: 0, fontSize: 13 }}>ไม่มีแปลงรอขึ้นทะเบียน</p>
        </div>
      )}

      {plots.map((p) => (
        <div key={p.id} style={S.card}>
          <div style={{ padding: '12px 14px', display: 'grid', gap: 6 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <p style={{ margin: 0, fontWeight: 700, fontSize: 14 }}>{p.name}</p>
                <p style={{ margin: '2px 0 0', fontSize: 12, color: '#6b7280' }}>
                  📍 {[p.district, p.province].filter(Boolean).join(' · ')}
                  {p.area_rai ? ` · ${p.area_rai} ไร่` : ''}
                </p>
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                {p.crop_observed && (
                  <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: '#2e7d32' }}>🌽 {p.crop_observed}</p>
                )}
                {p.observed_stage && (
                  <p style={{ margin: 0, fontSize: 12 }}>{STAGE_TH[p.observed_stage] ?? p.observed_stage}</p>
                )}
                {p.observed_days_est && (
                  <p style={{ margin: 0, fontSize: 11, color: '#6b7280' }}>~{p.observed_days_est} วัน</p>
                )}
              </div>
            </div>

            {p.unowned_note && (
              <p style={{ margin: 0, fontSize: 12, color: '#6b7280', background: '#f9fafb', borderRadius: 6, padding: '5px 8px' }}>
                📝 {p.unowned_note}
              </p>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <p style={{ margin: 0, fontSize: 11, color: '#9ca3af' }}>
                โดย {p.staff?.full_name ?? '—'} · {new Date(p.created_at).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })}
              </p>
              {p.lat && p.lng && (
                <a href={`https://maps.google.com/?q=${p.lat},${p.lng}`} target="_blank" rel="noreferrer"
                  style={{ fontSize: 11, color: '#1d4ed8' }}>🗺️ ดูแผนที่</a>
              )}
            </div>

            {/* Assign member */}
            {assigning === p.id ? (
              <div style={{ borderTop: '1px solid #f3f4f6', paddingTop: 10, display: 'grid', gap: 6 }}>
                <p style={{ margin: 0, fontSize: 12, fontWeight: 600 }}>ค้นหาสมาชิกเพื่อระบุแปลงนี้</p>
                <input style={S.input} value={memberSearch}
                  onChange={(e) => { setMemberSearch(e.target.value); void searchMembers(e.target.value); }}
                  placeholder="ชื่อหรือเบอร์โทร…" autoFocus />
                {memberResults.map((m) => (
                  <button key={m.id} onClick={() => void assignMember(p.id, m.id, m.full_name)}
                    style={{ padding: '8px 12px', textAlign: 'left', background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 8, cursor: 'pointer', fontSize: 13 }}>
                    <span style={{ fontWeight: 700 }}>{m.full_name}</span>
                    {m.phone && <span style={{ color: '#6b7280', marginLeft: 8 }}>{m.phone}</span>}
                  </button>
                ))}
                <button onClick={() => { setAssigning(null); setMemberSearch(''); setMemberResults([]); }}
                  style={{ padding: '7px', borderRadius: 8, border: '1.5px solid #e5e7eb', background: '#fff', cursor: 'pointer', fontSize: 13, color: '#6b7280' }}>
                  ยกเลิก
                </button>
              </div>
            ) : (
              <button onClick={() => setAssigning(p.id)}
                style={{ padding: '8px', borderRadius: 8, border: '1.5px solid #2e7d32', background: '#fff', color: '#2e7d32', fontWeight: 700, fontSize: 13, cursor: 'pointer', width: '100%' }}>
                👤 ระบุสมาชิก
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
