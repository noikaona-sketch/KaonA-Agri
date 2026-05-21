'use client';

import { useEffect, useState } from 'react';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { ErrorState }   from '@/shared/components/error-state';
import { LoadingState } from '@/shared/components/loading-state';
import { NoBurnTableRow, type NoBurnRow, ACTIONABLE } from './no-burn-table-row';

export function AdminNoBurnList() {
  const [rows,         setRows]         = useState<NoBurnRow[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [error,        setError]        = useState<string | null>(null);
  const [acting,       setActing]       = useState<string | null>(null);
  const [notice,       setNotice]       = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState('');
  const [noteMap,      setNoteMap]      = useState<Record<string, string>>({});
  const [evidenceOpen, setEvidenceOpen] = useState<Record<string, boolean>>({});

  async function load() {
    setLoading(true); setError(null);
    const s = createSupabaseBrowserClient();
    let q = s.from('no_burn_requests')
      .select('id,member_id,status,submitted_at,review_note,consent_accepted,member:members!no_burn_requests_member_id_fkey(full_name,phone),plots(name,area_rai),planting_cycles(crop_name,season_year)')
      .order('submitted_at', { ascending: false }).limit(200);
    if (statusFilter) q = q.eq('status', statusFilter);
    const { data, error: err } = await q;
    if (err) setError(err.message);
    else setRows((data as unknown as NoBurnRow[]) ?? []);
    setLoading(false);
  }

  useEffect(() => { void load(); }, [statusFilter]);

  async function transition(id: string, newStatus: 'under_review' | 'inspection_required' | 'approved' | 'rejected', note?: string) {
    setActing(id);
    const s = createSupabaseBrowserClient();
    const { error: e } = await s.from('no_burn_requests')
      .update({ status: newStatus, review_note: note?.trim() || null }).eq('id', id);
    setActing(null);
    if (e) { setNotice(`❌ เกิดข้อผิดพลาด: ${e.message}`); }
    else {
      const labels: Record<string, string> = {
        under_review: 'อยู่ระหว่างตรวจสอบแล้ว', inspection_required: 'ส่งตรวจแปลงแล้ว',
        approved: 'อนุมัติแล้ว ✅', rejected: 'ปฏิเสธแล้ว ⛔',
      };
      setNotice(labels[newStatus] ?? 'อัปเดตสำเร็จ');
      setNoteMap((prev) => { const n = { ...prev }; delete n[id]; return n; });
    }
    await load();
  }

  function toggleEvidence(id: string) {
    setEvidenceOpen((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  return (
    <div>
      {notice && (
        <div style={{ background: '#e8f5e9', border: '1px solid #a5d6a7', borderRadius: 10, padding: '10px 14px', marginBottom: 14, fontWeight: 600, color: '#1b5e20', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>{notice}</span>
          <button style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: '#6b7280' }} onClick={() => setNotice(null)}>✕</button>
        </div>
      )}

      <div className="admin-filter-bar">
        <select className="admin-select" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">ทุกสถานะ</option>
          <option value="submitted">⏳ รอตรวจสอบ</option>
          <option value="under_review">🔍 กำลังตรวจสอบ</option>
          <option value="inspection_required">📋 ต้องตรวจแปลง</option>
          <option value="approved">✅ อนุมัติ</option>
          <option value="rejected">⛔ ไม่อนุมัติ</option>
          <option value="completed">🏁 เสร็จสิ้น</option>
          <option value="anomaly">⚠️ พบเหตุผิดปกติ</option>
          <option value="seeking_support">🤝 ขอคำแนะนำ</option>
        </select>
      </div>

      {loading && <LoadingState label="กำลังโหลด…" />}
      {error   && <ErrorState title="โหลดไม่สำเร็จ" detail={error} />}

      {!loading && !error && (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>สมาชิก</th><th>แปลง / พื้นที่</th><th>พืช / ฤดูกาล</th>
                <th>ยินยอม</th><th>สถานะ</th><th>วันที่ยื่น</th>
                <th style={{ minWidth: 200 }}>ดำเนินการ</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr><td colSpan={7} style={{ textAlign: 'center', color: '#9ca3af', padding: 32 }}>ไม่มีคำขอ</td></tr>
              )}
              {rows.map((r) => (
                <NoBurnTableRow key={r.id} r={r} acting={acting}
                  noteDraft={noteMap[r.id] ?? ''}
                  onNoteChange={(v) => setNoteMap((prev) => ({ ...prev, [r.id]: v }))}
                  onTransition={transition}
                  showEvidence={!!evidenceOpen[r.id]}
                  onToggleEvidence={() => toggleEvidence(r.id)} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
