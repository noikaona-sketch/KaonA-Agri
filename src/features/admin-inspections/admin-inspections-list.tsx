'use client';

import { useEffect, useState } from 'react';

import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { ErrorState } from '@/shared/components/error-state';
import { LoadingState } from '@/shared/components/loading-state';

type InspectionRow = {
  id: string;
  result_status: string;
  result_note: string | null;
  assigned_at: string | null;
  visited_at: string | null;
  created_at: string;
  inspector: { full_name: string }[] | null;
  plots: { name: string; province: string | null }[] | null;
};

const STATUS_MAP: Record<string, { badge: string; label: string }> = {
  pending:   { badge: 'pending',   label: '⏳ รอตรวจ' },
  pass:      { badge: 'approved',  label: '✅ ผ่าน' },
  fail:      { badge: 'rejected',  label: '❌ ไม่ผ่าน' },
  cancelled: { badge: 'suspended', label: '⛔ ยกเลิก' },
};

export function AdminInspectionsList() {
  const [rows, setRows]       = useState<InspectionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState('');

  useEffect(() => {
    void (async () => {
      setLoading(true);
      const s = createSupabaseBrowserClient();
      let q = s.from('inspections')
        .select('id,result_status,result_note,assigned_at,visited_at,created_at,inspector:inspector_member_id(full_name),plots(name,province)')
        .order('created_at', { ascending: false })
        .limit(200);
      if (statusFilter) q = q.eq('result_status', statusFilter);
      const { data, error: err } = await q;
      if (err) setError(err.message);
      else setRows((data as InspectionRow[]) ?? []);
      setLoading(false);
    })();
  }, [statusFilter]);

  return (
    <div>
      <div className="admin-filter-bar">
        <select className="admin-select" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">ทุกสถานะ</option>
          <option value="pending">⏳ รอตรวจ</option>
          <option value="pass">✅ ผ่าน</option>
          <option value="fail">❌ ไม่ผ่าน</option>
        </select>
      </div>
      <p style={{ margin: '0 0 12px', fontSize: 13, color: '#6b7280' }}>{rows.length} งานตรวจ</p>

      {loading && <LoadingState label="กำลังโหลด…" />}
      {error && <ErrorState title="โหลดไม่สำเร็จ" detail={error} />}

      {!loading && !error && (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr><th>แปลง</th><th>ผู้ตรวจ</th><th>วันที่นัด</th><th>วันที่ตรวจ</th><th>ผลการตรวจ</th><th>หมายเหตุ</th></tr>
            </thead>
            <tbody>
              {rows.length === 0 && <tr><td colSpan={6} style={{ textAlign: 'center', color: '#9ca3af', padding: 32 }}>ไม่มีงานตรวจ</td></tr>}
              {rows.map((r) => {
                const st = STATUS_MAP[r.result_status] ?? { badge: 'pending', label: r.result_status };
                return (
                  <tr key={r.id}>
                    <td style={{ fontWeight: 600 }}>{r.plots?.[0]?.name ?? '—'} <span style={{ fontSize: 12, color: '#6b7280' }}>{r.plots?.[0]?.province ?? ''}</span></td>
                    <td>{r.inspector?.[0]?.full_name ?? '—'}</td>
                    <td style={{ fontSize: 13, color: '#6b7280', whiteSpace: 'nowrap' }}>{r.assigned_at ? new Date(r.assigned_at).toLocaleDateString('th-TH') : '—'}</td>
                    <td style={{ fontSize: 13, color: '#6b7280', whiteSpace: 'nowrap' }}>{r.visited_at ? new Date(r.visited_at).toLocaleDateString('th-TH') : '—'}</td>
                    <td><span className={`status-badge status-badge--${st.badge}`}>{st.label}</span></td>
                    <td style={{ fontSize: 13, color: '#6b7280', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.result_note ?? '—'}</td>
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
