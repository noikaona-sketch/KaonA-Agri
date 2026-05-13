'use client';

import { useEffect, useState } from 'react';

import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { ErrorState } from '@/shared/components/error-state';
import { LoadingState } from '@/shared/components/loading-state';

type PlotRow = {
  id: string;
  member_id: string;
  name: string;
  area_rai: number;
  province: string | null;
  land_doc_type: string | null;
  status: string;
  created_at: string;
  members: { full_name: string }[] | null;
};

const STATUS_BADGE: Record<string, string> = {
  pending_review: 'pending', active: 'approved', inactive: 'suspended',
};

const LAND_DOC_TH: Record<string, string> = {
  title_deed: 'โฉนด', ns3k: 'นส.3ก', ns3: 'นส.3',
  sk1: 'สค.1', por_btor_6: 'ภบท.6', other: 'อื่นๆ',
};

export function AdminPlotsList() {
  const [plots, setPlots]     = useState<PlotRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);
  const [search, setSearch]   = useState('');

  useEffect(() => {
    void (async () => {
      setLoading(true);
      const s = createSupabaseBrowserClient();
      const { data, error: err } = await s
        .from('plots')
        .select('id,member_id,name,area_rai,province,land_doc_type,status,created_at,members(full_name)')
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .limit(200);
      if (err) setError(err.message);
      else setPlots((data as PlotRow[]) ?? []);
      setLoading(false);
    })();
  }, []);

  const filtered = plots.filter((p) =>
    !search ||
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    (p.members?.[0]?.full_name ?? '').toLowerCase().includes(search.toLowerCase()) ||
    (p.province ?? '').includes(search)
  );

  return (
    <div>
      <div className="admin-filter-bar">
        <input className="admin-search" placeholder="🔍  ค้นหาชื่อแปลง ชื่อสมาชิก จังหวัด…" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>
      <p style={{ margin: '0 0 12px', fontSize: 13, color: '#6b7280' }}>{filtered.length} แปลง</p>

      {loading && <LoadingState label="กำลังโหลด…" />}
      {error && <ErrorState title="โหลดไม่สำเร็จ" detail={error} />}

      {!loading && !error && (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>ชื่อแปลง</th>
                <th>เจ้าของ</th>
                <th>ไร่</th>
                <th>จังหวัด</th>
                <th>เอกสาร</th>
                <th>สถานะ</th>
                <th>วันที่ลงทะเบียน</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr><td colSpan={7} style={{ textAlign: 'center', color: '#9ca3af', padding: 32 }}>ไม่พบแปลง</td></tr>
              )}
              {filtered.map((p) => (
                <tr key={p.id}>
                  <td style={{ fontWeight: 600 }}>{p.name}</td>
                  <td>{p.members?.[0]?.full_name ?? '—'}</td>
                  <td>{p.area_rai}</td>
                  <td>{p.province ?? '—'}</td>
                  <td>{p.land_doc_type ? (LAND_DOC_TH[p.land_doc_type] ?? p.land_doc_type) : '—'}</td>
                  <td>
                    <span className={`status-badge status-badge--${STATUS_BADGE[p.status] ?? 'pending'}`}>
                      {p.status === 'active' ? '✅ ใช้งาน' : p.status === 'pending_review' ? '⏳ รอตรวจ' : p.status}
                    </span>
                  </td>
                  <td style={{ fontSize: 13, color: '#6b7280', whiteSpace: 'nowrap' }}>
                    {new Date(p.created_at).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
