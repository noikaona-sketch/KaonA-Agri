'use client';

import { useEffect, useState } from 'react';

import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { ErrorState } from '@/shared/components/error-state';
import { LoadingState } from '@/shared/components/loading-state';

type CycleRow = {
  id: string;
  crop_name: string;
  season_year: number;
  status: string;
  planted_at: string | null;
  expected_harvest_at: string | null;
  created_at: string;
  member: { full_name: string }[] | null;
  plots: { name: string; area_rai: number }[] | null;
};

const STATUS_MAP: Record<string, { badge: string; label: string }> = {
  planned:    { badge: 'pending',   label: '📋 วางแผน' },
  planted:    { badge: 'approved',  label: '🌱 ปลูกแล้ว' },
  growing:    { badge: 'approved',  label: '🌿 กำลังเจริญ' },
  harvested:  { badge: 'approved',  label: '🌾 เก็บเกี่ยวแล้ว' },
  cancelled:  { badge: 'suspended', label: '⛔ ยกเลิก' },
};

export function AdminPlantingList() {
  const [rows, setRows]       = useState<CycleRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState('');
  const [yearFilter, setYearFilter]     = useState('');

  useEffect(() => {
    void (async () => {
      setLoading(true);
      const s = createSupabaseBrowserClient();
      let q = s.from('planting_cycles')
        .select('id,crop_name,season_year,status,planted_at,expected_harvest_at,created_at,member:members!planting_cycles_member_id_fkey(full_name),plots(name,area_rai)')
        .order('created_at', { ascending: false })
        .limit(200);
      if (statusFilter) q = q.eq('status', statusFilter);
      if (yearFilter)   q = q.eq('season_year', Number(yearFilter));
      const { data, error: err } = await q;
      if (err) setError(err.message);
      else setRows((data as CycleRow[]) ?? []);
      setLoading(false);
    })();
  }, [statusFilter, yearFilter]);

  const years = [...new Set(rows.map((r) => r.season_year))].sort((a, b) => b - a);

  return (
    <div>
      <div className="admin-filter-bar">
        <select className="admin-select" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">ทุกสถานะ</option>
          <option value="planned">📋 วางแผน</option>
          <option value="planted">🌱 ปลูกแล้ว</option>
          <option value="growing">🌿 กำลังเจริญ</option>
          <option value="harvested">🌾 เก็บเกี่ยวแล้ว</option>
        </select>
        <select className="admin-select" value={yearFilter} onChange={(e) => setYearFilter(e.target.value)}>
          <option value="">ทุกปี</option>
          {years.map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
      </div>
      <p style={{ margin: '0 0 12px', fontSize: 13, color: '#6b7280' }}>{rows.length} รอบเพาะปลูก</p>

      {loading && <LoadingState label="กำลังโหลด…" />}
      {error && <ErrorState title="โหลดไม่สำเร็จ" detail={error} />}

      {!loading && !error && (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr><th>สมาชิก</th><th>แปลง</th><th>พืช</th><th>ปี</th><th>วันปลูก</th><th>กำหนดเก็บ</th><th>สถานะ</th></tr>
            </thead>
            <tbody>
              {rows.length === 0 && <tr><td colSpan={7} style={{ textAlign: 'center', color: '#9ca3af', padding: 32 }}>ไม่มีรอบเพาะปลูก</td></tr>}
              {rows.map((r) => {
                const st = STATUS_MAP[r.status] ?? { badge: 'pending', label: r.status };
                return (
                  <tr key={r.id}>
                    <td style={{ fontWeight: 600 }}>{r.member?.[0]?.full_name ?? '—'}</td>
                    <td>{r.plots?.[0]?.name ?? '—'} {r.plots?.[0]?.area_rai ? <span style={{ fontSize: 12, color: '#6b7280' }}>({r.plots[0].area_rai} ไร่)</span> : null}</td>
                    <td style={{ fontWeight: 600 }}>{r.crop_name}</td>
                    <td>{r.season_year}</td>
                    <td style={{ fontSize: 13, color: '#6b7280', whiteSpace: 'nowrap' }}>{r.planted_at ? new Date(r.planted_at).toLocaleDateString('th-TH') : '—'}</td>
                    <td style={{ fontSize: 13, color: '#6b7280', whiteSpace: 'nowrap' }}>{r.expected_harvest_at ? new Date(r.expected_harvest_at).toLocaleDateString('th-TH') : '—'}</td>
                    <td><span className={`status-badge status-badge--${st.badge}`}>{st.label}</span></td>
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
