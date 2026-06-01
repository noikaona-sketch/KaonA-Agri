'use client';

import { useEffect, useState } from 'react';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { ErrorState }   from '@/shared/components/error-state';
import { LoadingState } from '@/shared/components/loading-state';
import { AdminLabResultForm } from './admin-lab-result-form';

type InspectionRow = {
  id: string; result_status: string; result_note: string | null;
  assigned_at: string | null; visited_at: string | null; created_at: string;
  lab_submitted: boolean; lab_name: string | null;
  lab_submitted_at: string | null; lab_result_at: string | null;
  lab_ph: number | null; lab_om_pct: number | null;
  soil_color: string | null; cert_agency: string | null;
  inspector: { full_name: string }[] | null;
  plots: { name: string; province: string | null }[] | null;
};

const STATUS_MAP: Record<string, { badge: string; label: string }> = {
  pending:      { badge: 'pending',   label: '⏳ รอตรวจ' },
  passed:       { badge: 'approved',  label: '✅ ผ่าน' },
  failed:       { badge: 'rejected',  label: '❌ ไม่ผ่าน' },
  needs_update: { badge: 'pending',   label: '📋 ต้องแก้ไข' },
  cancelled:    { badge: 'suspended', label: '⛔ ยกเลิก' },
};

export function AdminInspectionsList() {
  const [rows,      setRows]      = useState<InspectionRow[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState('');
  const [labFilter,    setLabFilter]    = useState('');   // '' | 'pending' | 'done'
  const [expandedId,   setExpandedId]   = useState<string | null>(null);

  const load = () => {
    void (async () => {
      setLoading(true);
      const s = createSupabaseBrowserClient();
      let q = s.from('inspections')
        .select(`id,result_status,result_note,assigned_at,visited_at,created_at,
          lab_submitted,lab_name,lab_submitted_at,lab_result_at,lab_ph,lab_om_pct,
          soil_color,cert_agency,
          inspector:inspector_member_id(full_name),plots(name,province)`)
        .order('created_at', { ascending: false }).limit(200);
      if (statusFilter) q = q.eq('result_status', statusFilter);
      if (labFilter === 'pending') q = q.eq('lab_submitted', true).is('lab_result_at', null);
      if (labFilter === 'done')    q = q.eq('lab_submitted', true).not('lab_result_at', 'is', null);
      const { data, error: err } = await q;
      if (err) setError(err.message);
      else setRows((data as InspectionRow[]) ?? []);
      setLoading(false);
    })();
  };

  useEffect(load, [statusFilter, labFilter]);

  const labPendingCount = rows.filter((r) => r.lab_submitted && !r.lab_result_at).length;

  return (
    <div>
      {/* Filters */}
      <div className="admin-filter-bar" style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 14 }}>
        <select className="admin-select" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">ทุกสถานะ</option>
          <option value="pending">⏳ รอตรวจ</option>
          <option value="passed">✅ ผ่าน</option>
          <option value="failed">❌ ไม่ผ่าน</option>
          <option value="needs_update">📋 ต้องแก้ไข</option>
        </select>
        <select className="admin-select" value={labFilter} onChange={(e) => setLabFilter(e.target.value)}>
          <option value="">ทุก lab</option>
          <option value="pending">🧪 รอผลแล็บ {labPendingCount > 0 ? `(${labPendingCount})` : ''}</option>
          <option value="done">✅ มีผลแล็บแล้ว</option>
        </select>
      </div>

      {/* Lab pending alert */}
      {labPendingCount > 0 && !labFilter && (
        <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 10, padding: '10px 14px', marginBottom: 14, display: 'flex', gap: 10, alignItems: 'center' }}>
          <span>🧪</span>
          <div>
            <p style={{ margin: 0, fontWeight: 700, fontSize: 13, color: '#92400e' }}>มี {labPendingCount} งานรอผลแล็บ</p>
            <button onClick={() => setLabFilter('pending')}
              style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontSize: 12, color: '#1d4ed8', textDecoration: 'underline' }}>
              ดูรายการรอผล →
            </button>
          </div>
        </div>
      )}

      <p style={{ margin: '0 0 12px', fontSize: 13, color: '#6b7280' }}>{rows.length} งานตรวจ</p>

      {loading && <LoadingState label="กำลังโหลด…" />}
      {error   && <ErrorState title="โหลดไม่สำเร็จ" detail={error} />}

      {!loading && !error && (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>แปลง</th><th>ผู้ตรวจ</th><th>วันตรวจ</th>
                <th>ผลตรวจ</th><th>ดิน</th><th>ใบรับรอง</th><th>แล็บ</th><th></th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr><td colSpan={8} style={{ textAlign: 'center', color: '#9ca3af', padding: 32 }}>ไม่มีงานตรวจ</td></tr>
              )}
              {rows.map((r) => {
                const st = STATUS_MAP[r.result_status] ?? { badge: 'pending', label: r.result_status };
                const labPending = r.lab_submitted && !r.lab_result_at;
                const labDone    = r.lab_submitted && r.lab_result_at;
                const isOpen = expandedId === r.id;
                return (
                  <>
                    <tr key={r.id} style={{ background: labPending ? '#fffbeb' : undefined }}>
                      <td style={{ fontWeight: 600 }}>
                        {r.plots?.[0]?.name ?? '—'}
                        <span style={{ fontSize: 11, color: '#6b7280', display: 'block' }}>{r.plots?.[0]?.province ?? ''}</span>
                      </td>
                      <td style={{ fontSize: 13 }}>{r.inspector?.[0]?.full_name ?? '—'}</td>
                      <td style={{ fontSize: 12, color: '#6b7280', whiteSpace: 'nowrap' }}>
                        {r.visited_at ? new Date(r.visited_at).toLocaleDateString('th-TH') : '—'}
                      </td>
                      <td><span className={`status-badge status-badge--${st.badge}`}>{st.label}</span></td>
                      <td style={{ fontSize: 12 }}>
                        {r.soil_color ? '🪱 มี' : <span style={{ color: '#d1d5db' }}>—</span>}
                      </td>
                      <td style={{ fontSize: 12 }}>
                        {r.cert_agency ? '🏛️ มี' : <span style={{ color: '#d1d5db' }}>—</span>}
                      </td>
                      <td style={{ fontSize: 12 }}>
                        {labDone    && <span style={{ color: '#059669', fontWeight: 600 }}>✅ มีผล</span>}
                        {labPending && <span style={{ color: '#d97706', fontWeight: 600 }}>⏳ รอผล</span>}
                        {!r.lab_submitted && <span style={{ color: '#d1d5db' }}>—</span>}
                      </td>
                      <td>
                        {labPending && (
                          <button
                            onClick={() => setExpandedId(isOpen ? null : r.id)}
                            style={{ padding: '5px 10px', fontSize: 12, borderRadius: 7, border: '1.5px solid #1d4ed8', background: isOpen ? '#1d4ed8' : '#fff', color: isOpen ? '#fff' : '#1d4ed8', cursor: 'pointer', fontWeight: 600, whiteSpace: 'nowrap' }}>
                            {isOpen ? '▲ ปิด' : '📝 กรอกผล'}
                          </button>
                        )}
                      </td>
                    </tr>
                    {isOpen && labPending && (
                      <tr key={`${r.id}-lab`}>
                        <td colSpan={8} style={{ background: '#f8fafc', padding: '16px 20px', borderBottom: '2px solid #e0e7ef' }}>
                          <div style={{ maxWidth: 480 }}>
                            <AdminLabResultForm
                              inspectionId={r.id}
                              labName={r.lab_name}
                              labSubmittedAt={r.lab_submitted_at}
                              currentPh={r.lab_ph}
                              currentOm={r.lab_om_pct}
                              onSaved={() => { setExpandedId(null); load(); }}
                            />
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
