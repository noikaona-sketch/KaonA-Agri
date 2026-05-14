'use client';

import { useEffect, useState } from 'react';

import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { ErrorState } from '@/shared/components/error-state';
import { LoadingState } from '@/shared/components/loading-state';

type NoBurnRow = {
  id: string;
  member_id: string;
  status: string;
  submitted_at: string;
  review_note: string | null;
  members: { full_name: string; phone: string | null }[] | null;
  plots: { name: string; area_rai: number }[] | null;
  planting_cycles: { crop_name: string; season_year: number }[] | null;
};

const STATUS_MAP: Record<string, { badge: string; label: string }> = {
  submitted:  { badge: 'pending',   label: '⏳ รอตรวจสอบ' },
  approved:   { badge: 'approved',  label: '✅ อนุมัติ' },
  rejected:   { badge: 'rejected',  label: '❌ ไม่อนุมัติ' },
  inspecting: { badge: 'pending',   label: '🔍 กำลังตรวจ' },
};

export function AdminNoBurnList() {
  const [rows, setRows]       = useState<NoBurnRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);
  const [acting, setActing]   = useState<string | null>(null);
  const [notice, setNotice]   = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState('');

  async function load() {
    setLoading(true);
    const s = createSupabaseBrowserClient();
    let q = s.from('no_burn_requests')
      .select('*,members(full_name,phone),plots(name,area_rai),planting_cycles(crop_name,season_year)')
      .order('submitted_at', { ascending: false })
      .limit(200);
    if (statusFilter) q = q.eq('status', statusFilter);
    const { data, error: err } = await q;
    if (err) setError(err.message);
    else setRows((data as NoBurnRow[]) ?? []);
    setLoading(false);
  }

  useEffect(() => { void load(); }, [statusFilter]);

  async function review(id: string, decision: 'approved' | 'rejected', note?: string) {
    setActing(id);
    const s = createSupabaseBrowserClient();
    await s.from('no_burn_requests').update({ status: decision, review_note: note ?? null }).eq('id', id);
    setActing(null);
    setNotice(decision === 'approved' ? '✅ อนุมัติแล้ว' : '❌ ปฏิเสธแล้ว');
    await load();
  }

  return (
    <div>
      {notice && <div style={{ background: '#e8f5e9', border: '1px solid #a5d6a7', borderRadius: 10, padding: '10px 14px', marginBottom: 14, fontWeight: 600, color: '#1b5e20' }}>{notice}</div>}

      <div className="admin-filter-bar">
        <select className="admin-select" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">ทุกสถานะ</option>
          <option value="submitted">⏳ รอตรวจ</option>
          <option value="approved">✅ อนุมัติ</option>
          <option value="rejected">❌ ไม่อนุมัติ</option>
        </select>
      </div>

      {loading && <LoadingState label="กำลังโหลด…" />}
      {error && <ErrorState title="โหลดไม่สำเร็จ" detail={error} />}

      {!loading && !error && (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr><th>สมาชิก</th><th>แปลง</th><th>พืช / ฤดูกาล</th><th>สถานะ</th><th>วันที่ยื่น</th><th style={{ textAlign: 'center' }}>อนุมัติ</th></tr>
            </thead>
            <tbody>
              {rows.length === 0 && <tr><td colSpan={6} style={{ textAlign: 'center', color: '#9ca3af', padding: 32 }}>ไม่มีคำขอ</td></tr>}
              {rows.map((r) => {
                const st = STATUS_MAP[r.status] ?? { badge: 'pending', label: r.status };
                return (
                  <tr key={r.id}>
                    <td>
                      <p style={{ margin: 0, fontWeight: 600 }}>{r.members?.[0]?.full_name ?? '—'}</p>
                      <p style={{ margin: 0, fontSize: 12, color: '#6b7280' }}>{r.members?.[0]?.phone ?? ''}</p>
                    </td>
                    <td>{r.plots?.[0]?.name ?? '—'} {r.plots?.[0]?.area_rai ? `(${r.plots[0].area_rai} ไร่)` : ''}</td>
                    <td>{r.planting_cycles?.[0] ? `${r.planting_cycles[0].crop_name} ${r.planting_cycles[0].season_year}` : '—'}</td>
                    <td><span className={`status-badge status-badge--${st.badge}`}>{st.label}</span></td>
                    <td style={{ fontSize: 13, color: '#6b7280', whiteSpace: 'nowrap' }}>{new Date(r.submitted_at).toLocaleDateString('th-TH')}</td>
                    <td>
                      {r.status === 'submitted' && (
                        <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
                          <button className="admin-btn admin-btn--success" onClick={() => review(r.id, 'approved')} disabled={acting !== null}>✅</button>
                          <button className="admin-btn admin-btn--danger"  onClick={() => review(r.id, 'rejected')} disabled={acting !== null}>❌</button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
